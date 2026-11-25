import type { ProviderResult, NormalizedServiceLeg } from "./providerContract.js";
import type { SerpApiFlightSearchResult } from "./serpApiFlights.js";
import type { RailSearchResult } from "./railAvailability.js";
import type { BusResult } from "../publicBus.js";
import { localServiceTimeToIso } from "./localServiceTime.js";


function timeMatchesAt(localTime: string, instant: number, timezone: string): boolean {
  const match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(localTime);
  if (!match) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return Number(values.hour) === Number(match[1]) && Number(values.minute) === Number(match[2])
      && Number(values.second) === Number(match[3] ?? 0);
  } catch {
    return false;
  }
}

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
          fromNodeId: `airport:iata:${result.originCode}`,
          toNodeId: `airport:iata:${result.destinationCode}`,
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
  const items = result.trains.map(train => {
    // RailCore covers Indian rail services; its published station clock times are IST.
    const departureAt = train.departureTime
      ? localServiceTimeToIso(result.travelDate, train.departureTime, "Asia/Kolkata")
      : undefined;
    let arrivalAt: string | undefined;
    if (departureAt && train.arrivalTime && Number.isFinite(train.durationMinutes) && train.durationMinutes! > 0) {
      const expectedArrival = Date.parse(departureAt) + train.durationMinutes! * 60_000;
      if (timeMatchesAt(train.arrivalTime, expectedArrival, "Asia/Kolkata")) arrivalAt = new Date(expectedArrival).toISOString();
    }
    return ({
    id: `railcore:${train.trainNumber}:${result.originStationCode}:${result.destinationStationCode}`,
    provider: "RailCore",
    mode: "train" as const,
    fromNodeId: `rail:railcore:${result.originStationCode}`,
    toNodeId: `rail:railcore:${result.destinationStationCode}`,
    fromLabel: labels.origin,
    toLabel: labels.destination,
    ...(departureAt ? { departureAt } : {}),
    ...(arrivalAt ? { arrivalAt } : {}),
    ...(Number.isFinite(train.durationMinutes) && train.durationMinutes! > 0 ? { durationMinutes: train.durationMinutes } : {}),
    evidence: "published_schedule" as const,
    retrievedAt,
    sourceReference: train.trainNumber,
  });
  });
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
      id: `gtfs:${offer.feedId}:${offer.route}:${offer.departureTime}:${offer.fromStopId}:${offer.toStopId}`,
      provider: result.provider,
      mode: "bus" as const,
      fromNodeId: `bus:gtfs:${offer.feedId}:${offer.fromStopId}`,
      toNodeId: `bus:gtfs:${offer.feedId}:${offer.toStopId}`,
      fromLabel: offer.fromStop,
      toLabel: offer.toStop,
      evidence: "published_schedule" as const,
      retrievedAt,
      ...(offer.serviceDate && offer.fromTimezone ? { departureAt: localServiceTimeToIso(offer.serviceDate, offer.departureTime, offer.fromTimezone) } : {}),
      ...(offer.serviceDate && offer.toTimezone ? { arrivalAt: localServiceTimeToIso(offer.serviceDate, offer.arrivalTime, offer.toTimezone) } : {}),
      ...(offer.serviceDate && offer.fromTimezone && offer.toTimezone
        ? (() => {
          const departure = localServiceTimeToIso(offer.serviceDate, offer.departureTime, offer.fromTimezone!);
          const arrival = localServiceTimeToIso(offer.serviceDate, offer.arrivalTime, offer.toTimezone!);
          const minutes = departure && arrival ? (Date.parse(arrival) - Date.parse(departure)) / 60_000 : undefined;
          return Number.isFinite(minutes) && minutes! > 0 ? { durationMinutes: minutes } : {};
        })() : {}),
      sourceReference: offer.route,
    }];
  });
  return items.length
    ? { ...base, status: "results", items }
    : { ...base, status: "unsupported", reason: "The timetable provider did not expose stable GTFS stop identities for these results." };
}
