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
  source: "OpenStreetMap" | "OurAirports" | "BuiltInAirportFallback";
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
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
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

type AirportRegistryEntry = { lat: number; lng: number; iataCode: string; name: string; source?: "OurAirports" | "BuiltInAirportFallback" };

// Small infrastructure-only fallback for common Indian gateways. This is airport
// metadata (coordinates and codes), never a timetable or assertion that flights operate.
const BUILT_IN_AIRPORTS: AirportRegistryEntry[] = [
  { iataCode: "IXJ", name: "Jammu Airport", lat: 32.6891, lng: 74.8374, source: "BuiltInAirportFallback" },
  { iataCode: "SXR", name: "Sheikh ul Alam Airport, Srinagar", lat: 33.9871, lng: 74.7742, source: "BuiltInAirportFallback" },
  { iataCode: "ATQ", name: "Sri Guru Ram Dass Jee International Airport, Amritsar", lat: 31.7096, lng: 74.7973, source: "BuiltInAirportFallback" },
  { iataCode: "IXC", name: "Chandigarh Airport", lat: 30.6735, lng: 76.7885, source: "BuiltInAirportFallback" },
  { iataCode: "KUU", name: "Kullu-Manali Airport, Bhuntar", lat: 31.8767, lng: 77.1544, source: "BuiltInAirportFallback" },
  { iataCode: "DHM", name: "Kangra Airport, Gaggal", lat: 32.1651, lng: 76.2636, source: "BuiltInAirportFallback" },
  { iataCode: "DED", name: "Dehradun Airport", lat: 30.1897, lng: 78.1803, source: "BuiltInAirportFallback" },
  { iataCode: "DEL", name: "Indira Gandhi International Airport, Delhi", lat: 28.5562, lng: 77.1000, source: "BuiltInAirportFallback" },
];
let airportRegistryCache: { expiresAt: number; entries: AirportRegistryEntry[] } | undefined;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "", quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quoted && char === '"' && line[index + 1] === '"') { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

async function getAirportRegistry(): Promise<AirportRegistryEntry[]> {
  if (airportRegistryCache && airportRegistryCache.expiresAt > Date.now()) return airportRegistryCache.entries;
  const response = await fetch("https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv", {
    signal: AbortSignal.timeout(7000),
    headers: { "User-Agent": "TripsForge/1.0 (airport registry lookup)" },
  });
  if (!response.ok) throw new Error(`AIRPORT_REGISTRY_HTTP_${response.status}`);
  const csv = await response.text();
  const lines = csv.split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  const column = (name: string) => headers.indexOf(name);
  const latIndex = column("latitude_deg"), lngIndex = column("longitude_deg");
  const iataIndex = column("iata_code"), nameIndex = column("name");
  const scheduledIndex = column("scheduled_service"), typeIndex = column("type");
  if ([latIndex, lngIndex, iataIndex, nameIndex, scheduledIndex, typeIndex].some(index => index < 0)) {
    throw new Error("AIRPORT_REGISTRY_SCHEMA_INVALID");
  }
  const entries = lines.flatMap(line => {
    if (!line) return [];
    const row = parseCsvLine(line);
    const iataCode = row[iataIndex]?.trim().toUpperCase();
    const lat = Number(row[latIndex]), lng = Number(row[lngIndex]);
    if (!/^[A-Z]{3}$/.test(iataCode) || row[scheduledIndex] !== "yes"
      || !["large_airport", "medium_airport", "small_airport"].includes(row[typeIndex])
      || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ lat, lng, iataCode, name: row[nameIndex] ?? "Airport" }];
  });
  airportRegistryCache = { entries, expiresAt: Date.now() + 24 * 60 * 60_000 };
  return entries;
}

export async function enrichAirportGatewayCodes(gateways: TransportGateway[]): Promise<TransportGateway[]> {
  const airports = gateways.filter(gateway => gateway.mode === "flight" && !gateway.iataCode);
  if (!airports.length) return gateways;
  try {
    const registry = await getAirportRegistry();
    return gateways.map(gateway => {
      if (gateway.mode !== "flight" || gateway.iataCode) return gateway;
      const match = registry
        .map(airport => ({ airport, distance: distanceKm(gateway, airport) }))
        .filter(item => item.distance <= 5)
        .sort((a, b) => a.distance - b.distance)[0];
      return match ? { ...gateway, iataCode: match.airport.iataCode } : gateway;
    });
  } catch {
    // Keep mapped gateways visible; registry failure must not fabricate airport codes.
    return gateways;
  }
}

