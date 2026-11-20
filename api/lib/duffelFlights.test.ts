import { afterEach, describe, expect, it } from "vitest";
import { searchDuffelFlights } from "./duffelFlights";

const originalToken = process.env.DUFFEL_ACCESS_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.DUFFEL_ACCESS_TOKEN;
  else process.env.DUFFEL_ACCESS_TOKEN = originalToken;
});

describe("searchDuffelFlights", () => {
  it("reports provider setup as missing without pretending a search happened", async () => {
    delete process.env.DUFFEL_ACCESS_TOKEN;
    const result = await searchDuffelFlights({
      origin: "Jammu, India",
      destination: "Delhi, India",
      departureDate: "2026-12-20",
    });
    expect(result.status).toBe("provider_not_configured");
    expect(result.offers).toEqual([]);
  });

  it("identifies Duffel sandbox tokens as test environment", async () => {
    process.env.DUFFEL_ACCESS_TOKEN = "duffel_test_example";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/places/suggestions")) {
        const query = new URL(url).searchParams.get("query");
        return new Response(JSON.stringify({ data: [{ type: "city", name: query, iata_code: query?.includes("Jammu") ? "IXJ" : "DEL" }] }), { status: 200 });
      }
      if (url.includes("/air/offer_requests")) {
        expect(url).toContain("return_offers=false");
        return new Response(JSON.stringify({ data: { id: "orq_test" } }), { status: 200 });
      }
      expect(url).toContain("/air/offers?");
      expect(url).toContain("offer_request_id=orq_test");
      expect(url).toContain("limit=200");
      expect(url).toContain("sort=total_amount");
      return new Response(JSON.stringify({ data: [{ id: "off_test", total_amount: "100.00", total_currency: "USD", slices: [] }] }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await searchDuffelFlights({ origin: "Jammu", destination: "Delhi", departureDate: "2026-12-20" });
      expect(result.status).toBe("offers_found");
      if (result.status === "offers_found") expect(result.environment).toBe("test");
    } finally { globalThis.fetch = originalFetch; }
  });


  it("shows operating airline names and returns more than five offers sorted by price", async () => {
    process.env.DUFFEL_ACCESS_TOKEN = "duffel_live_example";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/places/suggestions")) {
        const query = new URL(url).searchParams.get("query");
        return new Response(JSON.stringify({ data: [{ type: "city", name: query, iata_code: query?.includes("Jammu") ? "IXJ" : "DEL" }] }), { status: 200 });
      }
      if (url.includes("/air/offer_requests")) {
        return new Response(JSON.stringify({ data: { id: "orq_many" } }), { status: 200 });
      }
      expect(url).toContain("offer_request_id=orq_many");
      const offers = Array.from({ length: 8 }, (_, index) => ({
        id: `offer_${index}`,
        total_amount: String(800 - index * 50),
        total_currency: "INR",
        owner: { name: "Duffel" },
        slices: [{ segments: [{
          origin: { name: "Jammu", iata_code: "IXJ" },
          destination: { name: "Delhi", iata_code: "DEL" },
          departing_at: "2026-12-20T10:00:00",
          arriving_at: "2026-12-20T11:30:00",
          operating_carrier: { name: "Example Air" },
          marketing_carrier: { name: "Example Marketing" },
          marketing_carrier_flight_number: "EA123",
        }] }],
      }));
      return new Response(JSON.stringify({ data: offers }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await searchDuffelFlights({ origin: "Jammu", destination: "Delhi", departureDate: "2026-12-20" });
      expect(result.status).toBe("offers_found");
      if (result.status === "offers_found") {
        expect(result.offers).toHaveLength(8);
        expect(result.offers[0].amount).toBe("450");
        expect(result.offers[0].segments[0].carrier).toBe("Example Air");
        expect(result.offers[0].segments[0].marketingCarrier).toBe("Example Marketing");
      }
    } finally { globalThis.fetch = originalFetch; }
  });

  it("rejects invalid travel dates before contacting the provider", async () => {
    process.env.DUFFEL_ACCESS_TOKEN = "test-token";
    await expect(searchDuffelFlights({
      origin: "Jammu, India",
      destination: "Delhi, India",
      departureDate: "not-a-date",
    })).rejects.toThrow("INVALID_FLIGHT_DATE");
  });
});
