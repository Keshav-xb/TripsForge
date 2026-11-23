export type GatewayMode = "flight" | "train" | "bus" | "ferry";

export type TransportGateway = {
  id: string;
  name: string;
  mode: GatewayMode;
  lat: number;
  lng: number;
  distanceKm: number;
  countryCode?: string;
  iataCode?: string;
  stationCode?: string;
  source: "OpenStreetMap";
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const PROVIDERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function classify(tags: Record<string, string>): GatewayMode | undefined {
  if (tags.aeroway === "aerodrome") return "flight";
  if (tags.railway === "station" || tags.railway === "halt") return "train";
  if (tags.amenity === "bus_station" || tags.highway === "bus_stop") return "bus";
  if (tags.amenity === "ferry_terminal") return "ferry";
  return undefined;
}

export function normalizeGateways(
  elements: OverpassElement[],
  center: { lat: number; lng: number },
  radiusKm: number,
): TransportGateway[] {
  const unique = new Map<string, TransportGateway>();
  for (const element of elements) {
    const point = element.center ?? (element.lat !== undefined && element.lon !== undefined
      ? { lat: element.lat, lon: element.lon } : undefined);
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const tags = element.tags ?? {};
    const mode = classify(tags);
    if (!mode) continue;
    const distance = distanceKm(center, { lat: point.lat, lng: point.lon });
    if (distance > radiusKm) continue;
    const name = tags.name ?? tags["name:en"] ?? tags.official_name;
    if (!name || name.trim().length < 2) continue;
    const id = `${element.type}-${element.id}`;
    const gateway: TransportGateway = {
      id, name: name.trim(), mode, lat: point.lat, lng: point.lon,
      distanceKm: Math.round(distance * 10) / 10,
      ...(tags["ISO3166-1:alpha2"] ? { countryCode: tags["ISO3166-1:alpha2"] } : {}),
      ...(tags.iata ? { iataCode: tags.iata.toUpperCase() } : {}),
      ...(tags.uic_ref ?? tags.ref ? { stationCode: tags.uic_ref ?? tags.ref } : {}),
      source: "OpenStreetMap",
    };
    unique.set(id, gateway);
  }
  return Array.from(unique.values()).sort((a, b) => a.distanceKm - b.distanceKm);
}

async function queryPoint(point: { lat: number; lng: number }, radiusKm: number) {
  const radiusMeters = Math.round(radiusKm * 1000);
  const around = `(around:${radiusMeters},${point.lat},${point.lng})`;
  const query = `[out:json][timeout:10];(
    nwr${around}["aeroway"="aerodrome"];
    nwr${around}["railway"~"station|halt"];
    nwr${around}["amenity"~"bus_station|ferry_terminal"];
    nwr${around}["highway"="bus_stop"];
  );out center tags;`;
  const responses = PROVIDERS.map(async provider => {
    const response = await fetch(provider, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "TripsForge/1.0 (transport gateway discovery)" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(11000),
    });
    if (!response.ok) throw new Error(`OVERPASS_HTTP_${response.status}`);
    const body = await response.json() as { elements?: OverpassElement[] };
    if (!Array.isArray(body.elements)) throw new Error("OVERPASS_INVALID_RESPONSE");
    return body.elements;
  });
  return Promise.any(responses);
}

export async function discoverGateways(input: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  radiusKm?: number;
}) {
  const radiusKm = Math.min(300, Math.max(25, Math.round(input.radiusKm ?? 150)));
  const [originElements, destinationElements] = await Promise.all([
    queryPoint(input.origin, radiusKm),
    queryPoint(input.destination, radiusKm),
  ]);
  return {
    provider: "OpenStreetMap / Overpass",
    retrievedAt: new Date().toISOString(),
    radiusKm,
    origin: normalizeGateways(originElements, input.origin, radiusKm),
    destination: normalizeGateways(destinationElements, input.destination, radiusKm),
    limitations: [
      "Mapped infrastructure is a gateway candidate, not proof of a scheduled service.",
      "OpenStreetMap coverage and tags vary by region; missing gateways do not prove that none exist.",
      "A provider timetable or offer and a separately verified transfer are required before a complete journey can be recommended.",
    ],
  };
}
