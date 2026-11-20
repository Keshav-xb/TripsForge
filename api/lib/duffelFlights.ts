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
    flightNumber?: string;
  }>;
};

export type FlightSearchResult =
  | { status: "provider_not_configured"; provider: "Duffel"; message: string; offers: [] }
  | { status: "no_offers"; provider: "Duffel"; checkedAt: string; originCode: string; destinationCode: string; offers: [] }
  | { status: "offers_found"; provider: "Duffel"; checkedAt: string; originCode: string; destinationCode: string; offers: FlightOfferSummary[] };

type DuffelPlace = { type?: string; name?: string; city_name?: string; iata_code?: string; iata_city_code?: string };
type DuffelOffer = {
  id?: string; total_amount?: string; total_currency?: string; expires_at?: string;
  owner?: { name?: string };
  slices?: Array<{ segments?: Array<{
    departing_at?: string; arriving_at?: string;
    origin?: { name?: string; iata_code?: string };
    destination?: { name?: string; iata_code?: string };
    operating_carrier?: { name?: string };
    marketing_carrier_flight_number?: string;
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

async function resolveDuffelPlace(query: string, token: string): Promise<string> {
  const url = new URL("https://api.duffel.com/places/suggestions");
  url.searchParams.set("query", query);
  const result = await duffelRequest<{ data?: DuffelPlace[] }>(url.pathname + url.search, token);
  const places = result.data ?? [];
  const selected = places.find(place => place.type === "city" && place.iata_code)
    ?? places.find(place => place.type === "airport" && place.iata_code);
  const code = selected?.iata_code;
  if (!code || !/^[A-Z]{3}$/.test(code)) throw new Error(`DUFFEL_PLACE_NOT_FOUND:${query}`);
  return code;
}

export async function searchDuffelFlights(input: {
  origin: string; destination: string; departureDate: string; adults?: number;
}): Promise<FlightSearchResult> {
  const token = process.env.DUFFEL_ACCESS_TOKEN?.trim();
  if (!token) return {
    status: "provider_not_configured", provider: "Duffel",
    message: "Flight search is ready, but the Duffel access token has not been configured on the server.",
    offers: [],
  };
  if (input.origin.trim().length < 2 || input.destination.trim().length < 2) throw new Error("INVALID_FLIGHT_LOCATIONS");
  const date = new Date(input.departureDate + "T00:00:00Z");
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.departureDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.departureDate) {
    throw new Error("INVALID_FLIGHT_DATE");
  }
  const adults = Math.min(9, Math.max(1, Math.floor(input.adults ?? 1)));
  const [originCode, destinationCode] = await Promise.all([
    resolveDuffelPlace(input.origin, token),
    resolveDuffelPlace(input.destination, token),
  ]);
  if (originCode === destinationCode) throw new Error("FLIGHT_ORIGIN_EQUALS_DESTINATION");
  const result = await duffelRequest<{ data?: { offers?: DuffelOffer[] } }>(
    "/air/offer_requests",
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
  const offers = (result.data?.offers ?? []).flatMap(offer => {
    if (!offer.id || !offer.total_amount || !offer.total_currency) return [];
    const segments = (offer.slices ?? []).flatMap(slice => (slice.segments ?? []).map(segment => ({
      from: [segment.origin?.name, segment.origin?.iata_code].filter(Boolean).join(" (") + (segment.origin?.name && segment.origin?.iata_code ? ")" : ""),
      to: [segment.destination?.name, segment.destination?.iata_code].filter(Boolean).join(" (") + (segment.destination?.name && segment.destination?.iata_code ? ")" : ""),
      departure: segment.departing_at ?? "",
      arrival: segment.arriving_at ?? "",
      carrier: segment.operating_carrier?.name ?? "Carrier not supplied",
      ...(segment.marketing_carrier_flight_number ? { flightNumber: segment.marketing_carrier_flight_number } : {}),
    })));
    return [{ id: offer.id, amount: offer.total_amount, currency: offer.total_currency, owner: offer.owner?.name ?? "Airline not supplied", segments, ...(offer.expires_at ? { expiresAt: offer.expires_at } : {}) }];
  });
  return offers.length
    ? { status: "offers_found", provider: "Duffel", checkedAt: new Date().toISOString(), originCode, destinationCode, offers: offers.slice(0, 5) }
    : { status: "no_offers", provider: "Duffel", checkedAt: new Date().toISOString(), originCode, destinationCode, offers: [] };
}
