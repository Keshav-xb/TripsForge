import { searchWeb } from "../lib/webIntelligence";
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildRouteResearch, type InfrastructureEvidence, type TransportResearchMode } from "../../server/lib/transport/routeResearch.js";
import { buildTravelIntelligence } from "../../server/lib/transport/travelIntelligence.js";
import { searchSerpApiFlights } from "../../server/lib/transport/serpApiFlights.js";
import { convertFlightPrice } from "../../server/lib/transport/currencyConversion.js";
import { searchIndianTrains } from "../../server/lib/transport/railAvailability.js";
import { searchPublicBuses } from "../../server/lib/publicBus.js";
import { discoverGateways } from "../../server/lib/transport/gatewayDiscovery.js";
import { searchGatewayJourneys } from "../../server/lib/transport/gatewayJourneys.js";

type Point = { lat: number; lng: number };
type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: { osm_id?: number; osm_type?: string; name?: string; street?: string; city?: string; state?: string; country?: string; postcode?: string; type?: string };
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function nearbyPlaces(input: { lat: number; lng: number; category: string; radius?: number }) {
  const lat = Number(input.lat), lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error("INVALID_SEARCH_COORDINATES");
  }
  if (!["hospital", "police", "pharmacy", "attraction"].includes(input.category)) throw new Error("INVALID_PLACE_CATEGORY");
  const radius = Math.min(10000, Math.max(500, Number(input.radius) || 5000));
  const filters: Record<string, string> = {
    hospital: '["amenity"="hospital"]',
    police: '["amenity"="police"]',
    pharmacy: '["amenity"="pharmacy"]',
    attraction: '["tourism"~"attraction|museum|viewpoint"]',
  };
  const filter = filters[input.category] ?? filters.hospital;
  const query = `[out:json][timeout:20];(node${filter}(around:${radius},${lat},${lng});way${filter}(around:${radius},${lat},${lng});relation${filter}(around:${radius},${lat},${lng}););out center tags;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "TripsForge/1.0 (travel planning MVP)" },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`OVERPASS_HTTP_${response.status}`);
  const data = await response.json() as { elements?: OverpassElement[] };
  return (data.elements ?? []).flatMap(element => {
    const point = element.center ?? (element.lat !== undefined && element.lon !== undefined ? { lat: element.lat, lon: element.lon } : undefined);
    if (!point) return [];
    const tags = element.tags ?? {};
    const name = tags.name ?? tags["name:en"] ?? tags.official_name;
    if (!name) return [];
    const address = [tags["addr:street"], tags["addr:city"] ?? tags["addr:town"]].filter(Boolean).join(", ");
    return [{
      id: `${element.type}-${element.id}`,
      name,
      category: input.category,
      address,
      location: { lat: point.lat, lng: point.lon },
      source: "OpenStreetMap",
    }];
  }).slice(0, 50);
}

function requestData(req: IncomingMessage) {
  const params = new URL(req.url ?? "", "https://tripsforge.local").searchParams;
  const raw = params.get("input");
  if (raw && raw.length > 16000) throw new Error("REQUEST_INPUT_TOO_LARGE");
  let parsed: unknown = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { throw new Error("INVALID_REQUEST_JSON"); }
  const batched = params.get("batch") === "1";
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_REQUEST_INPUT");
  const record = parsed as Record<string, unknown>;
  const payload = batched ? (record["0"] ?? record) : record;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("INVALID_REQUEST_INPUT");
  const envelope = payload as Record<string, unknown>;
  const input = envelope.json ?? envelope;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_REQUEST_INPUT");
  return { input: input as Record<string, unknown>, batched };
}
function send(req: IncomingMessage, res: ServerResponse, status: number, value: unknown) {
  const batched = new URL(req.url ?? "", "https://tripsforge.local").searchParams.get("batch") === "1";
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.end(JSON.stringify(batched ? [value] : value));
}
function trpcData(value: unknown) { return { result: { data: { json: value } } }; }
function label(p: PhotonFeature["properties"]) {
  return [p.name, p.street, p.city, p.state, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
}
const photonSearchCache = new Map<string, { expiresAt: number; value: unknown }>();
const photonSearchInFlight = new Map<string, Promise<unknown>>();
async function photon(url: URL, timeoutMs = 10000) {
  const response = await fetch(url, { headers: { "User-Agent": "TripsForge/1.0 (travel planning MVP)" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`OPEN_MAP_DATA_HTTP_${response.status}`);
  return response.json();
}
async function photonSearch(url: URL) {
  const key = url.toString();
  const cached = photonSearchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const existing = photonSearchInFlight.get(key);
  if (existing) return existing;
  const request = photon(url, 6000).then(value => {
    photonSearchCache.set(key, { value, expiresAt: Date.now() + 5 * 60_000 });
    if (photonSearchCache.size > 200) {
      const oldest = photonSearchCache.keys().next().value;
      if (oldest) photonSearchCache.delete(oldest);
    }
    return value;
  }).finally(() => photonSearchInFlight.delete(key));
  photonSearchInFlight.set(key, request);
  return request;
}

type OpenMeteoGeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  feature_code?: string;
};

async function openMeteoLocationSearch(query: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    headers: { "User-Agent": "TripsForge/1.0 (travel planning MVP)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`OPEN_METEO_GEOCODING_HTTP_${response.status}`);
  const data = await response.json() as { results?: OpenMeteoGeocodingResult[] };
  return (data.results ?? []).map(item => {
    const secondary = [item.admin2, item.admin1, item.country].filter(Boolean).join(", ");
    const description = [item.name, secondary].filter(Boolean).join(", ");
    return {
      placeId: `geonames:${item.id}`,
      description,
      location: { lat: item.latitude, lng: item.longitude },
      name: item.name,
      secondary,
    };
  });
}
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? "", "https://tripsforge.local").pathname.replace(/^\/api\/trpc\//, "");
  const requestId = globalThis.crypto?.randomUUID?.() ?? `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader("x-tripsforge-request-id", requestId);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    res.setHeader("cache-control", "no-store");
    return res.end();
  }
  if (req.method !== "GET") {
    return send(req, res, 405, { error: { json: { message: "METHOD_NOT_ALLOWED", code: "METHOD_NOT_SUPPORTED" } } });
  }
  try {
    const { input } = requestData(req);
    if (path === "web.research") {
      const result = await searchWeb(input.query, input.maxResults);
      return send(req, res, 200, trpcData(result));
    }
    if (path === "location.search") {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", String(input.query ?? ""));
      url.searchParams.set("limit", "8");
      url.searchParams.set("lang", "en");
      const query = String(input.query ?? "").trim();
      if (query.length < 2 || query.length > 120) {
        return send(req, res, 200, trpcData({ provider: "OpenStreetMap / Photon", retrievedAt: new Date().toISOString(), results: [] }));
      }
      let results: Array<{ placeId: string; description: string; location: Point; name: string; secondary: string }>;
      let provider = "OpenStreetMap / Photon";
      try {
        const data = await photonSearch(url) as { features?: PhotonFeature[] };
        results = (data.features ?? []).map(feature => ({
          placeId: feature.properties.osm_type && feature.properties.osm_id ? `${feature.properties.osm_type}:${feature.properties.osm_id}` : "",
          description: label(feature.properties),
          location: { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] },
          name: feature.properties.name ?? label(feature.properties),
          secondary: [feature.properties.city, feature.properties.state, feature.properties.country].filter(Boolean).join(", "),
        })).filter(item => item.description);
      } catch {
        results = await openMeteoLocationSearch(query);
        provider = "Open-Meteo Geocoding (fallback)";
      }
      return send(req, res, 200, trpcData({
        provider,
        retrievedAt: new Date().toISOString(),
        results,
      }));
    }
    if (path === "location.resolve") {
      let feature: PhotonFeature | undefined;
      const placeId = String(input.placeId ?? "");
      if (/^[NRW]:\d+$/.test(placeId)) {
        const [osm_type, osm_id] = placeId.split(":");
        const url = new URL("https://photon.komoot.io/api/");
        url.searchParams.set("osm_id", osm_id);
        url.searchParams.set("osm_type", osm_type);
        const data = await photon(url) as { features?: PhotonFeature[] };
        feature = data.features?.[0];
      }
      if (!feature && input.query) {
        const url = new URL("https://photon.komoot.io/api/");
        url.searchParams.set("q", String(input.query));
        url.searchParams.set("limit", "1");
        const data = await photon(url) as { features?: PhotonFeature[] };
        feature = data.features?.[0];
      }
      if (!feature) throw new Error("LOCATION_NOT_FOUND");
      const p = feature.properties;
      return send(req, res, 200, trpcData({
        provider: "OpenStreetMap / Photon",
        retrievedAt: new Date().toISOString(),
        placeId: p.osm_type && p.osm_id ? `${p.osm_type}:${p.osm_id}` : "",
        formattedAddress: label(p),
        location: { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] },
        city: p.city ?? "",
        country: p.country ?? "",
        countryCode: "",
        types: [p.type ?? "place"],
      }));
    }
    if (path === "places.nearby") {
      const places = await nearbyPlaces(input as { lat: number; lng: number; category: string; radius?: number });
      return send(req, res, 200, trpcData({ provider: "OpenStreetMap / Overpass", retrievedAt: new Date().toISOString(), places }));
    }
    if (path === "trains.search") {
      const origin = String(input.origin ?? "").trim();
      const destination = String(input.destination ?? "").trim();
      const travelDate = String(input.travelDate ?? "");
      if (origin.length < 2 || origin.length > 180 || destination.length < 2 || destination.length > 180) throw new Error("INVALID_ROUTE_LABELS");
      const result = await searchIndianTrains({ origin, destination, travelDate });
      res.setHeader("cache-control", "no-store");
      return send(req, res, 200, trpcData(result));
    }
    if (path === "buses.search") {
      const origin = String(input.origin ?? "").trim();
      const destination = String(input.destination ?? "").trim();
      const travelDate = String(input.travelDate ?? "");
      if (origin.length < 2 || origin.length > 180 || destination.length < 2 || destination.length > 180) throw new Error("INVALID_ROUTE_LABELS");
      const result = await searchPublicBuses({ origin, destination, travelDate });
      res.setHeader("cache-control", "public, max-age=300, s-maxage=300");
      return send(req, res, 200, trpcData(result));
    }
    if (path === "flights.search") {
      const origin = String(input.origin ?? "").trim();
      const destination = String(input.destination ?? "").trim();
      const departureDate = String(input.departureDate ?? "");
      const adults = Number(input.adults ?? 1);
      const displayCurrency = String(input.currency ?? "USD").toUpperCase();
      if (!/^[A-Z]{3}$/.test(displayCurrency)) throw new Error("INVALID_DISPLAY_CURRENCY");
      const result = await searchSerpApiFlights({ origin, destination, departureDate, adults, currency: displayCurrency });
      if (result.status === "offers_found") {
        const offers = await Promise.all(result.offers.map(async offer => ({
          ...offer,
          priceDisplay: await convertFlightPrice(offer.amount, offer.currency, displayCurrency),
        })));
        res.setHeader("cache-control", "no-store");
        return send(req, res, 200, trpcData({ ...result, offers, displayCurrency }));
      }
      res.setHeader("cache-control", "no-store");
      return send(req, res, 200, trpcData({ ...result, displayCurrency }));
    }
    if (path === "route.intelligence") {
      const research = input.research as Parameters<typeof buildTravelIntelligence>[0] | undefined;
      if (!research || typeof research !== "object" || !Array.isArray(research.modes) || typeof research.origin !== "string" || typeof research.destination !== "string" || typeof research.travelDate !== "string") {
        throw new Error("INVALID_RESEARCH_EVIDENCE");
      }
      const report = buildTravelIntelligence(research);
      return send(req, res, 200, trpcData(report));
    }
    if (path === "route.gatewayJourneys") {
      const origin = input.origin as Point | undefined;
      const destination = input.destination as Point | undefined;
      const validPoint = (point: Point | undefined) => !!point &&
        Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
        Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
      if (!validPoint(origin) || !validPoint(destination)) throw new Error("INVALID_GATEWAY_COORDINATES");
      const originLabel = String(input.originLabel ?? "").trim();
      const destinationLabel = String(input.destinationLabel ?? "").trim();
      const travelDate = String(input.travelDate ?? "");
      const date = new Date(travelDate + "T00:00:00Z");
      if (originLabel.length < 2 || destinationLabel.length < 2) throw new Error("INVALID_ROUTE_LABELS");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== travelDate) throw new Error("INVALID_TRAVEL_DATE");
      const radiusKm = Math.min(300, Math.max(25, Number(input.radiusKm ?? 150)));
      const gateways = await discoverGateways({ origin: origin!, destination: destination!, radiusKm });
      const result = await searchGatewayJourneys({
        origin: origin!, destination: destination!, originLabel, destinationLabel, travelDate,
        adults: Math.min(9, Math.max(1, Number(input.adults ?? 1))),
        currency: String(input.currency ?? "INR").toUpperCase(),
        gateways: { origin: gateways.origin, destination: gateways.destination },
      });
      res.setHeader("cache-control", "no-store");
      return send(req, res, 200, trpcData({ ...result, gatewayRadiusKm: gateways.radiusKm }));
    }
    if (path === "route.gateways") {
      const origin = input.origin as Point | undefined;
      const destination = input.destination as Point | undefined;
      const validPoint = (point: Point | undefined) => !!point &&
        Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
        Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
      if (!validPoint(origin) || !validPoint(destination)) throw new Error("INVALID_GATEWAY_COORDINATES");
      const radiusKm = Number(input.radiusKm ?? 150);
      if (!Number.isFinite(radiusKm) || radiusKm < 25 || radiusKm > 300) throw new Error("INVALID_GATEWAY_RADIUS");
      const result = await discoverGateways({ origin: origin!, destination: destination!, radiusKm });
      res.setHeader("cache-control", "public, max-age=300, s-maxage=600");
      return send(req, res, 200, trpcData(result));
    }
    if (path === "route.research") {
      const origin = String(input.origin ?? "").trim();
      const destination = String(input.destination ?? "").trim();
      const travelDate = String(input.travelDate ?? "");
      const originPoint = input.originPoint as Point | undefined;
      const destinationPoint = input.destinationPoint as Point | undefined;
      const validPoint = (point: Point | undefined) => !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
      if (origin.length < 2 || origin.length > 180 || destination.length < 2 || destination.length > 180) throw new Error("INVALID_ROUTE_LABELS");
      if (!validPoint(originPoint) || !validPoint(destinationPoint)) throw new Error("INVALID_ROUTE_COORDINATES");
      const resolvedOriginPoint = originPoint!;
      const resolvedDestinationPoint = destinationPoint!;
      // Run routing alongside infrastructure lookups and cap each public-provider
      // request below Vercel's short serverless execution window.
      const roadPromise = (async (): Promise<Parameters<typeof buildRouteResearch>[0]["road"]> => {
        try {
          const coordinates = `${resolvedOriginPoint.lng},${resolvedOriginPoint.lat};${resolvedDestinationPoint.lng},${resolvedDestinationPoint.lat}`;
          const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinates}`);
          url.searchParams.set("overview", "false");
          url.searchParams.set("steps", "false");
          const response = await fetch(url, { signal: AbortSignal.timeout(4500) });
          if (!response.ok) throw new Error(`OSRM_HTTP_${response.status}`);
          const body = await response.text();
          let data: { code: string; routes?: Array<{ distance: number; duration: number }> };
          try {
            data = JSON.parse(body);
          } catch {
            throw new Error("OSRM_INVALID_RESPONSE");
          }
          const route = data.routes?.[0];
          return data.code === "Ok" && route
            ? { status: "route_found", distanceKm: Math.round(route.distance / 100) / 10, durationMinutes: Math.round(route.duration / 60), provider: "OSRM / OpenStreetMap" }
            : { status: "no_route_returned", provider: "OSRM / OpenStreetMap" };
        } catch (error) {
          return { status: "unavailable", provider: "OSRM / OpenStreetMap", reason: error instanceof Error ? error.message : "ROAD_ROUTE_UNAVAILABLE" };
        }
      })();
      const parsedTravelDate = new Date(travelDate + "T00:00:00Z");
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(travelDate) || Number.isNaN(parsedTravelDate.getTime()) || parsedTravelDate.toISOString().slice(0, 10) !== travelDate) throw new Error("INVALID_TRAVEL_DATE");

      // Route research must not inherit the full latency of an optional rail provider.
      // The dedicated trains.search endpoint remains available for a deeper lookup.
      const railPromise = (async () => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            searchIndianTrains({ origin, destination, travelDate }),
            new Promise<Awaited<ReturnType<typeof searchIndianTrains>>>(resolve => {
              timeout = setTimeout(() => resolve({
                status: "lookup_unavailable",
                provider: "RailCore",
                trains: [],
                message: "Train lookup exceeded the route-research time budget. Use the dedicated train search for a full lookup.",
              }), 4000);
            }),
          ]);
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      })();

      const infrastructureQueries: Array<{ kind: TransportResearchMode; filter: string }> = [
        { kind: "flight", filter: '["aeroway"="aerodrome"]' },
        { kind: "train", filter: '["railway"~"station|halt"]' },
        { kind: "bus", filter: '["amenity"="bus_station"]' },
        { kind: "ferry", filter: '["amenity"="ferry_terminal"]' },
      ];
      // Keep the core route response fast. Broad gateway discovery runs through
      // route.gateways independently and must not hold up road/rail results.
      const infrastructure: InfrastructureEvidence[] = infrastructureQueries.map(({ kind }) => ({
        kind, originCount: 0, destinationCount: 0, originExamples: [], destinationExamples: [],
        checked: false, reason: "Gateway discovery is running as a separate network-wide lookup.",
      }));

      const road = await roadPromise;
      const [trainAvailability] = await Promise.all([railPromise]);
      const result = {
        ...buildRouteResearch({ origin, destination, travelDate, road, infrastructure, retrievedAt: new Date().toISOString() }),
        trainAvailability,
        busAvailability: {
          status: "provider_not_configured" as const,
          provider: "RedBus SeatSeller / approved bus partner",
          message: "Bus timetable search requires approved partner API credentials. Nearby bus stations are not treated as proof of a scheduled service.",
        },
      };
      res.setHeader("cache-control", "no-store");
      return send(req, res, 200, trpcData(result));
    }
    if (path === "route.preview") {
      const rawStops = Array.isArray(input.stops) ? input.stops as Array<{ id?: string; title: string; location?: Point; geocode?: boolean }> : [];
      if (rawStops.length < 2) throw new Error("ROUTE_REQUIRES_TWO_STOPS");
      if (rawStops.length > 20) throw new Error("ROUTE_TOO_MANY_STOPS");
      const mode = input.mode ?? "driving";
      if (mode !== "driving" && mode !== "walking" && mode !== "bicycling") throw new Error("INVALID_ROUTE_MODE");
      const destination = String(input.destination ?? "");
      const stops = await Promise.all(rawStops.map(async stop => {
        if (!stop.geocode && stop.location && Number.isFinite(stop.location.lat) && Number.isFinite(stop.location.lng)
          && Math.abs(stop.location.lat) <= 90 && Math.abs(stop.location.lng) <= 180) {
          return { ...stop, location: stop.location, geocoded: false };
        }
        const query = [stop.title, destination].filter(Boolean).join(", ");
        if (!query.trim()) return { ...stop, geocoded: false };
        try {
          const url = new URL("https://photon.komoot.io/api/");
          url.searchParams.set("q", query);
          url.searchParams.set("limit", "1");
          if (rawStops.find(item => item.title === destination)?.location) {
            const center = rawStops.find(item => item.title === destination)!.location!;
            url.searchParams.set("lat", String(center.lat));
            url.searchParams.set("lon", String(center.lng));
          }
          const data = await photon(url) as { features?: PhotonFeature[] };
          const feature = data.features?.[0];
          if (!feature) return { ...stop, geocoded: false };
          return {
            ...stop,
            location: { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] },
            geocoded: true,
            formattedAddress: label(feature.properties),
          };
        } catch {
          return { ...stop, geocoded: false };
        }
      }));
      const unresolvedStops = stops.filter(stop => !stop.location);
      if (unresolvedStops.length) {
        return send(req, res, 200, trpcData({
          available: false, provider: "OpenStreetMap / Photon",
          status: "UNRESOLVED_STOPS", unresolvedStops: unresolvedStops.map(stop => stop.title),
          resolvedStops: stops,
        }));
      }
      const routerBase = mode === "walking" ? "https://routing.openstreetmap.de/routed-foot" : mode === "bicycling" ? "https://routing.openstreetmap.de/routed-bike" : "https://router.project-osrm.org";
      const coords = stops.map(stop => `${stop.location!.lng},${stop.location!.lat}`).join(";");
      const url = new URL(`${routerBase}/route/v1/driving/${coords}`);
      url.searchParams.set("overview", "full");
      url.searchParams.set("geometries", "polyline");
      url.searchParams.set("steps", "false");
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`OSRM_HTTP_${response.status}`);
      const result = await response.json() as { code: string; routes?: Array<{ distance: number; duration: number; geometry: string }>; waypoints?: Array<{ waypoint_index: number }> };
      const route = result.routes?.[0];
      if (result.code !== "Ok" || !route) return send(req, res, 200, trpcData({ available: false, provider: "OpenStreetMap routing", status: result.code, resolvedStops: stops }));
      const hours = Math.floor(route.duration / 3600);
      const minutes = Math.round((route.duration % 3600) / 60);
      return send(req, res, 200, trpcData({
        available: true, provider: "OSRM / OpenStreetMap", retrievedAt: new Date().toISOString(),
        mode, distanceKm: Math.round(route.distance / 100) / 10,
        duration: hours ? `${hours}h ${minutes}m` : `${minutes}m`,
        durationSeconds: route.duration, warnings: [], summary: "Road-network route estimate",
        geometry: route.geometry, waypointOrder: (result.waypoints ?? []).map(point => point.waypoint_index), alternatives: [],
        resolvedStops: stops,
      }));
    }
    return send(req, res, 404, { error: { json: { message: "TRAVEL_PROCEDURE_NOT_FOUND" } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TRAVEL_REQUEST_FAILED";
    const status = message === "LOCATION_NOT_FOUND" ? 404
      : ["REQUEST_INPUT_TOO_LARGE", "INVALID_REQUEST_JSON", "INVALID_REQUEST_INPUT", "INVALID_PLACE_CATEGORY", "ROUTE_TOO_MANY_STOPS", "INVALID_ROUTE_MODE", "ROUTE_REQUIRES_TWO_STOPS", "INVALID_SEARCH_COORDINATES"].includes(message) ? 400
        : 502;
    console.error("[TripsForge API failure]", { requestId, path, status, message });
    return send(req, res, status, { error: { json: { message, code: status === 404 ? "NOT_FOUND" : "BAD_GATEWAY", data: { httpStatus: status, requestId } } } });
  }
}
