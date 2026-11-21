import { afterEach, describe, expect, it } from "vitest";
import { searchSerpApiFlights } from "./serpApiFlights";

const originalKey = process.env.SERPAPI_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalKey === undefined) delete process.env.SERPAPI_API_KEY;
  else process.env.SERPAPI_API_KEY = originalKey;
  globalThis.fetch = originalFetch;
});

describe("searchSerpApiFlights", () => {
  it("reports missing credentials without pretending a search happened", async () => {
    delete process.env.SERPAPI_API_KEY;
    const result = await searchSerpApiFlights({
      origin: "Jammu", destination: "Delhi", departureDate: "2026-12-20",
    });
    expect(result.status).toBe("provider_not_configured");
    expect(result.offers).toEqual([]);
  });

  it("requests one-way Indian flight results and maps multiple itineraries", async () => {
    process.env.SERPAPI_API_KEY = "server-only-test-key";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://serpapi.com");
      expect(url.searchParams.get("engine")).toBe("google_flights");
      expect(url.searchParams.get("departure_id")).toBe("IXJ");
      expect(url.searchParams.get("arrival_id")).toBe("DEL");
      expect(url.searchParams.get("type")).toBe("2");
      expect(url.searchParams.get("outbound_date")).toBe("2026-12-20");
      expect(url.searchParams.get("currency")).toBe("INR");
      expect(url.searchParams.get("deep_search")).toBe("true");
      expect(url.searchParams.get("api_key")).toBe("server-only-test-key");
      return new Response(JSON.stringify({
        best_flights: [{
          price: 5400,
          total_duration: 115,
          flights: [{
            departure_airport: { name: "Jammu Airport", id: "IXJ", time: "2026-12-20 10:00" },
            arrival_airport: { name: "Delhi Airport", id: "DEL", time: "2026-12-20 11:55" },
            airline: "Example Air", flight_number: "EA101", duration: 115,
            extensions: ["1 checked bag included"],
          }],
        }],
        other_flights: [{
          price: 6200,
          flights: [{
            departure_airport: { name: "Jammu Airport", id: "IXJ", time: "2026-12-20 15:00" },
            arrival_airport: { name: "Delhi Airport", id: "DEL", time: "2026-12-20 16:55" },
            airline: "Sample Airlines", flight_number: "SA202", duration: 115,
          }],
        }],
      }), { status: 200 });
    }) as typeof fetch;

    const result = await searchSerpApiFlights({
      origin: "Jammu, India", destination: "Delhi", departureDate: "2026-12-20", adults: 1, currency: "INR",
    });
    expect(result.status).toBe("offers_found");
    if (result.status === "offers_found") {
      expect(result.provider).toBe("SerpApi");
      expect(result.offers).toHaveLength(2);
      expect(result.offers[0].amount).toBe("5400");
      expect(result.offers[0].segments[0].carrier).toBe("Example Air");
      expect(result.offers[0].segments[0].baggage).toEqual(["1 checked bag included"]);
      expect(result.offers[0].totalDurationMinutes).toBe(115);
    }
  });


  it("builds a verified Delhi connection when the complete route has no returned itinerary", async () => {
    process.env.SERPAPI_API_KEY = "server-only-test-key";
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const from = url.searchParams.get("departure_id");
      const to = url.searchParams.get("arrival_id");
      calls.push(from + "-" + to);
      if (from === "IXJ" && to === "CDG") {
        return new Response(JSON.stringify({ best_flights: [], other_flights: [] }), { status: 200 });
      }
      if (from === "IXJ" && to === "DEL") {
        return new Response(JSON.stringify({ best_flights: [{
          price: 5000,
          flights: [{
            departure_airport: { name: "Jammu Airport", id: "IXJ", time: "2026-12-20 08:00" },
            arrival_airport: { name: "Delhi Airport", id: "DEL", time: "2026-12-20 09:30" },
            airline: "North Air", flight_number: "NA101", duration: 90,
          }],
        }] }), { status: 200 });
      }
      if (from === "DEL" && to === "CDG") {
        return new Response(JSON.stringify({ best_flights: [{
          price: 28000,
          flights: [{
            departure_airport: { name: "Delhi Airport", id: "DEL", time: "2026-12-20 13:00" },
            arrival_airport: { name: "Paris Charles de Gaulle", id: "CDG", time: "2026-12-20 19:00" },
            airline: "Example International", flight_number: "EI202", duration: 600,
          }],
        }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ best_flights: [], other_flights: [] }), { status: 200 });
    }) as typeof fetch;

    const result = await searchSerpApiFlights({
      origin: "Jammu", destination: "Paris", departureDate: "2026-12-20", adults: 1, currency: "INR",
    });
    expect(result.status).toBe("offers_found");
    if (result.status === "offers_found") {
      expect(result.offers[0].amount).toBe("33000");
      expect(result.offers[0].segments).toHaveLength(2);
      expect(result.offers[0].segments[0].to).toContain("DEL");
      expect(result.offers[0].segments[1].from).toContain("DEL");
      expect(result.offers[0].connectionNote).toContain("separately searched flight legs");
    }
    expect(calls).toContain("IXJ-CDG");
    expect(calls).toContain("IXJ-DEL");
    expect(calls).toContain("DEL-CDG");
  });

  it("returns a clearly labelled nearby-airport option when the requested origin has no flight", async () => {
    process.env.SERPAPI_API_KEY = "server-only-test-key";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const from = url.searchParams.get("departure_id");
      const to = url.searchParams.get("arrival_id");
      if (from === "SXR" && to === "DEL") {
        return new Response(JSON.stringify({ best_flights: [{
          price: 4200,
          flights: [{
            departure_airport: { name: "Sheikh ul Alam Airport", id: "SXR", time: "2026-12-20 09:00" },
            arrival_airport: { name: "Indira Gandhi International Airport", id: "DEL", time: "2026-12-20 10:30" },
            airline: "Example Air", flight_number: "EA303", duration: 90,
          }],
        }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ best_flights: [], other_flights: [] }), { status: 200 });
    }) as typeof fetch;

    const result = await searchSerpApiFlights({
      origin: "Jammu", destination: "Delhi", departureDate: "2026-12-20", adults: 1, currency: "INR",
    });
    expect(result.status).toBe("offers_found");
    if (result.status === "offers_found") {
      expect(result.offers[0].segments[0].from).toContain("SXR");
      expect(result.offers[0].connectionNote).toContain("Alternative departure airport: Srinagar");
      expect(result.offers[0].connectionNote).toContain("does not depart from Jammu");
    }
  });

  it("rejects unsupported city names and invalid dates", async () => {
    process.env.SERPAPI_API_KEY = "server-only-test-key";
    await expect(searchSerpApiFlights({
      origin: "Unknown City", destination: "Delhi", departureDate: "2026-12-20",
    })).rejects.toThrow("FLIGHT_LOCATION_UNSUPPORTED");
    await expect(searchSerpApiFlights({
      origin: "Jammu", destination: "Delhi", departureDate: "not-a-date",
    })).rejects.toThrow("INVALID_FLIGHT_DATE");
  });

  it("surfaces provider errors rather than showing fabricated results", async () => {
    process.env.SERPAPI_API_KEY = "server-only-test-key";
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "Invalid API key" }), { status: 401 })) as typeof fetch;
    await expect(searchSerpApiFlights({
      origin: "Jammu", destination: "Delhi", departureDate: "2026-12-20",
    })).rejects.toThrow("Invalid API key");
  });
});
