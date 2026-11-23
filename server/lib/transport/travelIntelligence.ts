import type { RouteResearchResult, TransportResearchMode } from "./routeResearch";

type TrainAvailabilityEvidence = {
  status: "offers_found" | "no_service_found" | "provider_not_configured" | "lookup_unavailable";
  provider: string;
  trains: Array<{ trainNumber: string; trainName: string; departureTime?: string; arrivalTime?: string; durationMinutes?: number }>;
  disclaimer?: string;
  message?: string;
};

export type IntelligenceFinding = {
  mode: TransportResearchMode;
  level: "positive" | "partial" | "unknown" | "road_estimate";
  headline: string;
  details: string[];
  verifiedService: false;
};

export type TravelIntelligenceReport = {
  engine: "TripsForge Evidence Engine";
  generatedAt: string;
  journey: { origin: string; destination: string; travelDate: string };
  summary: string;
  findings: IntelligenceFinding[];
  missingEvidence: string[];
  recommendedNextSteps: string[];
  confidence: "limited" | "moderate";
  safetyRules: string[];
};

const modeLabels: Record<TransportResearchMode, string> = {
  flight: "Flight",
  train: "Train",
  bus: "Bus",
  car: "Car",
  ferry: "Ferry",
};

/**
 * Converts provider observations into a conservative, traveller-facing assessment.
 * It deliberately does not infer scheduled service, fares, availability or booking.
 */
export function buildTravelIntelligence(
  research: RouteResearchResult & { trainAvailability?: TrainAvailabilityEvidence },
  generatedAt = new Date().toISOString(),
): TravelIntelligenceReport {
  const findings: IntelligenceFinding[] = research.modes
    // Train has its own date-specific timetable provider. Do not report the
    // unrelated map-infrastructure lookup as the train-service result.
    .filter(item => item.mode !== "train")
    .map(item => {
      if (item.mode === "car") {
        if (item.status === "road_route_found") {
          return {
            mode: item.mode,
            level: "road_estimate" as const,
            headline: "A road-network route was returned",
            details: [item.evidence, "This is a routing estimate, not live traffic, road-condition or road-open information."],
            verifiedService: false as const,
          };
        }
        return {
          mode: item.mode,
          level: "unknown" as const,
          headline: "Road route not confirmed",
          details: [item.evidence],
          verifiedService: false as const,
        };
      }

      if (item.status === "infrastructure_at_both_ends") {
        return {
          mode: item.mode,
          level: "positive" as const,
          headline: `${modeLabels[item.mode]} infrastructure is mapped near both endpoints`,
          details: [item.evidence, "This does not establish a direct or scheduled service between the two places."],
          verifiedService: false as const,
        };
      }
      if (item.status === "infrastructure_partial") {
        return {
          mode: item.mode,
          level: "partial" as const,
          headline: `${modeLabels[item.mode]} infrastructure was found near only one endpoint`,
          details: [item.evidence, "The other endpoint may have infrastructure outside the search area or absent from the map data."],
          verifiedService: false as const,
        };
      }
      if (item.status === "no_infrastructure_found") {
        return {
          mode: item.mode,
          level: "unknown" as const,
          headline: "No matching mapped infrastructure was found",
          details: [item.evidence, "This is not evidence that the transport service does not exist."],
          verifiedService: false as const,
        };
      }
      return {
        mode: item.mode,
        level: "unknown" as const,
        headline: `${modeLabels[item.mode]} infrastructure research could not be completed`,
        details: ["The map-data provider did not return usable infrastructure evidence. This is not a transport-service availability result."],
        verifiedService: false as const,
      };
    });

  const train = research.trainAvailability;
  if (train?.status === "offers_found") {
    findings.push({
      mode: "train",
      level: "positive",
      headline: `${train.trains.length} train option${train.trains.length === 1 ? "" : "s"} returned for the selected date`,
      details: [
        `Timetable options were returned by ${train.provider} for ${research.travelDate}.`,
        train.disclaimer ?? "Read-only timetable data. Confirm current timings and seat availability with the railway.",
      ],
      verifiedService: false,
    });
  } else if (train?.status === "no_service_found") {
    findings.push({
      mode: "train",
      level: "unknown",
      headline: "No train options were returned for the selected date",
      details: [`The ${train.provider} timetable search returned no matching trains. This result is limited to that provider's coverage.`],
      verifiedService: false,
    });
  } else {
    findings.push({
      mode: "train",
      level: "unknown",
      headline: "Train timetable lookup unavailable",
      details: [train?.message ?? "Train timetable provider did not return a result. Map infrastructure research is not used as a substitute."],
      verifiedService: false,
    });
  }

  const hasMapEvidence = research.infrastructure.some(item => item.checked);
  const hasRoadEvidence = research.road?.status === "route_found";
  const trainFound = train?.status === "offers_found";
  const missingEvidence = [
    "Live departure confirmation, fares and seat availability from the railway operator.",
    "Transfer requirements, terminal changes and connection feasibility.",
    ...(!hasRoadEvidence ? ["A confirmed road-network route and current road conditions."] : []),
    ...(!hasMapEvidence ? ["Reliable mapped transport-infrastructure observations for the endpoints."] : []),
  ];

  const positive = findings.filter(item => item.level === "positive").map(item => item.mode === "train" ? "train timetable options" : modeLabels[item.mode].toLowerCase());
  const summary = [
    `Research for ${research.origin} to ${research.destination} on ${research.travelDate} is complete at the evidence level only.`,
    positive.length ? `Provider or map evidence was returned for: ${positive.join(", ")}.` : "No positive transport evidence was returned.",
    hasRoadEvidence ? "A road-network estimate is available." : "A usable road-network estimate is not available.",
    trainFound ? "Train timetable options are not a seat-availability or booking confirmation." : "No train timetable options were confirmed by the connected provider.",
  ].join(" ");

  return {
    engine: "TripsForge Evidence Engine",
    generatedAt,
    journey: { origin: research.origin, destination: research.destination, travelDate: research.travelDate },
    summary,
    findings,
    missingEvidence,
    recommendedNextSteps: [
      "Confirm train timings, fares and seat availability with the railway operator for the selected date.",
      "Compare departure and arrival terminals before accepting a connection.",
      "Add only quoted or provider-confirmed fares to the trip budget.",
    ],
    confidence: hasMapEvidence || hasRoadEvidence || trainFound ? "moderate" : "limited",
    safetyRules: [
      "Mapped infrastructure is not proof of a scheduled route.",
      "A road-network estimate is not a live traffic or road-open check.",
      "Unknown or missing provider data must never be presented as service unavailability.",
      "Never generate a fare, schedule, seat count or booking confirmation without a supporting source.",
    ],
  };
}
