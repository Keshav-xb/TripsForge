import { describe, expect, it } from "vitest";
import { buildTrip, defaultPlan, diversifyTripWithPlaces } from "./tripData";

describe("unique itinerary planning", () => {
  it("does not replace already-unique curated stops", () => {
    const trip = buildTrip({ ...defaultPlan, endDate: "2026-10-18" });
    const places = [{ id: "live-1", name: "A different live place", category: "Food" as const, location: { lat: 26.91, lng: 75.78 } }];
    const diversified = diversifyTripWithPlaces(trip, places);
    expect(diversified.days[0].activities.map(activity => activity.title)).toEqual(trip.days[0].activities.map(activity => activity.title));
  });

  it("replaces repeated generated stops with distinct live places across days", () => {
    const trip = buildTrip({ ...defaultPlan, endDate: "2026-10-21", travelStyle: "Packed" });
    const places = ["Amber Sky Kitchen", "Pink City Ceramics", "Lakeside Courtyard", "Moonlit Bazaar"].map((name, index) => ({
      id: `live-${index}`,
      name,
      category: "Local pick" as const,
      location: { lat: 26.9 + index / 100, lng: 75.78 + index / 100 },
    }));
    const diversified = diversifyTripWithPlaces(trip, places);
    const titles = diversified.days.flatMap(day => day.activities.map(activity => activity.title));
    expect(new Set(titles).size).toBeGreaterThan(new Set(trip.days.flatMap(day => day.activities.map(activity => activity.title))).size);
    expect(titles).toContain("Amber Sky Kitchen");
    expect(new Set(titles).size).toBeGreaterThanOrEqual(20);
  });
});
