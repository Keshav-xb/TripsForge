export type RailTrainOffer = {
  trainNumber: string;
  trainName: string;
  departureTime?: string;
  arrivalTime?: string;
  durationMinutes?: number;
  classes: string[];
  runningDays: string[];
};

export type RailSearchResult =
  | { status: "offers_found"; provider: "RailCore"; retrievedAt: string; originStationCode: string; destinationStationCode: string; trains: RailTrainOffer[]; disclaimer: string }
  | { status: "no_service_found"; provider: "RailCore"; retrievedAt: string; originStationCode?: string; destinationStationCode?: string; trains: []; disclaimer: string }
  | { status: "provider_not_configured"; provider: "RailCore"; trains: []; message: string }
  | { status: "lookup_unavailable"; provider: "RailCore"; trains: []; message: string };

type RailCoreEnvelope<T> = { success?: boolean; data?: T; error?: { code?: string; message?: string } };
type StationSearchResponse = RailCoreEnvelope<{ results?: Array<{ station_code?: string; confidence?: number; is_major?: boolean }> }>;
type TrainSearchResponse = RailCoreEnvelope<{ trains?: Array<{
  train_number?: string;
  train_name?: string;
  departure_time?: string;
  arrival_time?: string;
  duration_minutes?: number;
  classes?: string[];
  running_days?: string[];
}> }>;

const baseUrl = "https://ir.railcore.tech/v1";
const disclaimer = "Read-only timetable information from an independent third-party provider. Confirm current timings and seat availability with the railway before travel.";

function validDate(value: string) {
  const parsed = new Date(value + "T00:00:00Z");
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)
    && !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

async function resolveStationCode(city: string, key: string) {
  const url = new URL(`${baseUrl}/stations/search`);
  url.searchParams.set("q", city);
  url.searchParams.set("limit", "8");
  const response = await fetch(url, {
    headers: { "X-RailCore-Key": key, accept: "application/json" },
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw new Error(`RAIL_STATION_SEARCH_HTTP_${response.status}`);
  const body = await response.json() as StationSearchResponse;
  const stations = body.success ? body.data?.results ?? [] : [];
  const best = stations
    .filter(station => typeof station.station_code === "string" && /^[A-Z0-9]{2,5}$/.test(station.station_code))
    .sort((a, b) => Number(b.is_major) - Number(a.is_major) || (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  if (!best?.station_code) throw new Error("RAIL_STATION_NOT_FOUND");
  return best.station_code;
}

export async function searchIndianTrains(input: {
  origin: string;
  destination: string;
  travelDate: string;
}): Promise<RailSearchResult> {
  const key = process.env.RAILCORE_KEY;
  if (!key) {
    return {
      status: "provider_not_configured",
      provider: "RailCore",
      trains: [],
      message: "Train timetable search is awaiting the RAILCORE_KEY server setting.",
    };
  }
  if (!validDate(input.travelDate)) throw new Error("INVALID_TRAVEL_DATE");
  try {
    const [fromCode, toCode] = await Promise.all([
      resolveStationCode(input.origin, key),
      resolveStationCode(input.destination, key),
    ]);
    const url = new URL(`${baseUrl}/routes/trains`);
    url.searchParams.set("from", fromCode);
    url.searchParams.set("to", toCode);
    url.searchParams.set("date", input.travelDate);
    url.searchParams.set("quota", "GN");
    url.searchParams.set("match", "city");
    const response = await fetch(url, {
      headers: { "X-RailCore-Key": key, accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });
    if (response.status === 404) {
      return { status: "no_service_found", provider: "RailCore", retrievedAt: new Date().toISOString(), originStationCode: fromCode, destinationStationCode: toCode, trains: [], disclaimer };
    }
    if (!response.ok) {
      return {
        status: "lookup_unavailable",
        provider: "RailCore",
        trains: [],
        message: response.status === 401 || response.status === 403
          ? "Train data credentials are invalid or lack the journeys:read API scope."
          : response.status === 429 || response.status === 402
            ? "Train data provider rate limit or request allowance reached."
            : "Train timetable provider is temporarily unavailable.",
      };
    }
    const body = await response.json() as TrainSearchResponse;
    if (!body.success) {
      return { status: "lookup_unavailable", provider: "RailCore", trains: [], message: body.error?.message ?? "Train timetable response was not successful." };
    }
    const trains = (body.data?.trains ?? []).flatMap(train => {
      if (!train.train_number || !train.train_name) return [];
      return [{
        trainNumber: train.train_number,
        trainName: train.train_name,
        ...(train.departure_time ? { departureTime: train.departure_time } : {}),
        ...(train.arrival_time ? { arrivalTime: train.arrival_time } : {}),
        ...(Number.isFinite(train.duration_minutes) ? { durationMinutes: train.duration_minutes } : {}),
        classes: Array.isArray(train.classes) ? train.classes : [],
        runningDays: Array.isArray(train.running_days) ? train.running_days : [],
      }];
    });
    return trains.length
      ? { status: "offers_found", provider: "RailCore", retrievedAt: new Date().toISOString(), originStationCode: fromCode, destinationStationCode: toCode, trains, disclaimer }
      : { status: "no_service_found", provider: "RailCore", retrievedAt: new Date().toISOString(), originStationCode: fromCode, destinationStationCode: toCode, trains: [], disclaimer };
  } catch (error) {
    const message = error instanceof Error && error.message === "RAIL_STATION_NOT_FOUND"
      ? "A matching railway station could not be resolved for one of the selected cities."
      : "Train timetable provider could not be reached. Try again shortly.";
    return { status: "lookup_unavailable", provider: "RailCore", trains: [], message };
  }
}
