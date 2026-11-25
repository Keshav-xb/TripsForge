import type { ProviderResult, NormalizedServiceLeg } from "./providerContract.js";
import type { SerpApiFlightSearchResult } from "./serpApiFlights.js";
import type { RailSearchResult } from "./railAvailability.js";
import type { BusResult } from "../publicBus.js";

function currencyAmount(amount?: string, currency?: string): Pick<NormalizedServiceLeg, "price" | "currency"> | {} {
  const price = amount === undefined ? undefined : Number(amount);
  if (price === undefined || !Number.isFinite(price) || price < 0 || !currency || !/^[A-Z]{3}$/.test(currency)) return {};
  return { price, currency };
}

function offsetTime(value?: string): string | undefined {
  if (!value || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? value : undefined;
}

export function normalizeSerpApiFlightResult(
  result: SerpApiFlightSearchResult,
): ProviderResult<NormalizedServiceLeg> {
  const retrievedAt = result.status === "offers_found" || result.status === "no_offers"
    ? result.checkedAt : new Date().toISOString();
  const base = { provider: "SerpApi", retrievedAt, evidence: "live_offer" as const };
  switch (result.status) {
    case "provider_not_configured":
      return { ...base, status: "not_configured", reason: result.message };
    case "no_offers":
      return { ...base, status: "empty", message: "The provider returned no matching flight offers for this search." };
    case "offers_found": {
      const items = result.offers.map(offer => {
        const amount = currencyAmount(offer.amount, offer.currency);
        const departureAt = offsetTime(offer.segments[0]?.departure);
        const arrivalAt = offsetTime(offer.segments[offer.segments.length - 1]?.arrival);
        const durationMinutes = offer.totalDurationMinutes;
        const leg: NormalizedServiceLeg = {
          id: offer.id,
          provider: "SerpApi",
          mode: "flight",
          fromNodeId: \`airport:iata:\${result.originCode}\`,
          toNodeId: \`airport:iata:\${result.destinationCode}\`,
          fromLabel: result.originCode,
          toLabel: result.destinationCode,
          ...(departureAt ? { departureAt } : {}),
          ...(arrivalAt ? { arrivalAt } : {}),
          ...(Number.isFinite(durationMinutes) && durationMinutes! > 0 ? { durationMinutes } : {}),
          ...amount,
          evidence: "live_offer",
          retrievedAt,
          sourceReference: offer.segments.map(segment => segment.flightNumber).filter(Boolean).join(",") || offer.id,
        };
        return leg;
      });
      return { ...base, status: "results", items };
    }
  }
}

export function normalizeRailSearchResult(
  result: RailSearchResult,
  labels: { origin: string; destination: string },
): ProviderResult<NormalizedServiceLeg> {
  const retrievedAt = "retrievedAt" in result ? result.retrievedAt : new Date().toISOString();
  const base = { provider: "RailCore", retrievedAt, evidence: "published_schedule" as const };
  if (result.status === "provider_not_configured") return { ...base, status: "not_configured", reason: result.message };
  if (result.status === "lookup_unavailable") return { ...base, status: "provider_error", retryable: true, errorCode: "RAIL_LOOKUP_UNAVAILABLE" };
  if (result.status === "no_service_found") return { ...base, status: "empty", message: result.disclaimer };
  if (!result.originStationCode || !result.destinationStationCode) {
    return { ...base, status: "unsupported", reason: "The rail provider did not return stable station codes; results cannot be joined safely into a transfer graph." };
  }
  const items = result.trains.map(train => ({
    id: \`railcore:\${train.trainNumber}:\${result.originStationCode}:\${result.destinationStationCode}\`,
    provider: "RailCore",
    mode: "train" as const,
    fromNodeId: \`rail:railcore:\${result.originStationCode}\`,
    toNodeId: \`rail:railcore:\${result.destinationStationCode}\`,
    fromLabel: labels.origin,
    toLabel: labels.destination,
    ...(Number.isFinite(train.durationMinutes) && train.durationMinutes! > 0 ? { durationMinutes: train.durationMinutes } : {}),
    evidence: "published_schedule" as const,
    retrievedAt,
    sourceReference: train.trainNumber,
  }));
  return { ...base, status: "results", items };
}

export function normalizePublicBusResult(
  result: BusResult,
): ProviderResult<NormalizedServiceLeg> {
  const retrievedAt = "retrievedAt" in result ? result.retrievedAt : new Date().toISOString();
  const base = { provider: result.provider, retrievedAt, evidence: "published_schedule" as const };
  if (result.status === "feed_not_available") return { ...base, status: "provider_error", retryable: true, errorCode: "GTFS_FEED_UNAVAILABLE" };
  if (result.status === "no_service_found") return { ...base, status: "empty", message: result.message };
  const items = result.offers.flatMap(offer => {
    if (!offer.feedId || !offer.fromStopId || !offer.toStopId || offer.fromStopId === offer.toStopId) return [];
    return [{
      id: \`gtfs:\${offer.feedId}:\${offer.route}:\${offer.departureTime}:\${offer.fromStopId}:\${offer.toStopId}\`,
      provider: result.provider,
      mode: "bus" as const,
      fromNodeId: \`bus:gtfs:\${offer.feedId}:\${offer.fromStopId}\`,
      toNodeId: \`bus:gtfs:\${offer.feedId}:\${offer.toStopId}\`,
      fromLabel: offer.fromStop,
      toLabel: offer.toStop,
      evidence: "published_schedule" as const,
      retrievedAt,
      sourceReference: offer.route,
    }];
  });
  return items.length
    ? { ...base, status: "results", items }
    : { ...base, status: "unsupported", reason: "The timetable provider did not expose stable GTFS stop identities for these results." };
}
