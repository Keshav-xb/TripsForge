import { buildJourneyOptions, type JourneyCandidateLeg, type JourneyPriority } from "../../../server/lib/transport/journeyGraph";

type Research = {
  origin: string;
  destination: string;
  road?: { status: string; durationMinutes?: number; provider: string } | null;
  trainAvailability?: { status: string; provider: string; trains?: Array<{ trainNumber: string; trainName: string; durationMinutes?: number }> };
};
type SearchData = {
  status?: string;
  provider?: string;
  originCode?: string;
  destinationCode?: string;
  offers?: Array<Record<string, unknown>>;
};

const node = (value: string) => `city:${value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

export function createJourneyOptions(input: {
  research: Research;
  flights?: SearchData;
  buses?: SearchData;
  priority?: JourneyPriority;
}) {
  const { research, flights, buses } = input;
  const originNode = node(research.origin);
  const destinationNode = node(research.destination);
  const legs: JourneyCandidateLeg[] = [];

  if (research.road?.status === "route_found" && Number.isFinite(research.road.durationMinutes)) {
    legs.push({
      id: "road-osrm-estimate",
      fromNode: originNode, toNode: destinationNode, mode: "car",
      fromLabel: research.origin, toLabel: research.destination,
      durationMinutes: research.road.durationMinutes,
      provider: research.road.provider, evidence: "route_estimate",
    });
  }

  if (research.trainAvailability?.status === "offers_found") {
    for (const train of research.trainAvailability.trains ?? []) {
      legs.push({
        id: `train-${train.trainNumber}`,
        fromNode: originNode, toNode: destinationNode, mode: "train",
        fromLabel: research.origin, toLabel: research.destination,
        ...(Number.isFinite(train.durationMinutes) ? { durationMinutes: train.durationMinutes } : {}),
        provider: research.trainAvailability.provider, evidence: "provider_schedule",
      });
    }
  }

  if (buses?.status === "offers_found") {
    for (const [index, offer] of (buses.offers ?? []).entries()) {
      legs.push({
        id: `bus-${String(offer.route ?? "route")}-${String(offer.departureTime ?? index)}`,
        fromNode: originNode, toNode: destinationNode, mode: "bus",
        fromLabel: String(offer.fromStop ?? research.origin),
        toLabel: String(offer.toStop ?? research.destination),
        provider: String(buses.provider ?? "Public GTFS"), evidence: "provider_schedule",
      });
    }
  }

  if (flights?.status === "offers_found") {
    for (const [index, offer] of (flights.offers ?? []).entries()) {
      const amount = Number(offer.amount);
      const duration = Number(offer.totalDurationMinutes);
      legs.push({
        id: String(offer.id ?? `flight-${index}`),
        fromNode: originNode,
        toNode: destinationNode,
        mode: "flight", fromLabel: research.origin, toLabel: research.destination,
        ...(Number.isFinite(duration) && duration > 0 ? { durationMinutes: duration } : {}),
        ...(Number.isFinite(amount) && amount >= 0 ? { price: amount, currency: String(offer.currency ?? "") } : {}),
        provider: String(flights.provider ?? "Flight provider"), evidence: "provider_offer",
      });
    }
  }

  // Only the requested endpoints are shared across these providers. Transfer
  // nodes and timezone-aware timestamps are not yet exposed consistently, so
  // the engine intentionally returns verified direct options only for now.
  return buildJourneyOptions({
    legs, originNode, destinationNode,
    priority: input.priority ?? "balanced",
    maxLegs: 1, maxOptions: 30,
  });
}
