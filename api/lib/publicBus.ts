import { inflateRawSync } from "node:zlib";

type Feed = { id: string; name: string; state: string; modes?: string[]; service_start?: string; service_end?: string; source?: { name?: string; licence?: string }; };
type Stop = { stop_id: string; stop_name: string; stop_lat?: string; stop_lon?: string };
type Route = { route_id: string; route_short_name?: string; route_long_name?: string; agency_id?: string };
type Trip = { route_id: string; service_id: string; trip_id: string; trip_headsign?: string; direction_id?: string };
type StopTime = { trip_id: string; arrival_time: string; departure_time: string; stop_id: string; stop_sequence: string };
type Calendar = { service_id: string; monday: string; tuesday: string; wednesday: string; thursday: string; friday: string; saturday: string; sunday: string; start_date: string; end_date: string };
type CalendarDate = { service_id: string; date: string; exception_type: string };
type FeedTables = { stops: Stop[]; routes: Route[]; trips: Trip[]; stopTimes: StopTime[]; calendars: Calendar[]; calendarDates: CalendarDate[] };
type BusOffer = { route: string; headsign: string; departureTime: string; arrivalTime: string; intermediateStops: number; fromStop: string; toStop: string; };
type BusResult =
  | { status: "offers_found"; provider: "Reclaim India GTFS"; retrievedAt: string; feed: string; state: string; offers: BusOffer[]; disclaimer: string; sourceLicence: string }
  | { status: "no_service_found"; provider: "Reclaim India GTFS"; retrievedAt: string; feed?: string; offers: []; message: string; disclaimer: string }
  | { status: "feed_not_available"; provider: "Reclaim India GTFS"; offers: []; message: string };

const CATALOG_URL = "https://maps.reclaim.city/gtfs/feeds.json";
const MIRROR = "https://maps.reclaim.city/gtfs";
const DISCLAIMER = "Scheduled public-transport timetable only. This is not a private intercity bus inventory and does not provide fares, seat availability, vehicle tracking, or ticket booking. Some feeds are community-built from public operator schedulers; verify with the operator before travel.";
const feedCache = new Map<string, { expiresAt: number; tables: FeedTables }>();
let catalogCache: { expiresAt: number; feeds: Feed[] } | undefined;

function csvRows(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); if (row.some(v => v !== "")) rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift() ?? [];
  return rows.map(values => Object.fromEntries(headers.map((key, i) => [key, values[i] ?? ""])));
}

function unzipTextFiles(buffer: Buffer, wanted: Set<string>): Map<string, string> {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === eocdSignature) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("GTFS_ZIP_DIRECTORY_NOT_FOUND");
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const output = new Map<string, string>();
  for (let n = 0; n < entries; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("GTFS_ZIP_INVALID_DIRECTORY");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (!wanted.has(name)) continue;
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) continue;
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (!data) throw new Error("GTFS_ZIP_COMPRESSION_UNSUPPORTED");
    output.set(name, data.toString("utf8"));
  }
  return output;
}

async function getCatalog(): Promise<Feed[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.feeds;
  const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(7000), headers: { "User-Agent": "TripsForge/1.0 (public transport timetable search)" } });
  if (!response.ok) throw new Error(`GTFS_CATALOG_HTTP_${response.status}`);
  const body = await response.json() as { feeds?: Feed[] };
  const feeds = (body.feeds ?? []).filter(feed => (feed.modes ?? []).includes("bus"));
  catalogCache = { feeds, expiresAt: Date.now() + 30 * 60_000 };
  return feeds;
}

