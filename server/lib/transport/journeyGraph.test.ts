import { describe, expect, it } from "vitest";
import { buildJourneyOptions, type JourneyCandidateLeg } from "./journeyGraph";

const legs: JourneyCandidateLeg[] = [
  {
    id: "rail-a-b", fromNode: "A", toNode: "B", mode: "train",
    fromLabel: "Origin station", toLabel: "Central station",
    departureAt: "2026-12-01T08:00:00+05:30", arrivalAt: "2026-12-01T12:00:00+05:30",
    price: 500, currency: "INR", provider: "Rail timetable",
    evidence: "provider_schedule",
  },
  {
    id: "bus-b-c", fromNode: "B", toNode: "C", mode: "bus",
    fromLabel: "Central station", toLabel: "Destination",
    departureAt: "2026-12-01T12:45:00+05:30", arrivalAt: "2026-12-01T15:00:00+05:30",
    price: 150, currency: "INR", provider: "Public GTFS",
    evidence: "provider_schedule",
  },
  {
    id: "flight-a-c", fromNode: "A", toNode: "C", mode: "flight",
    fromLabel: "Origin airport", toLabel: "Destination airport",
    departureAt: "2026-12-01T09:00:00+05:30", arrivalAt: "2026-12-01T11:00:00+05:30",
    price: 4200, currency: "INR", provider: "Flight supplier",
    evidence: "provider_offer",
  },
];

describe("buildJourneyOptions", () => {
  it("finds direct and connected options with valid transfer time", () => {
    const result = buildJourneyOptions({ legs, originNode: "A", destinationNode: "C" });
    expect(result.options.map(option => option.legs.length)).toEqual([1, 2]);
    expect(result.options.find(option => option.legs.length === 2)?.price).toBe(650);
  });

  it("rejects connections with too little transfer time", () => {
    const result = buildJourneyOptions({
      legs: [legs[0], { ...legs[1], departureAt: "2026-12-01T12:10:00+05:30" }],
      originNode: "A", destinationNode: "C",
    });
    expect(result.options).toHaveLength(0);
    expect(result.discarded.impossibleConnection).toBeGreaterThan(0);
  });

  it("does not connect legs when timestamps are missing", () => {
    const result = buildJourneyOptions({
      legs: [legs[0], { ...legs[1], departureAt: undefined }],
      originNode: "A", destinationNode: "C",
    });
    expect(result.options).toHaveLength(0);
    expect(result.discarded.unsupportedConnection).toBeGreaterThan(0);
  });

  it("does not total mixed currencies", () => {
    const result = buildJourneyOptions({
      legs: [legs[0], { ...legs[1], currency: "USD" }],
      originNode: "A", destinationNode: "C",
    });
    const option = result.options[0];
    expect(option.price).toBeUndefined();
    expect(option.priceComparable).toBe(false);
  });

  it("does not treat unknown fares as zero-cost when ranking", () => {
    const result = buildJourneyOptions({
      legs: [
        { ...legs[2], id: "unknown-price", price: undefined, currency: undefined },
        { ...legs[2], id: "known-price" },
      ],
      originNode: "A", destinationNode: "C", priority: "cheapest",
    });
    expect(result.options).toHaveLength(2);
    expect(result.options.find(option => option.legs[0].id === "unknown-price")?.price).toBeUndefined();
    expect(result.options.find(option => option.legs[0].id === "unknown-price")?.priceComparable).toBe(false);
  });

  it("deduplicates provider leg identifiers", () => {
    const result = buildJourneyOptions({
      legs: [legs[2], { ...legs[2], price: 9000 }],
      originNode: "A", destinationNode: "C",
    });
    expect(result.options).toHaveLength(1);
    expect(result.discarded.invalid).toBe(1);
  });

  it("rejects invalid legs", () => {
    const result = buildJourneyOptions({
      legs: [{ ...legs[0], arrivalAt: "not-a-date" }],
      originNode: "A", destinationNode: "B",
    });
    expect(result.options).toHaveLength(0);
    expect(result.discarded.invalid).toBe(1);
  });
});
