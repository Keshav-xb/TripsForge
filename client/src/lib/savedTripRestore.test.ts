import { describe, expect, it } from "vitest";
import { shouldRestoreSavedTrip } from "./savedTripRestore";

describe("shouldRestoreSavedTrip", () => {
  it("loads an authenticated saved route that has not yet been restored", () => {
    expect(shouldRestoreSavedTrip({ savedTripId: "route-1", isAuthenticated: true, restoredTripId: null })).toBe(true);
  });

  it("does not re-load the same route after restoring it into trip state", () => {
    expect(shouldRestoreSavedTrip({ savedTripId: "route-1", isAuthenticated: true, restoredTripId: "route-1" })).toBe(false);
  });

  it("does not fetch private saved routes before authentication", () => {
    expect(shouldRestoreSavedTrip({ savedTripId: "route-1", isAuthenticated: false, restoredTripId: null })).toBe(false);
  });
});
