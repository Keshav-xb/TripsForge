export type SerpApiFlightOffer = {
  id: string;
  amount: string;
  currency: string;
  owner: string;
  totalDurationMinutes?: number;
  connectionNote?: string;
  segments: Array<{
    from: string;
    to: string;
    departure: string;
    arrival: string;
    carrier: string;
    flightNumber?: string;
    duration?: string;
    baggage?: string[];
  }>;
};

export type SerpApiFlightSearchResult =
  | { status: "provider_not_configured"; provider: "SerpApi"; environment: "unknown"; message: string; offers: [] }
  | { status: "no_offers"; provider: "SerpApi"; environment: "live"; checkedAt: string; originCode: string; destinationCode: string; offers: [] }
  | { status: "offers_found"; provider: "SerpApi"; environment: "live"; checkedAt: string; originCode: string; destinationCode: string; totalOffersReturned: number; hasMoreOffers: false; offers: SerpApiFlightOffer[] };

type GoogleFlightLeg = {
  departure_airport?: { name?: string; id?: string; time?: string };
  arrival_airport?: { name?: string; id?: string; time?: string };
  airline?: string;
  flight_number?: string;
  duration?: number;
  extensions?: string[];
};

type GoogleFlightItinerary = {
  flights?: GoogleFlightLeg[];
  price?: number | string;
  total_duration?: number;
  layovers?: Array<{ name?: string; id?: string; duration?: number }>;
  extensions?: string[];
};

const AIRPORT_CODES: Array<{ aliases: string[]; code: string }> = [
  { aliases: ["jammu"], code: "IXJ" }, { aliases: ["srinagar"], code: "SXR" },
  { aliases: ["delhi", "new delhi"], code: "DEL" }, { aliases: ["mumbai", "bombay"], code: "BOM" },
  { aliases: ["bengaluru", "bangalore"], code: "BLR" }, { aliases: ["chennai", "madras"], code: "MAA" },
  { aliases: ["kolkata", "calcutta"], code: "CCU" }, { aliases: ["hyderabad"], code: "HYD" },
  { aliases: ["ahmedabad"], code: "AMD" }, { aliases: ["pune"], code: "PNQ" },
  { aliases: ["goa", "dabolim"], code: "GOI" }, { aliases: ["mopa"], code: "GOX" },
  { aliases: ["leh"], code: "IXL" }, { aliases: ["amritsar"], code: "ATQ" },
  { aliases: ["jaipur"], code: "JAI" }, { aliases: ["lucknow"], code: "LKO" },
  { aliases: ["varanasi"], code: "VNS" }, { aliases: ["kochi", "cochin"], code: "COK" },
  { aliases: ["thiruvananthapuram", "trivandrum"], code: "TRV" },
  { aliases: ["patna"], code: "PAT" }, { aliases: ["indore"], code: "IDR" },
  { aliases: ["bhopal"], code: "BHO" }, { aliases: ["nagpur"], code: "NAG" },
  { aliases: ["chandigarh"], code: "IXC" }, { aliases: ["dehradun"], code: "DED" },
  { aliases: ["dhaka"], code: "DAC" }, { aliases: ["kathmandu"], code: "KTM" },
  { aliases: ["dubai"], code: "DXB" }, { aliases: ["abu dhabi"], code: "AUH" },
  { aliases: ["singapore"], code: "SIN" }, { aliases: ["london"], code: "LHR" },
  { aliases: ["paris"], code: "CDG" }, { aliases: ["new york"], code: "JFK" },
];

function resolveAirportCode(value: string): string {
  const normalized = value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/^[a-z]{3}$/i.test(value.trim())) return value.trim().toUpperCase();
  const match = AIRPORT_CODES.find(({ aliases }) => aliases.some(alias => normalized === alias || normalized.startsWith(alias + " ")));
  if (!match) throw new Error("FLIGHT_LOCATION_UNSUPPORTED:Enter a three-letter airport code or a supported city name.");
  return match.code;
}

