import { describe, expect, it } from "vitest";
import { assessTripReadiness } from "./tripReadiness";

const completePlan = {
  origin: "Jammu", destination: "Delhi", originConfirmed: true, destinationConfirmed: true,
  startDate: "2027-01-10", endDate: "2027-01-13", travellers: 2,
  budgetLimit: 30000, estimatedTotal: 24000, pricedCategoryCoverage: 80,
  enabledLegs: [{ origin: "Jammu", destination: "Delhi", mode: "train", unitCost: 3000 }],
  interests: ["Food", "History"], routeResearchCompleted: true,
};

describe("assessTripReadiness", () => {
  it("scores a fully specified plan and gives a final verification action", () => {
    const result = assessTripReadiness(completePlan);
    expect(result.score).toBe(100);
    expect(result.openChecks).toHaveLength(0);
    expect(result.nextBestAction).toContain("Verify operator schedules");
  });

  it("identifies missing critical inputs without claiming the trip is unsafe", () => {
    const result = assessTripReadiness({
      ...completePlan, originConfirmed: false, endDate: completePlan.startDate,
      enabledLegs: [{ origin: "Jammu", destination: "Delhi", mode: "unverified", unitCost: 0 }],
    });
    expect(result.blockers.map(item => item.id)).toContain("origin");
    expect(result.blockers.map(item => item.id)).toContain("dates");
    expect(result.openChecks.map(item => item.id)).toContain("transport");
    expect(result.disclaimer).toContain("not trip safety");
  });
});
