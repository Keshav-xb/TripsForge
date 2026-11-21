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
  | { status: "offers_found"; provider: "RailCore"; retrievedAt: string; trains: RailTrainOffer[]; disclaimer: string }
  | { status: "no_service_found"; provider: "RailCore"; retrievedAt: string; trains: []; disclaimer: string }
  | { status: "provider_not_configured"; provider: "RailCore"; trains: []; message: string }
  | { status: "lookup_unavailable"; provider: "RailCore"; trains: []; message: string };

type RailCoreResponse = {
  success?: boolean;
  data?: {
    trains?: Array<{
      train_number?: string;
      train_name?: string;
      departure_time?: string;
      arrival_time?: string;
      duration_minutes?: number;
      classes?: string[];
      running_days?: string[];
    }>;
  };
  error?: { code?: string; message?: string };
};

function validDate(value: string) {
  const parsed = new Date(value + "T00:00:00Z");
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)
    && !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
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
  const url = new URL("https://ir.railcore.tech/v1/routes/trains");
  url.searchParams.set("from", input.origin);
  url.searchParams.set("to", input.destination);
  url.searchParams.set("date", input.travelDate);
  url.searchParams.set("quota", "GN");
  url.searchParams.set("match", "city");
  try {
    const response = await fetch(url, {
      headers: { "X-RailCore-Key": key, accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) {
      return {
        status: "lookup_unavailable",
        provider: "RailCore",
        trains: [],
        message: response.status === 401 || response.status === 403
          ? "Train data credentials are invalid or lack the required API scope."
          : response.status === 429 || response.status === 402
            ? "Train data provider rate limit or request allowance reached."
            : "Train timetable provider is temporarily unavailable.",
      };
    }
    const body = await response.json() as RailCoreResponse;
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
    const disclaimer = "Read-only timetable information from an independent third-party provider. Confirm current timings and seat availability with the railway before travel.";
    return trains.length
      ? { status: "offers_found", provider: "RailCore", retrievedAt: new Date().toISOString(), trains, disclaimer }
      : { status: "no_service_found", provider: "RailCore", retrievedAt: new Date().toISOString(), trains: [], disclaimer };
  } catch {
    return { status: "lookup_unavailable", provider: "RailCore", trains: [], message: "Train timetable provider could not be reached. Try again shortly." };
  }
}
