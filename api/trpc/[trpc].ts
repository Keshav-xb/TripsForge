import type { IncomingMessage, ServerResponse } from "node:http";

type Point = { lat: number; lng: number };
type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: { osm_id?: number; osm_type?: string; name?: string; street?: string; city?: string; state?: string; country?: string; postcode?: string; type?: string };
};

function inputOf(req: IncomingMessage) {
  const raw = new URL(req.url ?? "", "https://tripsforge.local").searchParams.get("input");
  const parsed = raw ? JSON.parse(raw) : {};
  return parsed.json ?? parsed;
}
function send(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "public, max-age=60, s-maxage=300");
  res.setHeader("access-control-allow-origin", "*");
  res.end(JSON.stringify(value));
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
    const input = inputOf(req);
    if (path === "location.search") {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", String(input.query ?? ""));
      url.searchParams.set("limit", "8");
      const data = await photon(url) as { features?: PhotonFeature[] };
      return send(res, 200, trpcData({
        provider: "OpenStreetMap / Photon",
        retrievedAt: new Date().toISOString(),
        results: (data.features ?? []).map(feature => ({
          placeId: feature.properties.osm_type && feature.properties.osm_id ? `${feature.properties.osm_type}:${feature.properties.osm_id}` : "",
          description: label(feature.properties),
          name: feature.properties.name ?? label(feature.properties),
          secondary: [feature.properties.city, feature.properties.state, feature.properties.country].filter(Boolean).join(", "),
        })).filter(item => item.description),
      }));
    }
    if (path === "location.resolve") {
      let feature: PhotonFeature | undefined;
      const placeId = String(input.placeId ?? "");
      if (/^[NRW]:\\d+$/.test(placeId)) {
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
      return send(res, 200, trpcData({
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
    if (path === "route.preview") {
      const stops = Array.isArray(input.stops) ? input.stops as Array<{ title: string; location?: Point }> : [];
      if (stops.length < 2 || stops.some(stop => !stop.location)) throw new Error("ROUTE_REQUIRES_COORDINATES");
      const routerBase = input.mode === "walking" ? "https://routing.openstreetmap.de/routed-foot" : input.mode === "bicycling" ? "https://routing.openstreetmap.de/routed-bike" : "https://router.project-osrm.org";
      const coords = stops.map(stop => `${stop.location!.lng},${stop.location!.lat}`).join(";");
      const url = new URL(`${routerBase}/route/v1/driving/${coords}`);
      url.searchParams.set("overview", "full");
      url.searchParams.set("geometries", "polyline");
      url.searchParams.set("steps", "false");
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`OSRM_HTTP_${response.status}`);
      const result = await response.json() as { code: string; routes?: Array<{ distance: number; duration: number; geometry: string }>; waypoints?: Array<{ waypoint_index: number }> };
      const route = result.routes?.[0];
      if (result.code !== "Ok" || !route) return send(res, 200, trpcData({ available: false, provider: "OpenStreetMap routing", status: result.code }));
      const hours = Math.floor(route.duration / 3600);
      const minutes = Math.round((route.duration % 3600) / 60);
      return send(res, 200, trpcData({
        available: true, provider: "OSRM / OpenStreetMap", retrievedAt: new Date().toISOString(),
        mode: input.mode ?? "driving", distanceKm: Math.round(route.distance / 100) / 10,
        duration: hours ? `${hours}h ${minutes}m` : `${minutes}m`,
        durationSeconds: route.duration, warnings: [], summary: "OpenStreetMap route estimate",
        geometry: route.geometry, waypointOrder: (result.waypoints ?? []).map(point => point.waypoint_index), alternatives: [],
      }));
    }
    return send(res, 404, { error: { json: { message: "TRAVEL_PROCEDURE_NOT_FOUND" } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TRAVEL_REQUEST_FAILED";
    const status = message === "LOCATION_NOT_FOUND" ? 404 : 502;
    return send(res, status, { error: { json: { message, code: status === 404 ? "NOT_FOUND" : "BAD_GATEWAY", data: { httpStatus: status } } } });
  }
}
