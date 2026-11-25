import { searchSerpApiFlights } from "./serpApiFlights.js";
import { searchIndianTrains } from "./railAvailability.js";
import { searchPublicBuses } from "../publicBus.js";
import type { TransportGateway } from "./gatewayDiscovery.js";
import { normalizePublicBusResult, normalizeRailSearchResult, normalizeSerpApiFlightResult } from "./providerAdapters.js";
import type { ProviderResult, NormalizedServiceLeg } from "./providerContract.js";
import { buildNormalizedJourneyGraph } from "./normalizedJourneyGraph.js";
import type { JourneyOption } from "./journeyGraph.js";

type Point = { lat: number; lng: number };

/** True only when a provider's first flight segment departs on the selected local date. */
export function isFlightDepartureOnDate(departure: string | undefined, travelDate: string): boolean {
  return Boolean(departure && (departure.startsWith(`${travelDate} `) || departure.startsWith(`${travelDate}T`)));
}
type GatewaySearchResult = {
  mode: "flight" | "train" | "bus";
  originGateway: TransportGateway;
  destinationGateway: TransportGateway;
  serviceProvider: string;
  status: "offers_found" | "no_service_found" | "provider_unavailable";
  serviceCount: number;
  services: Array<Record<string, unknown>>;
  serviceOptions: JourneyOption[];
  serviceGraphDiagnostics?: { invalid: number; impossibleConnection: number; unsupportedConnection: number };
  normalizedProviderResult?: ProviderResult<NormalizedServiceLeg>;
  access: {
    origin: { status: "route_found" | "unavailable"; distanceKm?: number; durationMinutes?: number };
    destination: { status: "route_found" | "unavailable"; distanceKm?: number; durationMinutes?: number };
  };
  connectionAssessment: "access_routes_found_timing_unverified" | "access_route_incomplete" | "service_not_found";
  caveat: string;
};

