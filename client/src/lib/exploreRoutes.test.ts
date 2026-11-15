import { describe, expect, it } from "vitest";
import { SAMPLE_ROUTES, formatRouteBudget } from "./routeData";

describe("Explore Routes catalog", () => {
  it("starts with a small, clearly identified sample set", () => {
    expect(SAMPLE_ROUTES).toHaveLength(6);
    expect(SAMPLE_ROUTES.every((route) => route.isSample)).toBe(true);
    expect(new Set(SAMPLE_ROUTES.map((route) => route.slug)).size).toBe(SAMPLE_ROUTES.length);
  });

  it("contains enough route metadata for cards and detail pages", () => {
    for (const route of SAMPLE_ROUTES) {
      expect(route.startDestination).toBeTruthy();
      expect(route.endDestination).toBeTruthy();
      expect(route.intermediateStops.length).toBeGreaterThan(0);
      expect(route.durationDays).toBeGreaterThan(0);
      expect(route.budgetMax).toBeGreaterThanOrEqual(route.budgetMin);
      expect(route.photoUrl).toMatch(/^https:\/\//);
      expect(route.highlights.length).toBeGreaterThan(0);
    }
  });

  it("formats an easy-to-scan budget range", () => {
    expect(formatRouteBudget(22000, 48000)).toBe("₹22,000–₹48,000");
  });
});
