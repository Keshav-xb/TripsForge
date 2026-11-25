import { afterEach, describe, expect, it } from "vitest";
import { searchSerpApiFlights } from "./serpApiFlights";

const originalKey = process.env.SERPAPI_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalKey === undefined) delete process.env.SERPAPI_API_KEY;
  else process.env.SERPAPI_API_KEY = originalKey;
  globalThis.fetch = originalFetch;
});

describe("indirect flight route composition", () => {
  it("keeps a direct itinerary and adds a valid connecting itinerary", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    const requested: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const from = url.searchParams.get("departure_id") ?? "";
      const to = url.searchParams.get("arrival_id") ?? "";
      requested.push(from + "-" + to);

      if (from === "IXJ" && to === "CDG") {
        return new Response(JSON.stringify({ best_flights: [{
          price: 42000,
          flights: [{
            departure_airport: { name: "Jammu Airport", id: "IXJ", time: "2026-12-20 06:00" },
            arrival_airport: { name: "Paris Charles de Gaulle", id: "CDG", time: "2026-12-20 20:00" },
            airline: "Direct Air", flight_number: "DA900", duration: 780,
          }],
        }], other_flights: [] }), { status: 200 });
      }

      if (from === "IXJ" && to === "DEL") {
        return new Response(JSON.stringify({ best_flights: [{
          price: 5000,
          flights: [{
            departure_airport: { name: "Jammu Airport", id: "IXJ", time: "2026-12-20 08:00" },
            arrival_airport: { name: "Delhi Airport", id: "DEL", time: "2026-12-20 09:30" },
            airline: "North Air", flight_number: "NA101", duration: 90,
          }],
        }], other_flights: [] }), { status: 200 });
      }

      if (from === "DEL" && to === "CDG") {
        return new Response(JSON.stringify({ best_flights: [{
          price: 28000,
          flights: [{
            departure_airport: { name: "Delhi Airport", id: "DEL", time: "2026-12-20 13:00" },
            arrival_airport: { name: "Paris Charles de Gaulle", id: "CDG", time: "2026-12-20 19:00" },
            airline: "International Air", flight_number: "IA202", duration: 600,
          }],
        }], other_flights: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({ best_flights: [], other_flights: [] }), { status: 200 });
    }) as typeof fetch;

    const result = await searchSerpApiFlights({
      origin: "Jammu", destination: "Paris", departureDate: "2026-12-20",
      adults: 1, currency: "INR",
    });

    expect(result.status).toBe("offers_found");
    if (result.status === "offers_found") {
      const direct = result.offers.find(offer => offer.amount === "42000");
      const connection = result.offers.find(offer => offer.amount === "33000");
      expect(direct?.segments).toHaveLength(1);
      expect(connection?.segments).toHaveLength(2);
      expect(connection?.segments[0].to).toContain("DEL");
      expect(connection?.segments[1].from).toContain("DEL");
      expect(connection?.connectionNote).toContain("separately searched flight legs");
    }
    expect(requested).toContain("IXJ-CDG");
    expect(requested).toContain("IXJ-DEL");
    expect(requested).toContain("DEL-CDG");
  });
});
