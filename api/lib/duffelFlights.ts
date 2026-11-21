export type FlightOfferSummary = {
  id: string;
  amount: string;
  currency: string;
  expiresAt?: string;
  owner: string;
  segments: Array<{
    from: string;
    to: string;
    departure: string;
    arrival: string;
    carrier: string;
    marketingCarrier?: string;
    flightNumber?: string;
    duration?: string;
    baggage?: string[];
  }>;
};

export type DuffelEnvironment = "test" | "live" | "unknown";

export type FlightSearchResult =
  | { status: "provider_not_configured"; provider: "Duffel"; environment: "unknown"; message: string; offers: [] }
  | { status: "no_offers"; provider: "Duffel"; environment: DuffelEnvironment; checkedAt: string; originCode: string; destinationCode: string; offers: [] }
  | { status: "offers_found"; provider: "Duffel"; environment: DuffelEnvironment; checkedAt: string; originCode: string; destinationCode: string; totalOffersReturned: number; hasMoreOffers: boolean; offers: FlightOfferSummary[] };

type DuffelPlace = { type?: string; name?: string; city_name?: string; iata_code?: string; iata_city_code?: string };
type DuffelOffer = {
  id?: string; total_amount?: string; total_currency?: string; expires_at?: string;
  owner?: { name?: string };
  slices?: Array<{ segments?: Array<{
    departing_at?: string; arriving_at?: string;
    origin?: { name?: string; iata_code?: string };
    destination?: { name?: string; iata_code?: string };
    operating_carrier?: { name?: string; iata_code?: string };
    marketing_carrier?: { name?: string; iata_code?: string };
    marketing_carrier_flight_number?: string;
    duration?: string;
    passengers?: Array<{ baggages?: Array<{ type?: string; quantity?: number }> }>;
  }> }>;
};

async function duffelRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.duffel.com${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "duffel-version": "v2",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(18000),
  });
  const body = await response.text();
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { throw new Error("DUFFEL_INVALID_RESPONSE"); }
  if (!response.ok) {
    const message = (parsed as { errors?: Array<{ title?: string; message?: string }> }).errors?.[0]?.message;
    throw new Error(message || `DUFFEL_HTTP_${response.status}`);
  }
  return parsed as T;
}

const INDIA_AIRPORT_FALLBACKS: Array<{ aliases: string[]; code: string }> = [
  { aliases: ["srinagar"], code: "SXR" },
  { aliases: ["jammu"], code: "IXJ" },
  { aliases: ["delhi", "new delhi"], code: "DEL" },
  { aliases: ["mumbai", "bombay"], code: "BOM" },
  { aliases: ["bengaluru", "bangalore"], code: "BLR" },
  { aliases: ["chennai", "madras"], code: "MAA" },
  { aliases: ["kolkata", "calcutta"], code: "CCU" },
  { aliases: ["hyderabad"], code: "HYD" },
  { aliases: ["ahmedabad"], code: "AMD" },
  { aliases: ["pune"], code: "PNQ" },
  { aliases: ["goa"], code: "GOI" },
  { aliases: ["leh"], code: "IXL" },
  { aliases: ["amritsar"], code: "ATQ" },
  { aliases: ["jaipur"], code: "JAI" },
  { aliases: ["lucknow"], code: "LKO" },
];

function fallbackIndianAirportCode(query: string): string | undefined {
  const normalized = query.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return INDIA_AIRPORT_FALLBACKS.find(({ aliases }) =>
    aliases.some(alias => normalized.split(" ").includes(alias) || normalized.includes(alias))
  )?.code;
}

async function resolveDuffelPlace(query: string, token: string): Promise<string> {
  const url = new URL("https://api.duffel.com/places/suggestions");
  url.searchParams.set("query", query);
  try {
    const result = await duffelRequest<{ data?: DuffelPlace[] }>(url.pathname + url.search, token);
    const places = result.data ?? [];
    const city = places.find(place => place.type === "city" && (place.iata_code || place.iata_city_code));
    const airport = places.find(place => place.type === "airport" && place.iata_code);
    const code = city?.iata_code || city?.iata_city_code || airport?.iata_code;
    if (code && /^[A-Z]{3}$/.test(code)) return code;
  } catch {
    // Continue to the deterministic airport-code fallback for supported Indian cities.
  }
  const fallback = fallbackIndianAirportCode(query);
  if (fallback) return fallback;
  throw new Error(`DUFFEL_PLACE_NOT_FOUND:${query}`);
}

