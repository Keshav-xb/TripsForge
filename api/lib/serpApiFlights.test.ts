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
