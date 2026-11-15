import type { IncomingMessage, ServerResponse } from "node:http";

type Point = { lat: number; lng: number };
type GoogleResponse = { status: string; [key: string]: unknown };

const googleMapsKey = () => process.env.GOOGLE_MAPS_API_KEY;

async function googleMapsRequest<T extends GoogleResponse>(
  endpoint: string,
  params: Record<string, unknown>
) {
  const apiKey = googleMapsKey();
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY_NOT_CONFIGURED");

  const url = new URL(endpoint, "https://maps.googleapis.com");
  url.searchParams.set("key", apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`GOOGLE_MAPS_HTTP_${response.status}`);
  return (await response.json()) as T;
}

function inputOf(req: IncomingMessage) {
  const raw = new URL(req.url ?? "", "https://tripsforge.local").searchParams.get("input");
  const parsed = raw ? JSON.parse(raw) : {};
  return parsed.json ?? parsed;
}

function send(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(value));
}

function trpcData(value: unknown) {
  return { result: { data: { json: value } } };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? "", "https://tripsforge.local").pathname.replace(/^\/api\/trpc\//, "");
  try {
    const input = inputOf(req);
    if (path === "location.search") {
      const result = await googleMapsRequest<{
        status: string;
        predictions?: Array<{
          description: string;
          place_id: string;
          structured_formatting?: { main_text?: string; secondary_text?: string };
        }>;
      }>("/maps/api/place/autocomplete/json", { input: String(input.query ?? "") });
      if (result.status !== "OK" && result.status !== "ZERO_RESULTS") {
        throw new Error(`LOCATION_SEARCH_${result.status}`);
      }
      return send(res, 200, trpcData({
        provider: "Google Maps Places",
        retrievedAt: new Date().toISOString(),
        results: (result.predictions ?? []).slice(0, 8).map(item => ({
          placeId: item.place_id,
          description: item.description,
          name: item.structured_formatting?.main_text ?? item.description,
          secondary: item.structured_formatting?.secondary_text ?? "",
        })),
      }));
    }

    if (path === "location.resolve") {
      const result = await googleMapsRequest<{
        status: string;
        results?: Array<{
          address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
          formatted_address: string;
          geometry: { location: Point };
          place_id: string;
          types: string[];
        }>;
      }>("/maps/api/geocode/json", {
        address: input.placeId ? undefined : input.query,
        place_id: input.placeId,
      });
      const first = result.results?.[0];
      if (result.status !== "OK" || !first) {
        throw new Error(`LOCATION_RESOLVE_${result.status}`);
      }
      const component = (type: string) =>
        first.address_components.find(item => item.types.includes(type))?.long_name ?? "";
      return send(res, 200, trpcData({
        provider: "Google Maps Geocoding",
        retrievedAt: new Date().toISOString(),
        placeId: first.place_id,
        formattedAddress: first.formatted_address,
        location: first.geometry.location,
        city: component("locality") || component("administrative_area_level_2"),
        country: component("country"),
        countryCode: first.address_components.find(item => item.types.includes("country"))?.short_name ?? "",
        types: first.types,
      }));
    }

    if (path === "route.preview") {
      const stops = Array.isArray(input.stops) ? input.stops as Array<{ title: string; location?: Point }> : [];
      if (stops.length < 2) throw new Error("ROUTE_REQUIRES_TWO_STOPS");
      const address = (stop: { title: string; location?: Point }) =>
        stop.location ? `${stop.location.lat},${stop.location.lng}` : stop.title;
      const result = await googleMapsRequest<{
        status: string;
        routes?: Array<{
          legs: Array<{ distance: { value: number }; duration: { value: number } }>;
          overview_polyline?: { points: string };
          summary: string;
          warnings?: string[];
          waypoint_order?: number[];
        }>;
      }>("/maps/api/directions/json", {
        origin: address(stops[0]),
        destination: address(stops[stops.length - 1]),
        waypoints: stops.slice(1, -1).map(address).join("|"),
        mode: input.mode ?? "driving",
        alternatives: input.alternatives !== false,
        units: "metric",
      });

      const route = result.routes?.[0];
      if (result.status !== "OK" || !route) {
        return send(res, 200, trpcData({
          available: false,
          provider: "Google Maps Directions",
          status: result.status,
        }));
      }
      const metres = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
      const seconds = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return send(res, 200, trpcData({
        available: true,
        provider: "Google Maps Directions",
        retrievedAt: new Date().toISOString(),
        mode: input.mode ?? "driving",
        distanceKm: Math.round(metres / 100) / 10,
        duration: hours ? `${hours}h ${minutes}m` : `${minutes}m`,
        durationSeconds: seconds,
        warnings: route.warnings ?? [],
        summary: route.summary,
        geometry: route.overview_polyline?.points ?? null,
        waypointOrder: route.waypoint_order ?? [],
        alternatives: (result.routes ?? []).slice(1).map(alternative => ({
          distanceKm: Math.round(alternative.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 100) / 10,
          durationSeconds: alternative.legs.reduce((sum, leg) => sum + leg.duration.value, 0),
          geometry: alternative.overview_polyline?.points ?? null,
          summary: alternative.summary,
        })),
      }));
    }

    return send(res, 404, { error: { json: { message: "TRAVEL_PROCEDURE_NOT_FOUND" } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TRAVEL_REQUEST_FAILED";
    const status = message === "GOOGLE_MAPS_API_KEY_NOT_CONFIGURED" ? 503 : 502;
    return send(res, status, {
      error: {
        json: {
          message,
          code: status === 503 ? "PRECONDITION_FAILED" : "BAD_GATEWAY",
          data: { httpStatus: status },
        },
      },
    });
  }
}
