export type TransportResearchMode = "flight" | "train" | "bus" | "car" | "ferry";

export type InfrastructureEvidence = {
  kind: TransportResearchMode;
  originCount: number;
  destinationCount: number;
  originExamples: string[];
  destinationExamples: string[];
  checked: boolean;
  reason?: string;
  provider?: string;
};

export type RouteResearchResult = {
  provider: string;
  retrievedAt: string;
  origin: string;
  destination: string;
  travelDate: string;
  road:
    | null
    | { status: "route_found"; distanceKm: number; durationMinutes: number; provider: string }
    | { status: "no_route_returned"; provider: string }
    | { status: "unavailable"; provider: string; reason: string };
  infrastructure: InfrastructureEvidence[];
  modes: Array<{
    mode: TransportResearchMode;
    status: "road_route_found" | "road_route_not_returned" | "road_lookup_unavailable" | "infrastructure_at_both_ends" | "infrastructure_partial" | "no_infrastructure_found" | "not_checked";
    evidence: string;
    serviceStatus: "unverified";
    bookingStatus: "not_connected";
  }>;
  limitations: string[];
};

export function buildRouteResearch(input: {
  origin: string;
  destination: string;
  travelDate: string;
  road: RouteResearchResult["road"];
  infrastructure: InfrastructureEvidence[];
  retrievedAt: string;
}): RouteResearchResult {
  const modes = (["flight", "train", "bus", "car", "ferry"] as const).map(mode => {
    if (mode === "car") {
      return {
        mode,
        status: input.road?.status === "route_found"
          ? "road_route_found" as const
          : input.road?.status === "no_route_returned"
            ? "road_route_not_returned" as const
            : input.road?.status === "unavailable"
              ? "road_lookup_unavailable" as const
              : "not_checked" as const,
        evidence: input.road?.status === "route_found"
          ? `A drivable road-network route was returned: ${input.road.distanceKm} km, estimated ${input.road.durationMinutes} minutes.`
          : input.road?.status === "no_route_returned"
            ? "OSRM returned no drivable route for these coordinates. This does not prove that no road connection exists."
            : input.road?.status === "unavailable"
              ? `The road-network lookup was unavailable: ${input.road.reason}`
              : "No road-network lookup was performed.",
        serviceStatus: "unverified" as const,
        bookingStatus: "not_connected" as const,
      };
    }

    const evidence = input.infrastructure.find(item => item.kind === mode);
    const originCount = evidence?.originCount ?? 0;
    const destinationCount = evidence?.destinationCount ?? 0;
    let status: RouteResearchResult["modes"][number]["status"] = "not_checked";
    if (evidence?.checked) {
      if (originCount > 0 && destinationCount > 0) status = "infrastructure_at_both_ends";
      else if (originCount > 0 || destinationCount > 0) status = "infrastructure_partial";
      else status = "no_infrastructure_found";
    }

    const examples = [
      ...(evidence?.originExamples ?? []).map(name => `Origin: ${name}`),
      ...(evidence?.destinationExamples ?? []).map(name => `Destination: ${name}`),
    ];
    const explanation = status === "infrastructure_at_both_ends"
      ? `Transport infrastructure is mapped near both endpoints. ${examples.join("; ")}`
      : status === "infrastructure_partial"
        ? `Mapped infrastructure was found near only one endpoint. ${examples.join("; ")}`
        : status === "no_infrastructure_found"
          ? "No matching infrastructure was found in the searched radius. This does not prove the service does not exist."
          : `Infrastructure data could not be checked. ${evidence?.reason ? `Lookup detail: ${evidence.reason}.` : "The map-data providers did not return a usable response."}`;

    return {
      mode,
      status,
      evidence: explanation,
      serviceStatus: "unverified" as const,
      bookingStatus: "not_connected" as const,
    };
  });

  return {
    provider: "OpenStreetMap / Overpass + OSRM",
    retrievedAt: input.retrievedAt,
    origin: input.origin,
    destination: input.destination,
    travelDate: input.travelDate,
    road: input.road,
    infrastructure: input.infrastructure,
    modes,
    limitations: [
      "Mapped airports, stations, bus stops and ferry terminals are infrastructure evidence only, not proof of a scheduled service between these cities.",
      "No live airline, rail, bus or ferry timetable, fare, seat availability or booking provider is connected.",
      "A road-network route does not prove that a bus service operates, that traffic is clear, or that the road is currently open.",
      "No result from OpenStreetMap is not proof that infrastructure or a transport service does not exist.",
      "Infrastructure search radius is 20 km around each endpoint; rural terminals or alternate gateways may be outside it.",
    ],
  };
}
