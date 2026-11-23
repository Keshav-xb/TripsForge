import { describe, expect, it } from "vitest";
import { createJourneyOptions } from "./journeyOptionBuilder";

const research = {
  origin: "Jammu",
  destination: "Delhi",
  road: { status: "route_found", durationMinutes: 720, provider: "OSRM" },
  trainAvailability: {
    status: "offers_found",
    provider: "RailCore",
    trains: [{ trainNumber: "12345", trainName: "Example Express", durationMinutes: 600 }],
  },
};

describe("createJourneyOptions", () => {
  it("compares only provider-backed flights, trains and road estimates", () => {
    const result = createJourneyOptions({
      research,
      flights: {
        status: "offers_found",
        provider: "SerpApi",
        offers: [{ id: "flight-1", amount: "4500", currency: "INR", totalDurationMinutes: 95 }],
      },
    });
    expect(result.options).toHaveLength(3);
    expect(result.options.map(option => option.legs[0].mode)).toEqual(
      expect.arrayContaining(["flight", "train", "car"]),
    );
  });

  it("does not invent bus results when a provider has none", () => {
    const result = createJourneyOptions({
      research: { ...research, trainAvailability: { status: "no_service_found", provider: "RailCore", trains: [] } },
      buses: { status: "no_service_found", provider: "Reclaim India GTFS", offers: [] },
    });
    expect(result.options).toHaveLength(1);
    expect(result.options[0].legs[0].mode).toBe("car");
  });

  it("does not claim intermodal connections without exact intermediate nodes", () => {
    const result = createJourneyOptions({
      research,
      flights: { status: "offers_found", provider: "SerpApi", offers: [{ id: "flight-1", amount: "4500", currency: "INR" }] },
      buses: { status: "offers_found", provider: "GTFS", offers: [{ route: "R1", departureTime: "08:00", fromStop: "Jammu", toStop: "Delhi" }] },
    });
    expect(result.options.every(option => option.legs.length === 1)).toBe(true);
  });
});
