import { describe, expect, it } from "vitest";
import { assessRouteFeasibility, haversineDistanceKm, type ResolvedPlace } from "./routeFeasibility";

const jammu: ResolvedPlace = { label: "Jammu, India", lat: 32.7266, lng: 74.8570, countryCode: "IN" };
const paris: ResolvedPlace = { label: "Paris, France", lat: 48.8566, lng: 2.3522, countryCode: "FR" };

describe("route feasibility intelligence", () => {
  it("calculates geographic distance without treating it as a route", () => {
    expect(haversineDistanceKm(jammu, paris)).toBeGreaterThan(6000);
    const result = assessRouteFeasibility(jammu, paris);
    expect(result.journeyContext).toBe("international");
    expect(result.recommendation).toBe("provider_data_required");
    expect(result.assessments.every(item => item.status === "unverified" && !item.recommendable)).toBe(true);
  });

  it("only recommends modes backed by a positive provider verdict", () => {
    const result = assessRouteFeasibility(jammu, paris, {
      flight: { verdict: "available", provider: "Test airline provider", detail: "A matching flight itinerary was returned." },
      car: { verdict: "unavailable", provider: "Test road router" },
    });
    expect(result.assessments.find(item => item.mode === "flight")?.recommendable).toBe(true);
    expect(result.assessments.find(item => item.mode === "car")?.status).toBe("not_found");
    expect(result.assessments.find(item => item.mode === "train")?.status).toBe("unverified");
  });

  it("does not infer bus or train service from same-country geography", () => {
    const delhi: ResolvedPlace = { label: "Delhi, India", lat: 28.6139, lng: 77.2090, countryCode: "IN" };
    const result = assessRouteFeasibility(jammu, delhi);
    expect(result.journeyContext).toBe("domestic");
    expect(result.assessments.find(item => item.mode === "bus")?.recommendable).toBe(false);
    expect(result.assessments.find(item => item.mode === "train")?.status).toBe("unverified");
  });

  it("detects identical resolved locations", () => {
    const result = assessRouteFeasibility(jammu, { ...jammu, label: "Jammu city" });
    expect(result.recommendation).toBe("same_location");
    expect(result.assessments.every(item => item.status === "not_found")).toBe(true);
  });

  it("rejects unresolved or invalid coordinates", () => {
    expect(() => assessRouteFeasibility(jammu, { ...paris, lat: 200 })).toThrow("ROUTE_REQUIRES_RESOLVED_COORDINATES");
  });
});
