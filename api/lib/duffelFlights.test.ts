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

  it("rejects invalid travel dates before contacting the provider", async () => {
    process.env.DUFFEL_ACCESS_TOKEN = "test-token";
    await expect(searchDuffelFlights({
      origin: "Jammu, India",
      destination: "Delhi, India",
      departureDate: "not-a-date",
    })).rejects.toThrow("INVALID_FLIGHT_DATE");
  });
});