function durationLabel(minutes?: number): string | undefined {
  if (!Number.isFinite(minutes) || !minutes || minutes < 0) return undefined;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}h` : "", remainder ? `${remainder}m` : ""].filter(Boolean).join(" ");
}

function baggageDetails(extensions: string[] = []): string[] {
  return extensions.filter(item => /baggage|carry.?on|checked bag/i.test(item));
}

async function serpApiRequest(params: URLSearchParams, apiKey: string) {
  params.set("engine", "google_flights");
  params.set("api_key", apiKey);
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });
  const body = await response.json() as {
    error?: string;
    best_flights?: GoogleFlightItinerary[];
    other_flights?: GoogleFlightItinerary[];
  };
  if (!response.ok || body.error) throw new Error(body.error || `SERPAPI_HTTP_${response.status}`);
  return body;
}

export async function searchSerpApiFlights(input: {
  origin: string; destination: string; departureDate: string; adults?: number; currency?: string;
}): Promise<SerpApiFlightSearchResult> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return {
    status: "provider_not_configured", provider: "SerpApi", environment: "unknown",
    message: "Flight search is not configured yet.", offers: [],
  };
  if (input.origin.trim().length < 2 || input.destination.trim().length < 2) throw new Error("INVALID_FLIGHT_LOCATIONS");
  const date = new Date(input.departureDate + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.departureDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.departureDate) {
    throw new Error("INVALID_FLIGHT_DATE");
  }
  const originCode = resolveAirportCode(input.origin);
  const destinationCode = resolveAirportCode(input.destination);
  if (originCode === destinationCode) throw new Error("FLIGHT_ORIGIN_EQUALS_DESTINATION");
  const currency = (input.currency ?? "INR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("INVALID_DISPLAY_CURRENCY");
  const adults = Math.min(9, Math.max(1, Math.floor(input.adults ?? 1)));
  const params = new URLSearchParams({
    departure_id: originCode,
    arrival_id: destinationCode,
    type: "2",
    outbound_date: input.departureDate,
    adults: String(adults),
    travel_class: "1",
    sort_by: "2",
    show_hidden: "true",
    deep_search: "true",
    currency,
    gl: "in",
    hl: "en",
  });
  const result = await serpApiRequest(params, apiKey);
  const itineraries = [...(result.best_flights ?? []), ...(result.other_flights ?? [])];
  const offers = itineraries.flatMap((itinerary, index) => {
    if (itinerary.price === undefined || !Array.isArray(itinerary.flights) || !itinerary.flights.length) return [];
    const segments = itinerary.flights.map(leg => ({
      from: [leg.departure_airport?.name, leg.departure_airport?.id].filter(Boolean).join(" (") + (leg.departure_airport?.name && leg.departure_airport?.id ? ")" : ""),
      to: [leg.arrival_airport?.name, leg.arrival_airport?.id].filter(Boolean).join(" (") + (leg.arrival_airport?.name && leg.arrival_airport?.id ? ")" : ""),
      departure: leg.departure_airport?.time ?? "",
      arrival: leg.arrival_airport?.time ?? "",
      carrier: leg.airline ?? "Airline details unavailable",
      ...(leg.flight_number ? { flightNumber: leg.flight_number } : {}),
      ...(durationLabel(leg.duration) ? { duration: durationLabel(leg.duration) } : {}),
      ...(baggageDetails([...(leg.extensions ?? []), ...(itinerary.extensions ?? [])]).length
        ? { baggage: baggageDetails([...(leg.extensions ?? []), ...(itinerary.extensions ?? [])]) } : {}),
    }));
    return [{
      id: `serpapi-${index}-${segments.map(segment => segment.flightNumber ?? segment.carrier).join("-")}`,
      amount: String(itinerary.price),
      currency,
      owner: "Google Flights via SerpApi",
      ...(itinerary.total_duration ? { totalDurationMinutes: itinerary.total_duration } : {}),
      segments,
    }];
  });
  offers.sort((a, b) => Number(a.amount) - Number(b.amount));
  if (offers.length) {
    return { status: "offers_found", provider: "SerpApi", environment: "live", checkedAt: new Date().toISOString(), originCode, destinationCode, totalOffersReturned: offers.length, hasMoreOffers: false, offers: offers.slice(0, 30) };
  }

  // Route recovery: construct a connection only when both legs are independently returned by Google Flights.
  const hubs = (destinationCode === "DEL" || destinationCode === "BOM" ? [] : ["DEL", "BOM", "DXB", "DOH"]).filter(code => code !== originCode && code !== destinationCode);
  const recovered: SerpApiFlightOffer[] = [];
  for (const hub of hubs.slice(0, 2)) {
    const firstParams = new URLSearchParams(params);
    firstParams.set("arrival_id", hub);
    const firstResponse = await serpApiRequest(firstParams, apiKey);
    const firstOptions = [...(firstResponse.best_flights ?? []), ...(firstResponse.other_flights ?? [])]
      .filter(item => item.price !== undefined && item.flights?.length).slice(0, 2);

    for (const first of firstOptions) {
      const firstLeg = first.flights![first.flights!.length - 1];
      const arrivalText = firstLeg.arrival_airport?.time ?? "";
      const arrivalDate = arrivalText.slice(0, 10);
      const arrivalMs = Date.parse(arrivalText.replace(" ", "T"));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) || !Number.isFinite(arrivalMs)) continue;

      const secondParams = new URLSearchParams(params);
      secondParams.set("departure_id", hub);
      secondParams.set("arrival_id", destinationCode);
      secondParams.set("outbound_date", arrivalDate);
      const secondResponse = await serpApiRequest(secondParams, apiKey);
      const secondOptions = [...(secondResponse.best_flights ?? []), ...(secondResponse.other_flights ?? [])]
        .filter(item => item.price !== undefined && item.flights?.length);
      const second = secondOptions.find(item => {
        const nextLeg = item.flights![0];
        const departureMs = Date.parse((nextLeg.departure_airport?.time ?? "").replace(" ", "T"));
        return Number.isFinite(departureMs) && departureMs >= arrivalMs + 2 * 60 * 60 * 1000 &&
          departureMs <= arrivalMs + 24 * 60 * 60 * 1000 && nextLeg.departure_airport?.id === hub;
      });
      if (!second) continue;

      const mapLegs = (item: GoogleFlightItinerary) => item.flights!.map(leg => ({
        from: [leg.departure_airport?.name, leg.departure_airport?.id].filter(Boolean).join(" (") + (leg.departure_airport?.name && leg.departure_airport?.id ? ")" : ""),
        to: [leg.arrival_airport?.name, leg.arrival_airport?.id].filter(Boolean).join(" (") + (leg.arrival_airport?.name && leg.arrival_airport?.id ? ")" : ""),
        departure: leg.departure_airport?.time ?? "",
        arrival: leg.arrival_airport?.time ?? "",
        carrier: leg.airline ?? "Airline details unavailable",
        ...(leg.flight_number ? { flightNumber: leg.flight_number } : {}),
        ...(durationLabel(leg.duration) ? { duration: durationLabel(leg.duration) } : {}),
        ...(baggageDetails([...(leg.extensions ?? []), ...(item.extensions ?? [])]).length
          ? { baggage: baggageDetails([...(leg.extensions ?? []), ...(item.extensions ?? [])]) } : {}),
      }));
      const segments = [...mapLegs(first), ...mapLegs(second)];
      const startMs = Date.parse(segments[0].departure.replace(" ", "T"));
      const endMs = Date.parse(segments[segments.length - 1].arrival.replace(" ", "T"));
      recovered.push({
        id: "serpapi-connection-" + hub + "-" + recovered.length,
        amount: String(Number(first.price) + Number(second.price)),
        currency,
        owner: "Google Flights via SerpApi",
        ...(Number.isFinite(startMs) && Number.isFinite(endMs) ? { totalDurationMinutes: Math.round((endMs - startMs) / 60000) } : {}),
        connectionNote: "Suggested connection via " + hub + ". These are separately searched flight legs. Confirm baggage collection, terminal transfer and ticket conditions before travel.",
        segments,
      });
    }
    if (recovered.length >= 6) break;
  }

  recovered.sort((a, b) => Number(a.amount) - Number(b.amount));
  if (recovered.length) {
    return { status: "offers_found", provider: "SerpApi", environment: "live", checkedAt: new Date().toISOString(), originCode, destinationCode, totalOffersReturned: recovered.length, hasMoreOffers: false, offers: recovered.slice(0, 30) };
  }

  // Nearby-airport fallback: only show real offers from an alternate airport with an explicit warning.
  const nearbyAirports: Record<string, Array<{ code: string; city: string }>> = {
    IXJ: [{ code: "SXR", city: "Srinagar" }, { code: "ATQ", city: "Amritsar" }, { code: "IXC", city: "Chandigarh" }],
    SXR: [{ code: "IXJ", city: "Jammu" }, { code: "ATQ", city: "Amritsar" }, { code: "IXC", city: "Chandigarh" }],
    ATQ: [{ code: "IXJ", city: "Jammu" }, { code: "IXC", city: "Chandigarh" }, { code: "SXR", city: "Srinagar" }],
    IXC: [{ code: "ATQ", city: "Amritsar" }, { code: "IXJ", city: "Jammu" }, { code: "SXR", city: "Srinagar" }],
  };
  const nearbyOffers: SerpApiFlightOffer[] = [];
  const nearbyResults = await Promise.all((nearbyAirports[originCode] ?? []).slice(0, 3).map(async alternate => {
    const alternateParams = new URLSearchParams(params);
    alternateParams.set("departure_id", alternate.code);
    alternateParams.set("arrival_id", destinationCode);
    const alternateResult = await serpApiRequest(alternateParams, apiKey);
    return { alternate, itineraries: [...(alternateResult.best_flights ?? []), ...(alternateResult.other_flights ?? [])] };
  }));
  for (const { alternate, itineraries } of nearbyResults) {
    for (const itinerary of itineraries) {
      if (itinerary.price === undefined || !itinerary.flights?.length) continue;
      const segments = itinerary.flights.map(leg => ({
        from: [leg.departure_airport?.name, leg.departure_airport?.id].filter(Boolean).join(" (") + (leg.departure_airport?.name && leg.departure_airport?.id ? ")" : ""),
        to: [leg.arrival_airport?.name, leg.arrival_airport?.id].filter(Boolean).join(" (") + (leg.arrival_airport?.name && leg.arrival_airport?.id ? ")" : ""),
        departure: leg.departure_airport?.time ?? "",
        arrival: leg.arrival_airport?.time ?? "",
        carrier: leg.airline ?? "Airline details unavailable",
        ...(leg.flight_number ? { flightNumber: leg.flight_number } : {}),
        ...(durationLabel(leg.duration) ? { duration: durationLabel(leg.duration) } : {}),
        ...(baggageDetails([...(leg.extensions ?? []), ...(itinerary.extensions ?? [])]).length
          ? { baggage: baggageDetails([...(leg.extensions ?? []), ...(itinerary.extensions ?? [])]) } : {}),
      }));
      nearbyOffers.push({
        id: "serpapi-nearby-" + alternate.code + "-" + nearbyOffers.length,
        amount: String(itinerary.price), currency, owner: "Google Flights via SerpApi",
        ...(itinerary.total_duration ? { totalDurationMinutes: itinerary.total_duration } : {}),
        connectionNote: "Alternative departure airport: " + alternate.city + " (" + alternate.code + "). This flight does not depart from " + input.origin + ". Arrange your own transport to " + alternate.city + " and allow enough time before departure.",
        segments,
      });
    }
  }
  nearbyOffers.sort((a, b) => Number(a.amount) - Number(b.amount));
  if (nearbyOffers.length) {
    return { status: "offers_found", provider: "SerpApi", environment: "live", checkedAt: new Date().toISOString(), originCode, destinationCode, totalOffersReturned: nearbyOffers.length, hasMoreOffers: false, offers: nearbyOffers.slice(0, 12) };
  }
  return { status: "no_offers", provider: "SerpApi", environment: "live", checkedAt: new Date().toISOString(), originCode, destinationCode, offers: [] };
}
