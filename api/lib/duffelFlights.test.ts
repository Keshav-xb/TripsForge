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
      return new Response(JSON.stringify({ data: { offers: [{ id: "off_test", total_amount: "100.00", total_currency: "USD", slices: [] }] } }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await searchDuffelFlights({ origin: "Jammu", destination: "Delhi", departureDate: "2026-12-20" });
      expect(result.status).toBe("offers_found");
      if (result.status === "offers_found") expect(result.environment).toBe("test");
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