async function loadFeed(feed: Feed): Promise<FeedTables> {
  const cached = feedCache.get(feed.id);
  if (cached && cached.expiresAt > Date.now()) return cached.tables;
  const response = await fetch(`${MIRROR}/${encodeURIComponent(feed.id)}.zip`, { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "TripsForge/1.0 (public transport timetable search)" } });
  if (!response.ok) throw new Error(`GTFS_FEED_HTTP_${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 25 * 1024 * 1024) throw new Error("GTFS_FEED_TOO_LARGE");
  const files = unzipTextFiles(buffer, new Set(["stops.txt", "routes.txt", "trips.txt", "stop_times.txt", "calendar.txt", "calendar_dates.txt"]));
  const rows = (name: string) => csvRows(files.get(name) ?? "");
  const tables: FeedTables = {
    stops: rows("stops.txt") as Stop[],
    routes: rows("routes.txt") as Route[],
    trips: rows("trips.txt") as Trip[],
    stopTimes: rows("stop_times.txt") as StopTime[],
    calendars: rows("calendar.txt") as Calendar[],
    calendarDates: rows("calendar_dates.txt") as CalendarDate[],
  };
  if (!tables.stops.length || !tables.stopTimes.length) throw new Error("GTFS_FEED_MISSING_REQUIRED_TABLES");
  feedCache.set(feed.id, { tables, expiresAt: Date.now() + 30 * 60_000 });
  return tables;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("en").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function findStop(stops: Stop[], query: string): Stop | undefined {
  const target = normalize(query);
  const targetTokens = target.split(" ").filter(token => token.length > 2);
  return stops.map(stop => {
    const name = normalize(stop.stop_name);
    const score = name === target ? 100 : name.includes(target) || target.includes(name) ? 85 : targetTokens.length ? targetTokens.filter(token => name.includes(token)).length / targetTokens.length * 65 : 0;
    return { stop, score };
  }).filter(item => item.score >= 45).sort((a, b) => b.score - a.score)[0]?.stop;
}
function serviceRuns(serviceId: string, date: string, tables: FeedTables) {
  const ymd = date.replace(/-/g, "");
  const exception = tables.calendarDates.find(item => item.service_id === serviceId && item.date === ymd);
  if (exception) return exception.exception_type === "1";
  const calendar = tables.calendars.find(item => item.service_id === serviceId);
  if (!calendar || ymd < calendar.start_date || ymd > calendar.end_date) return false;
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  const key = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day] as keyof Calendar;
  return calendar[key] === "1";
}
function validDate(date: string) {
  const parsed = new Date(date + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export async function searchPublicBuses(input: { origin: string; destination: string; travelDate: string }): Promise<BusResult> {
  if (!validDate(input.travelDate)) throw new Error("INVALID_TRAVEL_DATE");
  try {
    const feeds = await getCatalog();
    const cityText = normalize(`${input.origin} ${input.destination}`);
    const candidates = feeds.filter(feed => {
      const scope = normalize(`${feed.name} ${feed.state}`);
      const tokens = scope.split(" ").filter(token => token.length > 2);
      return tokens.some(token => cityText.includes(token));
    }).slice(0, 3);
    if (!candidates.length) return { status: "no_service_found", provider: "Reclaim India GTFS", retrievedAt: new Date().toISOString(), offers: [], message: "No published public-bus timetable feed matched this route's city or state. This does not mean no bus service exists.", disclaimer: DISCLAIMER };
    for (const feed of candidates) {
      const tables = await loadFeed(feed);
      const from = findStop(tables.stops, input.origin);
      const to = findStop(tables.stops, input.destination);
      if (!from || !to || from.stop_id === to.stop_id) continue;
      const stopIndex = new Map(tables.stops.map(stop => [stop.stop_id, stop]));
      const routeIndex = new Map(tables.routes.map(route => [route.route_id, route]));
      const tripsById = new Map(tables.trips.map(trip => [trip.trip_id, trip]));
      const byTrip = new Map<string, StopTime[]>();
      for (const stopTime of tables.stopTimes) {
        const list = byTrip.get(stopTime.trip_id) ?? [];
        list.push(stopTime);
        byTrip.set(stopTime.trip_id, list);
      }
      const offers: BusOffer[] = [];
      for (const [tripId, times] of byTrip) {
        const trip = tripsById.get(tripId);
        if (!trip || !serviceRuns(trip.service_id, input.travelDate, tables)) continue;
        times.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
        const fromIndex = times.findIndex(item => item.stop_id === from.stop_id);
        const toIndex = times.findIndex(item => item.stop_id === to.stop_id);
        if (fromIndex < 0 || toIndex <= fromIndex) continue;
        const first = times[fromIndex], last = times[toIndex];
        const route = routeIndex.get(trip.route_id);
        offers.push({
          route: route?.route_short_name || route?.route_long_name || "Public bus",
          headsign: trip.trip_headsign || route?.route_long_name || "Scheduled public bus",
          departureTime: first.departure_time || first.arrival_time,
          arrivalTime: last.arrival_time || last.departure_time,
          intermediateStops: Math.max(0, toIndex - fromIndex - 1),
          fromStop: stopIndex.get(first.stop_id)?.stop_name ?? from.stop_name,
          toStop: stopIndex.get(last.stop_id)?.stop_name ?? to.stop_name,
        });
      }
      const unique = Array.from(new Map(offers.map(offer => [`${offer.route}|${offer.departureTime}|${offer.arrivalTime}`, offer])).values()).sort((a, b) => a.departureTime.localeCompare(b.departureTime)).slice(0, 30);
      if (unique.length) return { status: "offers_found", provider: "Reclaim India GTFS", retrievedAt: new Date().toISOString(), feed: feed.name, state: feed.state, offers: unique, disclaimer: DISCLAIMER, sourceLicence: feed.source?.licence ?? "Not stated by source; verify commercial-use rights before launch." };
    }
    return { status: "no_service_found", provider: "Reclaim India GTFS", retrievedAt: new Date().toISOString(), offers: [], message: "No matching scheduled public-bus trips were found between these stops for the selected date in the available feed. Private and intercity operators may not be included.", disclaimer: DISCLAIMER };
  } catch (error) {
    console.error("[TripsForge public bus search]", error);
    return { status: "feed_not_available", provider: "Reclaim India GTFS", offers: [], message: "The public timetable feed is temporarily unavailable. Please try again later." };
  }
}
