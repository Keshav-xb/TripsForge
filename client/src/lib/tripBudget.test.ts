import { describe, expect, it } from "vitest";
import {
  calculateAllBudgetScenarios,
  calculateBudgetScenario,
  getTripNights,
  type BudgetTripInputs,
} from "./tripBudget";

const baseTrip: BudgetTripInputs = {
  startDate: "2027-02-10",
  endDate: "2027-02-15",
  adults: 2,
  children: 1,
  infants: 0,
  rooms: 2,
  currency: "INR",
  items: [
    {
      id: "hotel",
      label: "Accommodation",
      category: "accommodation",
      enabled: true,
      unitCost: 3000,
      quantityRule: "per_room_per_night",
      sourceType: "traveller_input",
      sourceLabel: "Entered by traveller",
      currency: "INR",
    },
    {
      id: "meal",
      label: "Meals",
      category: "food",
      enabled: true,
      unitCost: 500,
      quantityRule: "per_person_per_night",
      sourceType: "modeled_estimate",
      sourceLabel: "Test estimate",
      currency: "INR",
      scenarioUnitCosts: { economy: 350, comfort: 800 },
    },
    {
      id: "airport-transfer",
      label: "Airport transfer",
      category: "transport",
      enabled: true,
      unitCost: 1200,
      quantityRule: "per_trip",
      sourceType: "provider_estimate",
      sourceLabel: "Test provider",
      currency: "INR",
    },
  ],
};

describe("dynamic trip budget engine", () => {
  it("calculates trip nights from dates", () => {
    expect(getTripNights("2027-02-10", "2027-02-15")).toBe(5);
    expect(getTripNights("2027-02-15", "2027-02-10")).toBe(0);
  });

  it("scales shared rooms and per-person costs independently", () => {
    const result = calculateBudgetScenario(baseTrip, "expected");
    expect(result.categoryTotals.accommodation).toBe(30_000);
    expect(result.categoryTotals.food).toBe(7_500);
    expect(result.categoryTotals.transport).toBe(1_200);
    expect(result.total).toBe(38_700);
    expect(result.perPerson).toBe(12_900);
  });

  it("supports scenario-specific prices and reports source totals", () => {
    const results = calculateAllBudgetScenarios(baseTrip);
    expect(results.economy.categoryTotals.food).toBe(5_250);
    expect(results.comfort.categoryTotals.food).toBe(12_000);
    expect(results.expected.travellerInputTotal).toBe(30_000);
    // Provider estimates are grouped with modeled estimates in the source summary.
    expect(results.expected.modeledEstimateTotal).toBe(8_700);
    expect(results.expected.liveQuoteTotal).toBe(0);
  });

  it("excludes disabled categories and exposes missing price coverage", () => {
    const trip = {
      ...baseTrip,
      items: baseTrip.items.map(item =>
        item.id === "meal" ? { ...item, enabled: false } : item
      ),
    };
    const result = calculateBudgetScenario(trip, "expected");
    expect(result.categoryTotals.food).toBe(0);
    expect(result.unpricedCategories).toContain("food");
    expect(result.pricedCategoryCoverage).toBeLessThan(100);
  });
});
