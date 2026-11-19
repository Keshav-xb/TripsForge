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
async function photon(url: URL) {
  const response = await fetch(url, { headers: { "User-Agent": "TripsForge/1.0 (travel planning MVP)" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`OPEN_MAP_DATA_HTTP_${response.status}`);
  return response.json();
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
      const data = await photon(url) as { features?: PhotonFeature[] };
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
    return send(req, res, 404, { error: { json: { message: "TRAVEL_PROCEDURE_NOT_FOUND" } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TRAVEL_REQUEST_FAILED";
    const status = message === "LOCATION_NOT_FOUND" ? 404 : 502;
    return send(req, res, status, { error: { json: { message, code: status === 404 ? "NOT_FOUND" : "BAD_GATEWAY", data: { httpStatus: status } } } });
  }
}
