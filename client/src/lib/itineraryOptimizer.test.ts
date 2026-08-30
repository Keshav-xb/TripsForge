import { describe, expect, it } from "vitest";
import { applyOptimizedDay, optimizeDay, restoreDay } from "./itineraryOptimizer";
import type { DayPlan } from "./tripData";

const day: DayPlan = {
  day: 1,
  title: "Old city circuit",
  subtitle: "3 route moments",
  activities: [
    { time: "09:00", title: "Heritage breakfast", description: "A calm start.", category: "Food", cost: 300, duration: "45 min", distance: "0 km", location: { lat: 26.9209, lng: 75.8232 }, id: "anchor", marker: 1 },
    { time: "11:00", title: "Amber Fort", description: "A long scenic transfer.", category: "History", cost: 700, duration: "2 hr", distance: "11.4 km", location: { lat: 26.9855, lng: 75.8513 }, id: "far", marker: 2 },
    { time: "10:00", title: "City Palace", description: "A nearby gallery.", category: "Culture", cost: 500, duration: "1 hr", distance: "2.1 km", location: { lat: 26.9258, lng: 75.8237 }, id: "near", marker: 3 },
  ],
};

const options = { travelStyle: "Balanced" as const, budgetLevel: "Balanced" as const, interests: ["Culture" as const] };

describe("optimizeDay", () => {
  it("groups nearby stops, preserves costs, and explains the route change", () => {
    const result = optimizeDay(day, options);

    expect(result.day.activities.map((activity) => activity.id)).toEqual(["anchor", "near", "far"]);
    expect(result.day.activities.map((activity) => activity.marker)).toEqual([1, 2, 3]);
    expect(result.day.activities.map((activity) => activity.cost)).toEqual([300, 500, 700]);
    expect(result.movedActivities).toBe(2);
    expect(result.distanceSavedKm).toBeGreaterThan(0);
    expect(result.reasons).toHaveLength(3);
    expect(result.reasons.join(" ")).toContain("culture");
    expect(result.day.subtitle).toContain("shorter movement");
  });

  it("applies the previewed day and restores the previous order for undo", () => {
    const trip = { destination: { name: "Jaipur" }, days: [day] } as never;
    const result = optimizeDay(day, options);
    const applied = applyOptimizedDay(trip, 0, result.day);
    expect(applied.days[0].activities.map((activity: { id: string }) => activity.id)).toEqual(["anchor", "near", "far"]);

    const restored = restoreDay(applied, 0, day);
    expect(restored.days[0]).toEqual(day);
  });

  it("leaves a one-stop day unchanged with a clear explanation", () => {
    const singleStop = { ...day, activities: [day.activities[0]] };
    const result = optimizeDay(singleStop, options);

    expect(result.day).toEqual(singleStop);
    expect(result.movedActivities).toBe(0);
    expect(result.distanceSavedKm).toBe(0);
    expect(result.reasons[0]).toContain("already compact");
  });
});