export async function searchDuffelFlights(input: {
  origin: string; destination: string; departureDate: string; adults?: number;
}): Promise<FlightSearchResult> {
  const token = process.env.DUFFEL_ACCESS_TOKEN?.trim();
  if (!token) return {
    status: "provider_not_configured", provider: "Duffel", environment: "unknown",
    message: "Flight search is ready, but the Duffel access token has not been configured on the server.",
    offers: [],
  };
  if (input.origin.trim().length < 2 || input.destination.trim().length < 2) throw new Error("INVALID_FLIGHT_LOCATIONS");
  const date = new Date(input.departureDate + "T00:00:00Z");
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.departureDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.departureDate) {
    throw new Error("INVALID_FLIGHT_DATE");
  }
  const environment: DuffelEnvironment = token.startsWith("duffel_test_") ? "test" : token.startsWith("duffel_live_") ? "live" : "unknown";
  const adults = Math.min(9, Math.max(1, Math.floor(input.adults ?? 1)));
  const [originCode, destinationCode] = await Promise.all([
    resolveDuffelPlace(input.origin, token),
    resolveDuffelPlace(input.destination, token),
  ]);
  if (originCode === destinationCode) throw new Error("FLIGHT_ORIGIN_EQUALS_DESTINATION");
  const requestResult = await duffelRequest<{ data?: { id?: string } }>(
    "/air/offer_requests?return_offers=false&supplier_timeout=15000",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          slices: [{ origin: originCode, destination: destinationCode, departure_date: input.departureDate }],
          passengers: Array.from({ length: adults }, () => ({ type: "adult" })),
          cabin_class: "economy",
          max_connections: 1,
        },
      }),
    },
  );
  const offerRequestId = requestResult.data?.id;
  if (!offerRequestId) throw new Error("DUFFEL_OFFER_REQUEST_ID_MISSING");
  const offersUrl = new URL("https://api.duffel.com/air/offers");
  offersUrl.searchParams.set("offer_request_id", offerRequestId);
  offersUrl.searchParams.set("limit", "200");
  offersUrl.searchParams.set("sort", "total_amount");
  offersUrl.searchParams.set("max_connections", "1");
  const offerResult = await duffelRequest<{ data?: DuffelOffer[]; meta?: { after?: string | null; limit?: number } }>(offersUrl.pathname + offersUrl.search, token);
  const totalOffersReturned = offerResult.data?.length ?? 0;
  const hasMoreOffers = Boolean(offerResult.meta?.after);

  const offers = (offerResult.data ?? []).flatMap(offer => {
    if (!offer.id || !offer.total_amount || !offer.total_currency) return [];
    const segments = (offer.slices ?? []).flatMap(slice => (slice.segments ?? []).map(segment => ({
      from: [segment.origin?.name, segment.origin?.iata_code].filter(Boolean).join(" (") + (segment.origin?.name && segment.origin?.iata_code ? ")" : ""),
      to: [segment.destination?.name, segment.destination?.iata_code].filter(Boolean).join(" (") + (segment.destination?.name && segment.destination?.iata_code ? ")" : ""),
      departure: segment.departing_at ?? "",
      arrival: segment.arriving_at ?? "",
      carrier: segment.operating_carrier?.name ?? segment.marketing_carrier?.name ?? "Carrier details not supplied",
      ...(segment.marketing_carrier?.name && segment.operating_carrier?.name && segment.marketing_carrier.name !== segment.operating_carrier.name ? { marketingCarrier: segment.marketing_carrier.name } : {}),
      ...(segment.marketing_carrier_flight_number ? { flightNumber: segment.marketing_carrier_flight_number } : {}),
      ...(segment.duration ? { duration: segment.duration } : {}),
      ...(() => {
        const baggage = Array.from(new Set((segment.passengers ?? []).flatMap(passenger => (passenger.baggages ?? []).map(item =>
          `${item.quantity ?? 0} ${(item.type ?? "baggage").replace(/_/g, " ")} bag${item.quantity === 1 ? "" : "s"}`
        ))));
        return baggage.length ? { baggage } : {};
      })(),
    })));
    return [{ id: offer.id, amount: offer.total_amount, currency: offer.total_currency, owner: offer.owner?.name ?? "Airline not supplied", segments, ...(offer.expires_at ? { expiresAt: offer.expires_at } : {}) }];
  });
  return offers.length
    ? { status: "offers_found", provider: "Duffel", environment, checkedAt: new Date().toISOString(), originCode, destinationCode, totalOffersReturned, hasMoreOffers, offers: offers.sort((a, b) => Number(a.amount) - Number(b.amount)).slice(0, 20) }
    : { status: "no_offers", provider: "Duffel", environment, checkedAt: new Date().toISOString(), originCode, destinationCode, offers: [] };
}
