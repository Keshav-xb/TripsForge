import { inflateRawSync } from "node:zlib";
import { discoverMobilityDatabaseBusCandidates, type BusFeedCandidate } from "./mobilityCatalog.js";
import { registerBusSearchProvider, type BusSearchInput } from "./busSearch.js";

type Row = Record<string, string>;
type Tables = { stops: Row[]; routes: Row[]; trips: Row[]; stopTimes: Row[]; calendars: Row[]; calendarDates: Row[]; agencies: Row[] };
type Offer = { route: string; headsign: string; departureTime: string; arrivalTime: string; intermediateStops: number; fromStop: string; toStop: string; feedId: string; fromStopId: string; toStopId: string; serviceDate: string; fromTimezone?: string; toTimezone?: string };
const cache = new Map<string, { expiresAt: number; tables: Tables }>();
const TTL = 30 * 60_000;
const DISCLAIMER = "Published GTFS public-transport schedule only. This is not private bus inventory and does not provide fares, seat availability, live tracking or ticket booking. Verify service with the operator before travel.";

function csv(text: string): Row[] {
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
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = (rows.shift() ?? []).map(x => x.trim().replace(/^\uFEFF/, ""));
  return rows.map(values => Object.fromEntries(headers.map((key, i) => [key, values[i] ?? ""])));
}
function unzip(buffer: Buffer): Map<string, string> {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("GTFS_ZIP_DIRECTORY_NOT_FOUND");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const wanted = new Set(["stops.txt", "routes.txt", "trips.txt", "stop_times.txt", "calendar.txt", "calendar_dates.txt", "agency.txt"]);
  const files = new Map<string, string>();
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("GTFS_ZIP_INVALID_DIRECTORY");
    const method = buffer.readUInt16LE(offset + 10), size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42), name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extra + comment;
    if (!wanted.has(name)) continue;
    const localName = buffer.readUInt16LE(local + 26), localExtra = buffer.readUInt16LE(local + 28);
    const start = local + 30 + localName + localExtra, zipped = buffer.subarray(start, start + size);
    const data = method === 0 ? zipped : method === 8 ? inflateRawSync(zipped) : null;
    if (!data) throw new Error("GTFS_ZIP_COMPRESSION_UNSUPPORTED");
    files.set(name, data.toString("utf8"));
  }
  return files;
}
async function load(feed: BusFeedCandidate): Promise<Tables> {
  const old = cache.get(feed.id);
  if (old && old.expiresAt > Date.now()) return old.tables;
  if (feed.authenticationType !== "0" && feed.authenticationType !== "") throw new Error("GTFS_FEED_AUTH_REQUIRED");
  const response = await fetch(feed.latestUrl, { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "TripsForge/1.0 (India GTFS discovery)" } });
  if (!response.ok) throw new Error(`GTFS_FEED_HTTP_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 35 * 1024 * 1024) throw new Error("GTFS_FEED_TOO_LARGE");
  const files = unzip(bytes), rows = (name: string) => csv(files.get(name) ?? "");
  const tables = { stops: rows("stops.txt"), routes: rows("routes.txt"), trips: rows("trips.txt"), stopTimes: rows("stop_times.txt"), calendars: rows("calendar.txt"), calendarDates: rows("calendar_dates.txt"), agencies: rows("agency.txt") };
  if (!tables.stops.length || !tables.routes.length || !tables.trips.length || !tables.stopTimes.length) throw new Error("GTFS_REQUIRED_TABLES_MISSING");
  if (!tables.routes.some(route => route.route_type === "3")) throw new Error("GTFS_FEED_HAS_NO_BUS_ROUTES");
  cache.set(feed.id, { tables, expiresAt: Date.now() + TTL });
  return tables;
}
const norm = (s: string) => s.toLocaleLowerCase("en").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function matchStop(stops: Row[], query: string): Row | undefined {
  const q = norm(query), tokens = q.split(" ").filter(t => t.length > 2);
  return stops.map(stop => {
    const name = norm(stop.stop_name ?? "");
    const score = name === q ? 100 : name.includes(q) || q.includes(name) ? 85 : tokens.length ? tokens.filter(t => name.includes(t)).length / tokens.length * 65 : 0;
    return { stop, score };
  }).filter(x => x.score >= 45).sort((a, b) => b.score - a.score)[0]?.stop;
}
function runs(service: string, date: string, t: Tables): boolean {
  const ymd = date.replace(/-/g, "");
  const exception = t.calendarDates.find(x => x.service_id === service && x.date === ymd);
  if (exception) return exception.exception_type === "1";
  const cal = t.calendars.find(x => x.service_id === service);
  if (!cal || ymd < cal.start_date || ymd > cal.end_date) return false;
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return cal[["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day]] === "1";
}
function rank(feed: BusFeedCandidate, input: BusSearchInput): number {
  const text = norm([feed.name, feed.provider, feed.subdivisionName, feed.municipality].join(" "));
  const from = norm(input.origin), to = norm(input.destination);
  return [from, to].reduce((score, q) => score + (q && text.includes(q) ? 3 : 0), 0);
}
async function search(input: BusSearchInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.travelDate) || Number.isNaN(Date.parse(input.travelDate))) throw new Error("INVALID_TRAVEL_DATE");
  const feeds = await discoverMobilityDatabaseBusCandidates({ countryCode: "IN" });
  // Keep provider work bounded: sequential 12-second downloads across 20 feeds can
  // exceed serverless execution limits and turn a normal "no data" result into HTTP 500.
  const ordered = [...feeds].sort((a, b) => rank(b, input) - rank(a, input)).slice(0, 4);
  const inspectFeed = async (feed: BusFeedCandidate) => {
    const t = await load(feed);
    const from = matchStop(t.stops, input.origin), to = matchStop(t.stops, input.destination);
    if (!from || !to || from.stop_id === to.stop_id) return null;
    const busRoutes = new Map(t.routes.filter(r => r.route_type === "3").map(r => [r.route_id, r]));
    const trips = new Map(t.trips.filter(trip => busRoutes.has(trip.route_id)).map(trip => [trip.trip_id, trip]));
    const byTrip = new Map<string, Row[]>();
    for (const st of t.stopTimes) { const list = byTrip.get(st.trip_id) ?? []; list.push(st); byTrip.set(st.trip_id, list); }
    const offers: Offer[] = [];
    byTrip.forEach((times: Row[], tripId: string) => {
      const trip = trips.get(tripId);
      if (!trip || !runs(trip.service_id, input.travelDate, t)) return;
      times.sort((left: Row, right: Row) => Number(left.stop_sequence) - Number(right.stop_sequence));
      const fromIndex = times.findIndex((stopTime: Row) => stopTime.stop_id === from.stop_id);
      const toIndex = times.findIndex((stopTime: Row) => stopTime.stop_id === to.stop_id);
      if (fromIndex < 0 || toIndex <= fromIndex) return;
      const first = times[fromIndex], last = times[toIndex], route = busRoutes.get(trip.route_id)!;
      const agency = t.agencies.find(item => item.agency_id && item.agency_id === route.agency_id) ?? (t.agencies.length === 1 ? t.agencies[0] : undefined);
      const agencyTimezone = agency?.agency_timezone;
      offers.push({ route: route.route_short_name || route.route_long_name || "Public bus", headsign: trip.trip_headsign || route.route_long_name || "Scheduled public bus", departureTime: first.departure_time || first.arrival_time, arrivalTime: last.arrival_time || last.departure_time, intermediateStops: Math.max(0, toIndex - fromIndex - 1), fromStop: from.stop_name, toStop: to.stop_name, feedId: feed.id, fromStopId: first.stop_id, toStopId: last.stop_id, serviceDate: input.travelDate, ...(from.stop_timezone || agencyTimezone ? { fromTimezone: from.stop_timezone || agencyTimezone } : {}), ...(to.stop_timezone || agencyTimezone ? { toTimezone: to.stop_timezone || agencyTimezone } : {}) });
    });
    const unique = Array.from(new Map(offers.map((offer: Offer) => [offer.route + "|" + offer.departureTime + "|" + offer.arrivalTime, offer])).values()).sort((left: Offer, right: Offer) => left.departureTime.localeCompare(right.departureTime)).slice(0, 30);
    return unique.length ? { status: "offers_found" as const, provider: feed.provider || feed.name || "Mobility Database GTFS", retrievedAt: new Date().toISOString(), feed: feed.name, state: feed.subdivisionName, offers: unique, disclaimer: DISCLAIMER, sourceLicence: feed.licenseUrl || "Licence not supplied by catalog; verify before commercial use." } : null;
  };
  const settled = await Promise.allSettled(ordered.map(inspectFeed));
  const match = settled.find((item): item is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof inspectFeed>>>> => item.status === "fulfilled" && item.value !== null);
  if (match) return match.value;
  const lastError = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
  return { status: "no_service_found" as const, provider: "Mobility Database India GTFS", retrievedAt: new Date().toISOString(), offers: [] as Offer[], message: ordered.length ? "No verified bus timetable matched these stops for the selected date in the available Indian GTFS feeds." : "No active public GTFS schedule feeds are currently listed for India.", disclaimer: DISCLAIMER, ...(lastError ? { diagnostic: lastError.reason instanceof Error ? lastError.reason.message : "GTFS_FEED_ERROR" } : {}) };
}
registerBusSearchProvider({ id: "mobility-database-india-gtfs", priority: 10, search });
