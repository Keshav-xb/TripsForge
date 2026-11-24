import { searchSerpApiFlights } from "./serpApiFlights.js";
import { searchIndianTrains } from "./railAvailability.js";
import { searchPublicBuses } from "../publicBus.js";
import type { TransportGateway } from "./gatewayDiscovery.js";

type Point = { lat: number; lng: number };
type GatewaySearchResult = {
  mode: "flight" | "train" | "bus";
  originGateway: TransportGateway;
  destinationGateway: TransportGateway;
  serviceProvider: string;
  status: "offers_found" | "no_service_found" | "provider_unavailable";
  serviceCount: number;
  services: Array<Record<string, unknown>>;
  access: {
    origin: { status: "route_found" | "unavailable"; distanceKm?: number; durationMinutes?: number };
    destination: { status: "route_found" | "unavailable"; distanceKm?: number; durationMinutes?: number };
  };
  connectionAssessment: "access_routes_found_timing_unverified" | "access_route_incomplete" | "service_not_found";
  caveat: string;
};

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
    .slice(0, 2);
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
      try {
        if (mode === "flight") {
          if (!from.iataCode || !to.iataCode || from.iataCode === to.iataCode) {
            status = "no_service_found";
          } else {
            const result = await withTimeout(searchSerpApiFlights({
              origin: from.iataCode, destination: to.iataCode, departureDate: input.travelDate,
              adults: input.adults ?? 1, currency: input.currency ?? "INR", allowConnections: false,
            }), 8000);
            status = result.status === "offers_found" ? "offers_found"
              : result.status === "no_offers" ? "no_service_found" : "provider_unavailable";
            if (result.status === "offers_found") services = result.offers.slice(0, 5).map(offer => ({
              id: offer.id, amount: offer.amount, currency: offer.currency, carrier: offer.owner,
              totalDurationMinutes: offer.totalDurationMinutes, segments: offer.segments,
            }));
          }
        } else if (mode === "train") {
          const result = await withTimeout(searchIndianTrains({ origin: from.name, destination: to.name, travelDate: input.travelDate }), 8000);
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
          status = result.status === "offers_found" ? "offers_found"
            : result.status === "no_service_found" ? "no_service_found" : "provider_unavailable";
          if (result.status === "offers_found") services = result.offers.slice(0, 5).map(offer => ({
            route: offer.route, headsign: offer.headsign, departureTime: offer.departureTime,
            arrivalTime: offer.arrivalTime, fromStop: offer.fromStop, toStop: offer.toStop,
          }));
        }
      } catch {
        status = "provider_unavailable";
      }
      if (status !== "offers_found") {
        results.push({
          mode, originGateway: from, destinationGateway: to, serviceProvider: provider,
          status, serviceCount: 0, services: [],
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
      results.push({
        mode, originGateway: from, destinationGateway: to, serviceProvider: provider,
        status, serviceCount: services.length, services,
        access: { origin: originAccess, destination: destinationAccess },
        connectionAssessment: accessComplete ? "access_routes_found_timing_unverified" : "access_route_incomplete",
        caveat: accessComplete
          ? "Provider service and both road access routes were found. Exact terminal transfer timing, local traffic, check-in cutoffs and schedule compatibility are not yet verified; treat this as a candidate itinerary, not a guaranteed connection."
          : "A provider service was found, but one or both road access routes could not be verified. This is not yet a complete journey.",
      });
    })());
  };

  for (const mode of ["flight", "train", "bus"] as const) {
    const origins = selectGateways(input.gateways.origin, mode);
    const destinations = selectGateways(input.gateways.destination, mode);
    const pairs = origins.flatMap(from => destinations
      .filter(to => from.id !== to.id)
      .map(to => ({ from, to, distance: from.distanceKm + to.distanceKm })))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
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