async function queryPoint(point: { lat: number; lng: number }, radiusKm: number) {
  const radiusMeters = Math.round(radiusKm * 1000);
  const around = `(around:${radiusMeters},${point.lat},${point.lng})`;
  const query = `[out:json][timeout:5];(
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
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`OVERPASS_HTTP_${response.status}`);
    const body = await response.json() as { elements?: OverpassElement[] };
    if (!Array.isArray(body.elements)) throw new Error("OVERPASS_INVALID_RESPONSE");
    return body.elements;
  });
  try {
    return await Promise.any(responses);
  } catch {
    // Gateway discovery is supplemental. A public map-provider outage must not
    // fail the entire route research request or hide registry-backed airports.
    return [];
  }
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
  const [originMapped, destinationMapped] = await Promise.all([
    enrichAirportGatewayCodes(normalizeGateways(originElements, input.origin, radiusKm)),
    enrichAirportGatewayCodes(normalizeGateways(destinationElements, input.destination, radiusKm)),
  ]);
  // Airports come from a separate scheduled-airport registry as well as OSM.
  // This keeps flight gateway discovery working when Overpass is degraded and
  // includes scheduled regional airports (for example, small airports).
  const liveRegistry = await getAirportRegistry().catch(() => []);
  const registryByCode = new Map<string, AirportRegistryEntry>();
  for (const airport of [...liveRegistry, ...BUILT_IN_AIRPORTS]) {
    // Prefer live registry coordinates, while retaining fallback-only regional airports.
    if (!registryByCode.has(airport.iataCode) || airport.source === "OurAirports") registryByCode.set(airport.iataCode, airport);
  }
  const registry = Array.from(registryByCode.values());
  const registryGateways = (center: { lat: number; lng: number }): TransportGateway[] => registry
    .map(airport => ({ airport, distance: distanceKm(center, airport) }))
    .filter(item => item.distance <= radiusKm)
    .map(({ airport, distance }) => ({
      id: `airport-${airport.iataCode}`, name: airport.name, mode: "flight" as const,
      lat: airport.lat, lng: airport.lng, distanceKm: Math.round(distance * 10) / 10,
      iataCode: airport.iataCode, source: airport.source ?? "OurAirports",
    }));
  const merge = (mapped: TransportGateway[], registryItems: TransportGateway[]) => {
    const byId = new Map<string, TransportGateway>();
    for (const item of [...mapped, ...registryItems]) byId.set(item.iataCode ? `flight-${item.iataCode}` : item.id, item);
    return Array.from(byId.values()).sort((a, b) => a.distanceKm - b.distanceKm);
  };
  const originGateways = merge(originMapped, registryGateways(input.origin));
  const destinationGateways = merge(destinationMapped, registryGateways(input.destination));
  return {
    provider: "OpenStreetMap / Overpass + OurAirports",
    retrievedAt: new Date().toISOString(),
    radiusKm,
    origin: originGateways,
    destination: destinationGateways,
    limitations: [
      "Mapped infrastructure is a gateway candidate, not proof of a scheduled service.",
      "OpenStreetMap coverage and tags vary by region; missing gateways do not prove that none exist.",
      "Scheduled airports are also discovered from the OurAirports registry; railway and bus gateways still depend on mapped OpenStreetMap data.",
      "A provider timetable or offer and a separately verified transfer are required before a complete journey can be recommended.",
    ],
  };
}


/** Resolve coordinates only from the scheduled-airport registry, never from city-name guesses. */
export async function resolveAirportCoordinates(iataCode: string): Promise<{ lat: number; lng: number } | undefined> {
  const code = iataCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return undefined;
  try {
    const airport = (await getAirportRegistry()).find(item => item.iataCode === code);
    return airport ? { lat: airport.lat, lng: airport.lng } : undefined;
  } catch {
    return undefined;
  }
}
