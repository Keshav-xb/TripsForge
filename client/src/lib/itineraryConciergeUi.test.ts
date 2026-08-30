import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const itinerarySource = readFileSync(resolve(process.cwd(), "client/src/pages/Itinerary.tsx"), "utf8");

describe("Adaptive Concierge itinerary UI contract", () => {
  it("keeps preview, comparison, apply, persistence, and undo controls connected", () => {
    expect(itinerarySource).toContain('text="Optimize my day"');
    expect(itinerarySource).toContain("A smoother route is ready.");
    expect(itinerarySource).toContain("Current order");
    expect(itinerarySource).toContain("Suggested order");
    expect(itinerarySource).toContain("Apply optimized day");
    expect(itinerarySource).toContain("Concierge update applied.");
    expect(itinerarySource).toContain("Undo");
    expect(itinerarySource).toContain("applyOptimizedDay");
    expect(itinerarySource).toContain("restoreDay");
    expect(itinerarySource).toContain("persistTrip(nextTrip, false)");
  });
});