function buildGatewayServiceGraph(result?: ProviderResult<NormalizedServiceLeg>) {
  if (!result || result.status !== "results" || result.items.length === 0) return { serviceOptions: [] as JourneyOption[] };
  const first = result.items[0];
  const firstOffer = result.items.filter(item => item.sourceReference === first.sourceReference);
  const originNode = firstOffer[0]?.fromNodeId;
  const destinationNode = firstOffer[firstOffer.length - 1]?.toNodeId;
  if (!originNode || !destinationNode || originNode === destinationNode) return { serviceOptions: [] as JourneyOption[] };
  const built = buildNormalizedJourneyGraph({ providerResults: [result], originNode, destinationNode, maxLegs: 4, maxOptions: 20 });
  return { serviceOptions: built.graph.options, serviceGraphDiagnostics: built.graph.discarded };
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("PROVIDER_TIMEOUT")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function roadAccess(from: Point, to: Point) {
  try {
    const url = new URL(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`);
    url.searchParams.set("overview", "false");
    url.searchParams.set("steps", "false");
    const response = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!response.ok) throw new Error("OSRM_HTTP_ERROR");
    const body = await response.json() as { code?: string; routes?: Array<{ distance: number; duration: number }> };
    const route = body.routes?.[0];
    if (body.code !== "Ok" || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      return { status: "unavailable" as const };
    }
    return { status: "route_found" as const, distanceKm: Math.round(route.distance / 100) / 10, durationMinutes: Math.round(route.duration / 60) };
  } catch {
    return { status: "unavailable" as const };
  }
}

export function selectGateways(items: TransportGateway[], mode: TransportGateway["mode"]) {
  return items.filter(item => item.mode === mode)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 4);
}

export async function searchGatewayJourneys(input: {
  origin: Point;
  destination: Point;
  originLabel: string;
  destinationLabel: string;
  travelDate: string;
  adults?: number;
  currency?: string;
  gateways: { origin: TransportGateway[]; destination: TransportGateway[] };
}) {
  const results: GatewaySearchResult[] = [];
  const tasks: Promise<void>[] = [];
  const addPair = (mode: "flight" | "train" | "bus", from: TransportGateway, to: TransportGateway) => {
    tasks.push((async () => {
      let provider = mode === "flight" ? "SerpApi" : mode === "train" ? "RailCore" : "Public GTFS";
      let status: GatewaySearchResult["status"] = "provider_unavailable";
      let services: Array<Record<string, unknown>> = [];
      let normalizedProviderResult: ProviderResult<NormalizedServiceLeg> | undefined;
      try {
        if (mode === "flight") {
          if (!from.iataCode || !to.iataCode || from.iataCode === to.iataCode) {
            status = "provider_unavailable";
            normalizedProviderResult = {
              provider: "SerpApi", retrievedAt: new Date().toISOString(), evidence: "live_offer",
              status: "unsupported", reason: "Both gateway endpoints must have verified IATA codes before a flight provider query can be made.",
            };
          } else {
            const result = await withTimeout(searchSerpApiFlights({
              origin: from.iataCode, destination: to.iataCode, departureDate: input.travelDate,
              adults: input.adults ?? 1, currency: input.currency ?? "INR", allowConnections: false,
            }), 8000);
            // Providers can return stale/cached offers for a different departure day.
            // Enforce the selected local departure date before exposing or graphing them.
            const dateScopedOffers = result.status === "offers_found"
              ? result.offers.filter(offer => isFlightDepartureOnDate(offer.segments[0]?.departure, input.travelDate))
              : [];
            const dateScopedResult = result.status === "offers_found"
              ? { ...result, offers: dateScopedOffers }
              : result;
            normalizedProviderResult = await normalizeSerpApiFlightResult(dateScopedResult);
            status = result.status === "offers_found"
              ? dateScopedOffers.length ? "offers_found" : "no_service_found"
              : result.status === "no_offers" ? "no_service_found" : "provider_unavailable";
            if (dateScopedOffers.length) services = dateScopedOffers.slice(0, 5).map(offer => ({
              id: offer.id, amount: offer.amount, currency: offer.currency, carrier: offer.owner,
              totalDurationMinutes: offer.totalDurationMinutes, segments: offer.segments,
            }));
          }
        } else if (mode === "train") {
          const result = await withTimeout(searchIndianTrains({ origin: from.name, destination: to.name, travelDate: input.travelDate }), 8000);
          normalizedProviderResult = normalizeRailSearchResult(result, { origin: from.name, destination: to.name });
          status = result.status === "offers_found" ? "offers_found"
            : result.status === "no_service_found" ? "no_service_found" : "provider_unavailable";
          if (result.status === "offers_found") services = result.trains.slice(0, 5).map(train => ({
            trainNumber: train.trainNumber, trainName: train.trainName,
            departureTime: train.departureTime, arrivalTime: train.arrivalTime,
            durationMinutes: train.durationMinutes, classes: train.classes,
          }));
        } else {
          const result = await withTimeout(searchPublicBuses({ origin: from.name, destination: to.name, travelDate: input.travelDate }), 8000);
          provider = result.provider;
          normalizedProviderResult = normalizePublicBusResult(result);
          status = result.status === "offers_found" ? "offers_found"
            : result.status === "no_service_found" ? "no_service_found" : "provider_unavailable";
          if (result.status === "offers_found") services = result.offers.slice(0, 5).map(offer => ({
            route: offer.route, headsign: offer.headsign, departureTime: offer.departureTime,
            arrivalTime: offer.arrivalTime, fromStop: offer.fromStop, toStop: offer.toStop,
          }));
        }
      } catch (error) {
        status = "provider_unavailable";
        const evidence = mode === "flight" ? "live_offer" as const : "published_schedule" as const;
        const retrievedAt = new Date().toISOString();
        const errorCode = error instanceof Error ? error.message : "UNKNOWN_PROVIDER_ERROR";
        normalizedProviderResult = errorCode === "PROVIDER_TIMEOUT"
          ? { provider, retrievedAt, evidence, status: "timeout", retryable: true }
          : { provider, retrievedAt, evidence, status: "provider_error", retryable: true, errorCode };
      }
      if (status !== "offers_found") {
        results.push({
          mode, originGateway: from, destinationGateway: to, serviceProvider: provider,
          status, serviceCount: 0, services: [], serviceOptions: [], normalizedProviderResult,
          access: { origin: { status: "unavailable" }, destination: { status: "unavailable" } },
          connectionAssessment: "service_not_found",
          caveat: status === "no_service_found"
            ? "No matching service was returned for this gateway pair. This does not prove that no service exists."
            : "The service provider could not complete this gateway search.",
        });
        return;
      }
      const [originAccess, destinationAccess] = await Promise.all([
        roadAccess(input.origin, { lat: from.lat, lng: from.lng }),
        roadAccess({ lat: to.lat, lng: to.lng }, input.destination),
      ]);
      const accessComplete = originAccess.status === "route_found" && destinationAccess.status === "route_found";
      const serviceGraph = buildGatewayServiceGraph(normalizedProviderResult);
      results.push({
        mode, originGateway: from, destinationGateway: to, serviceProvider: provider,
        status, serviceCount: services.length, services, ...serviceGraph, normalizedProviderResult,
        access: { origin: originAccess, destination: destinationAccess },
        connectionAssessment: accessComplete ? "access_routes_found_timing_unverified" : "access_route_incomplete",
        caveat: accessComplete
          ? "Provider service and both road access routes were found. Exact terminal transfer timing, local traffic, check-in cutoffs and schedule compatibility are not yet verified; treat this as a candidate itinerary, not a guaranteed connection."
          : "A provider service was found, but one or both road access routes could not be verified. This is not yet a complete journey.",
      });
    })());
  };

  // Keep gateway suggestions inside the traveler-selected country when known.
  // A border-adjacent airport must not be selected solely because it is nearby.
  const originCountry = /\bIndia\b/i.test(input.originLabel) ? "IN" : undefined;
  const destinationCountry = /\bIndia\b/i.test(input.destinationLabel) ? "IN" : undefined;
  const originGateways = originCountry ? input.gateways.origin.filter(item => !item.countryCode || item.countryCode === originCountry) : input.gateways.origin;
  const destinationGateways = destinationCountry ? input.gateways.destination.filter(item => !item.countryCode || item.countryCode === destinationCountry) : input.gateways.destination;

  for (const mode of ["flight", "train", "bus"] as const) {
    const origins = selectGateways(originGateways, mode);
    const destinations = selectGateways(destinationGateways, mode);
    const pairs = origins.flatMap(from => destinations
      .filter(to => from.id !== to.id)
      .map(to => ({ from, to, distance: from.distanceKm + to.distanceKm })))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    for (const pair of pairs) addPair(mode, pair.from, pair.to);
  }
  await Promise.all(tasks);
  results.sort((a, b) => {
    const rank = (item: GatewaySearchResult) => item.connectionAssessment === "access_routes_found_timing_unverified" ? 0 : item.connectionAssessment === "access_route_incomplete" ? 1 : 2;
    return rank(a) - rank(b) || a.originGateway.distanceKm + a.destinationGateway.distanceKm - b.originGateway.distanceKm - b.destinationGateway.distanceKm;
  });
  return {
    retrievedAt: new Date().toISOString(),
    originLabel: input.originLabel,
    destinationLabel: input.destinationLabel,
    searchedGatewayPairs: tasks.length,
    candidates: results,
    limitations: [
      "Only the two nearest mapped gateways per mode at each endpoint are searched in this beta.",
      "Mapped infrastructure is not proof of a scheduled service; only provider-returned services are listed.",
      "Road access estimates do not verify departure-time compatibility, terminal transfers, traffic, check-in cutoffs or road conditions.",
      "A candidate is not a guaranteed end-to-end connection. Exact schedule and transfer validation is a required next step.",
      "No fares are inferred for road transfers or missing provider prices.",
    ],
  };
}
