type AirportCoordinates = { latitude: number; longitude: number };
type TimezoneResponse = { timeZone?: string; timeZoneId?: string; timezone?: string };

const CSV_URL = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv";
const timezoneCache = new Map<string, { expiresAt: number; timezone: string }>();
const pending = new Map<string, Promise<string | undefined>>();
let coordinatesCache: { expiresAt: number; airports: Map<string, AirportCoordinates> } | undefined;

function csvFields(line: string): string[] {
  const fields: string[] = [];
  let field = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { fields.push(field); field = ""; }
    else field += char;
  }
  fields.push(field);
  return fields;
}

async function airportCoordinates(): Promise<Map<string, AirportCoordinates>> {
  if (coordinatesCache && coordinatesCache.expiresAt > Date.now()) return coordinatesCache.airports;
  const response = await fetch(CSV_URL, { signal: AbortSignal.timeout(7000), headers: { "User-Agent": "TripsForge/1.0 (airport timezone lookup)" } });
  if (!response.ok) throw new Error("AIRPORT_COORDINATE_REGISTRY_UNAVAILABLE");
  const lines = (await response.text()).split(/\r?\n/);
  const headers = csvFields(lines.shift() ?? "");
  const index = (name: string) => headers.indexOf(name);
  const codeIndex = index("iata_code"), latIndex = index("latitude_deg"), lonIndex = index("longitude_deg");
  const scheduledIndex = index("scheduled_service"), typeIndex = index("type");
  if ([codeIndex, latIndex, lonIndex, scheduledIndex, typeIndex].some(i => i < 0)) throw new Error("AIRPORT_REGISTRY_SCHEMA_INVALID");
  const airports = new Map<string, AirportCoordinates>();
  for (const line of lines) {
    if (!line) continue;
    const row = csvFields(line);
    const code = row[codeIndex]?.trim().toUpperCase();
    const latitude = Number(row[latIndex]), longitude = Number(row[lonIndex]);
    if (!/^[A-Z]{3}$/.test(code) || row[scheduledIndex] !== "yes"
      || !["large_airport", "medium_airport", "small_airport"].includes(row[typeIndex])
      || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (!airports.has(code)) airports.set(code, { latitude, longitude });
  }
  coordinatesCache = { airports, expiresAt: Date.now() + 24 * 60 * 60_000 };
  return airports;
}

export function resolveAirportTimezone(iataCode: string): Promise<string | undefined> {
  const code = iataCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return Promise.resolve(undefined);
  const cached = timezoneCache.get(code);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.timezone);
  const existing = pending.get(code);
  if (existing) return existing;
  const task = (async () => {
    try {
      const coordinates = (await airportCoordinates()).get(code);
      if (!coordinates) return undefined;
      const url = new URL("https://www.timeapi.io/api/TimeZone/coordinate");
      url.searchParams.set("latitude", String(coordinates.latitude));
      url.searchParams.set("longitude", String(coordinates.longitude));
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
      if (!response.ok) return undefined;
      const body = await response.json() as TimezoneResponse;
      const timezone = body.timeZone ?? body.timeZoneId ?? body.timezone;
      if (!timezone || !timezone.includes("/")) return undefined;
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
      } catch {
        return undefined;
      }
      timezoneCache.set(code, { timezone, expiresAt: Date.now() + 30 * 24 * 60 * 60_000 });
      return timezone;
    } catch {
      return undefined;
    } finally {
      pending.delete(code);
    }
  })();
  pending.set(code, task);
  return task;
}
