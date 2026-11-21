import type { RouteResearchResult, TransportResearchMode } from "./routeResearch";

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
  research: RouteResearchResult,
  generatedAt = new Date().toISOString(),
): TravelIntelligenceReport {
  const findings: IntelligenceFinding[] = research.modes.map(item => {
    if (item.mode === "car") {
      if (item.status === "road_route_found") {
        return {
          mode: item.mode,
          level: "road_estimate",
          headline: "A road-network route was returned",
          details: [item.evidence, "This is a routing estimate, not live traffic, road-condition or road-open information."],
          verifiedService: false,
        };
      }
      return {
        mode: item.mode,
        level: "unknown",
        headline: "Road route not confirmed",
        details: [item.evidence],
        verifiedService: false,
      };
    }

    if (item.status === "infrastructure_at_both_ends") {
      return {
        mode: item.mode,
        level: "positive",
        headline: `${modeLabels[item.mode]} infrastructure is mapped near both endpoints`,
        details: [item.evidence, "This does not establish a direct or scheduled service between the two places."],
        verifiedService: false,
      };
    }
    if (item.status === "infrastructure_partial") {
      return {
        mode: item.mode,
        level: "partial",
        headline: `${modeLabels[item.mode]} infrastructure was found near only one endpoint`,
        details: [item.evidence, "The other endpoint may have infrastructure outside the search area or absent from the map data."],
        verifiedService: false,
      };
    }
    if (item.status === "no_infrastructure_found") {
      return {
        mode: item.mode,
        level: "unknown",
        headline: "No matching mapped infrastructure was found",
        details: [item.evidence, "This is not evidence that the transport service does not exist."],
        verifiedService: false,
      };
    }
    return {
      mode: item.mode,
      level: "unknown",
      headline: `${modeLabels[item.mode]} research could not be completed`,
      details: ["The infrastructure provider did not return usable evidence. Try again later or check an authoritative operator source."],
      verifiedService: false,
    };
  });

  const hasMapEvidence = research.infrastructure.some(item => item.checked);
  const hasRoadEvidence = research.road?.status === "route_found";
  const missingEvidence = [
    "Direct scheduled-service confirmation from an airline, railway, bus or ferry operator.",
    "Live departure times, journey duration, fares, seat availability and booking links.",
    "Transfer requirements, terminal changes and connection feasibility.",
    ...(!hasRoadEvidence ? ["A confirmed road-network route and current road conditions."] : []),
    ...(!hasMapEvidence ? ["Reliable mapped transport-infrastructure observations for the endpoints."] : []),
  ];

  const positive = findings.filter(item => item.level === "positive").map(item => modeLabels[item.mode].toLowerCase());
  const summary = [
    `Research for ${research.origin} to ${research.destination} on ${research.travelDate} is complete at the evidence level only.`,
    positive.length ? `Mapped infrastructure was found at both endpoints for: ${positive.join(", ")}.` : "No transport mode has confirmed infrastructure at both endpoints.",
    hasRoadEvidence ? "A road-network estimate is available." : "A usable road-network estimate is not available.",
    "No scheduled transport service, live fare or seat availability has been verified.",
  ].join(" ");

  return {
    engine: "TripsForge Evidence Engine",
    generatedAt,
    journey: { origin: research.origin, destination: research.destination, travelDate: research.travelDate },
    summary,
    findings,
    missingEvidence,
    recommendedNextSteps: [
      "Check the official operator for the selected travel mode and exact travel date.",
      "Compare departure and arrival terminals before accepting a connection.",
      "Add only quoted or provider-confirmed fares to the trip budget.",
    ],
    confidence: hasMapEvidence || hasRoadEvidence ? "moderate" : "limited",
    safetyRules: [
      "Mapped infrastructure is not proof of a scheduled route.",
      "A road-network estimate is not a live traffic or road-open check.",
      "Unknown or missing provider data must never be presented as service unavailability.",
      "Never generate a fare, schedule, seat count or booking confirmation without a supporting source.",
    ],
  };
}
