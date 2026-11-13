import { describe, expect, it } from "vitest";
import { buildTrip, defaultPlan } from "@/lib/tripData";
import { parseScenarioInstruction, simulateTrip } from "@/lib/tripSimulator";

describe("TripForge Simulator", () => {
  const trip = buildTrip(defaultPlan);

  it("recalculates duration, transport and budget without mutating the original trip", () => {
    const result = simulateTrip(trip, { budgetDelta: 5000, dayDelta: 2, destination: "Goa", transportation: "flight", travelStyle: "Comfortable" });
    expect(result.original.destination.name).toBe("Jaipur");
    expect(result.simulated.destination.name).toBe("Goa");
    expect(result.simulated.days.length).toBe(trip.days.length + 2);
    expect(result.simulated.budget.total).toBeGreaterThan(trip.budget.total);
    expect(result.assumptions[0]).toContain("planning estimates");
  });

  it("extracts common what-if controls from a natural-language request", () => {
    expect(parseScenarioInstruction("Increase my budget by ₹5,000, add 2 days and use flights", trip)).toMatchObject({ budgetDelta: 5000, dayDelta: 2, transportation: "flight" });
  });
});
