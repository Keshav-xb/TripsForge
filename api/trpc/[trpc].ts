import type { IncomingMessage, ServerResponse } from "node:http";

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
  const parsed = raw ? JSON.parse(raw) : {};
  const batched = params.get("batch") === "1";
  const payload = batched ? (parsed["0"] ?? parsed) : parsed;
  return { input: payload.json ?? payload, batched };
}
function send(req: IncomingMessage, res: ServerResponse, status: number, value: unknown) {
  const batched = new URL(req.url ?? "", "https://tripsforge.local").searchParams.get("batch") === "1";
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "public, max-age=60, s-maxage=300");
  res.setHeader("access-control-allow-origin", "*");
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

type AmadeusToken = { value: string; expiresAt: number };
let amadeusToken: AmadeusToken | undefined;

async function getAmadeusToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  if (amadeusToken && amadeusToken.expiresAt > Date.now() + 60_000) return amadeusToken.value;
  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`AMADEUS_AUTH_HTTP_${response.status}`);
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("AMADEUS_AUTH_INVALID_RESPONSE");
  amadeusToken = { value: data.access_token, expiresAt: Date.now() + Math.max(60, data.expires_in ?? 1800) * 1000 };
  return data.access_token;
}

async function amadeusCityCode(baseUrl: string, token: string, city: string): Promise<{ code: string; name: string } | undefined> {
  const keyword = city.split(",")[0].trim();
  if (keyword.length < 3) return undefined;
  const url = new URL(`${baseUrl}/v1/reference-data/locations/cities`);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("max", "10");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`AMADEUS_CITY_HTTP_${response.status}`);
  const data = await response.json() as { data?: Array<{ name?: string; iataCode?: string; subType?: string }> };
  const matches = data.data ?? [];
  const match = matches.find(item => item.iataCode && item.name?.toLowerCase() === keyword.toLowerCase())
    ?? matches.find(item => item.iataCode);
  return match?.iataCode ? { code: match.iataCode, name: match.name ?? keyword } : undefined;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? "", "https://tripsforge.local").pathname.replace(/^\/api\/trpc\//, "");
  try {
    const { input } = requestData(req);
    if (path === "location.search") {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", String(input.query ?? ""));
      url.searchParams.set("limit", "8");
      url.searchParams.set("lang", "en");
      const data = await photonSearch(url) as { features?: PhotonFeature[] };
      return send(req, res, 200, trpcData({
        provider: "OpenStreetMap / Photon",
        retrievedAt: new Date().toISOString(),
        results: (data.features ?? []).map(feature => ({
          placeId: feature.properties.osm_type && feature.properties.osm_id ? `${feature.properties.osm_type}:${feature.properties.osm_id}` : "",
          description: label(feature.properties),
          location: { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] },
          name: feature.properties.name ?? label(feature.properties),
          secondary: [feature.properties.city, feature.properties.state, feature.properties.country].filter(Boolean).join(", "),
        })).filter(item => item.description),
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
    if (path === "route.preview") {
      const rawStops = Array.isArray(input.stops) ? input.stops as Array<{ id?: string; title: string; location?: Point; geocode?: boolean }> : [];
      if (rawStops.length < 2) throw new Error("ROUTE_REQUIRES_TWO_STOPS");
      const destination = String(input.destination ?? "");
      const stops = await Promise.all(rawStops.map(async stop => {
        if (!stop.geocode && stop.location && Number.isFinite(stop.location.lat) && Number.isFinite(stop.location.lng)) {
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
      const routerBase = input.mode === "walking" ? "https://routing.openstreetmap.de/routed-foot" : input.mode === "bicycling" ? "https://routing.openstreetmap.de/routed-bike" : "https://router.project-osrm.org";
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
        mode: input.mode ?? "driving", distanceKm: Math.round(route.distance / 100) / 10,
        duration: hours ? `${hours}h ${minutes}m` : `${minutes}m`,
        durationSeconds: route.duration, warnings: [], summary: "Road-network route estimate",
        geometry: route.geometry, waypointOrder: (result.waypoints ?? []).map(point => point.waypoint_index), alternatives: [],
        resolvedStops: stops,
      }));
    }

    if (path === "flight.search") {
      const originName = String(input.origin ?? "").trim();
      const destinationName = String(input.destination ?? "").trim();
      const departureDate = String(input.departureDate ?? "");
      const returnDate = String(input.returnDate ?? "");
      const adults = Math.min(9, Math.max(1, Math.floor(Number(input.adults) || 1)));
      const children = Math.min(8, Math.max(0, Math.floor(Number(input.children) || 0)));
      if (!originName || !destinationName || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) throw new Error("FLIGHT_SEARCH_REQUIRES_CITIES_AND_DEPARTURE_DATE");
      if (returnDate && (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate) || returnDate <= departureDate)) throw new Error("INVALID_FLIGHT_RETURN_DATE");
      if (!process.env.AMADEUS_CLIENT_ID || !process.env.AMADEUS_CLIENT_SECRET) {
        return send(req, res, 200, trpcData({ status: "not_configured", provider: "Amadeus", message: "Flight search is not connected yet. Configure AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET on the server." }));
      }
      const baseUrl = (process.env.AMADEUS_API_BASE_URL || "https://test.api.amadeus.com").replace(/\/$/, "");
      const token = await getAmadeusToken(baseUrl, process.env.AMADEUS_CLIENT_ID, process.env.AMADEUS_CLIENT_SECRET);
      const [originCity, destinationCity] = await Promise.all([
        amadeusCityCode(baseUrl, token, originName),
        amadeusCityCode(baseUrl, token, destinationName),
      ]);
      if (!originCity || !destinationCity) {
        return send(req, res, 200, trpcData({
          status: "location_unresolved", provider: "Amadeus",
          originResolved: !!originCity, destinationResolved: !!destinationCity,
          message: "The flight provider could not resolve one or both city codes. This is not evidence that flights do not exist.",
        }));
      }
      const url = new URL(`${baseUrl}/v2/shopping/flight-offers`);
      url.searchParams.set("originLocationCode", originCity.code);
      url.searchParams.set("destinationLocationCode", destinationCity.code);
      url.searchParams.set("departureDate", departureDate);
      url.searchParams.set("adults", String(adults));
      if (children > 0) url.searchParams.set("children", String(children));
      if (returnDate) url.searchParams.set("returnDate", returnDate);
      url.searchParams.set("currencyCode", String(input.currency || "INR").toUpperCase());
      url.searchParams.set("max", "10");
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`AMADEUS_FLIGHT_SEARCH_HTTP_${response.status}`);
      const payload = await response.json() as {
        data?: Array<{
          id?: string; price?: { total?: string; currency?: string };
          itineraries?: Array<{ duration?: string; segments?: Array<{
            departure?: { iataCode?: string; at?: string };
            arrival?: { iataCode?: string; at?: string };
            carrierCode?: string; number?: string;
          }> }>;
          validatingAirlineCodes?: string[];
        }>;
        dictionaries?: { carriers?: Record<string, string> };
        meta?: { count?: number };
      };
      const offers = (payload.data ?? []).map(offer => ({
        id: offer.id ?? "",
        price: offer.price?.total ?? null,
        currency: offer.price?.currency ?? null,
        airlines: (offer.validatingAirlineCodes ?? []).map(code => ({ code, name: payload.dictionaries?.carriers?.[code] ?? code })),
        itineraries: (offer.itineraries ?? []).map(itinerary => ({
          duration: itinerary.duration ?? null,
          segments: (itinerary.segments ?? []).map(segment => ({
            from: segment.departure?.iataCode ?? "",
            to: segment.arrival?.iataCode ?? "",
            departureAt: segment.departure?.at ?? null,
            arrivalAt: segment.arrival?.at ?? null,
            airline: segment.carrierCode ?? "",
            flightNumber: segment.number ?? "",
          })),
        })),
      }));
      return send(req, res, 200, trpcData({
        status: offers.length ? "offers_found" : "no_offers_for_search",
        provider: "Amadeus Flight Offers Search",
        checkedAt: new Date().toISOString(),
        origin: originCity, destination: destinationCity,
        offers,
        coverageNote: "Amadeus Self-Service does not include American Airlines, Delta, British Airways or low-cost carriers, and may omit negotiated fares. No results do not prove that no flights operate.",
      }));
    }

    if (path === "route.feasibility") {
      const origin = input.origin as Point | undefined;
      const destinationPoint = input.destination as Point | undefined;
      const validPoint = (point?: Point) => !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
        && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
      if (!validPoint(origin) || !validPoint(destinationPoint)) throw new Error("ROUTE_REQUIRES_VALID_COORDINATES");
      const coordinates = `${origin!.lng},${origin!.lat};${destinationPoint!.lng},${destinationPoint!.lat}`;
      const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinates}`);
      url.searchParams.set("overview", "false");
      url.searchParams.set("steps", "false");
      const checkedAt = new Date().toISOString();
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "TripsForge/1.0 (travel planning MVP)" } });
      if (!response.ok) throw new Error(`OSRM_HTTP_${response.status}`);
      const result = await response.json() as { code?: string; routes?: Array<{ distance: number; duration: number }> };
      const route = result.routes?.[0];
      if (result.code && result.code !== "Ok" && result.code !== "NoRoute") throw new Error("OSRM_ROUTE_" + result.code);
      if (result.code === "NoRoute" || !route) {
        return send(req, res, 200, trpcData({
          mode: "car", status: "unavailable", recommendable: false,
          reason: "The connected road router did not find a drivable route between these coordinates.",
          provider: "OSRM / OpenStreetMap", checkedAt,
        }));
      }
      return send(req, res, 200, trpcData({
        mode: "car", status: "verified", recommendable: true,
        distanceKm: Math.round(route.distance / 100) / 10,
        durationMinutes: Math.round(route.duration / 60),
        reason: "A drivable road-network route was returned by the connected router.",
        provider: "OSRM / OpenStreetMap", checkedAt,
      }));
    }
    return send(req, res, 404, { error: { json: { message: "TRAVEL_PROCEDURE_NOT_FOUND" } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TRAVEL_REQUEST_FAILED";
    const status = message === "LOCATION_NOT_FOUND" ? 404 : 502;
    return send(req, res, status, { error: { json: { message, code: status === 404 ? "NOT_FOUND" : "BAD_GATEWAY", data: { httpStatus: status } } } });
  }
}
