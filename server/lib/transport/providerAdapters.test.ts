import { describe, expect, it } from "vitest";
import { normalizePublicBusResult, normalizeRailSearchResult, normalizeSerpApiFlightResult } from "./providerAdapters";
import { validateNormalizedLeg } from "./providerContract";
import type { SerpApiFlightSearchResult } from "./serpApiFlights";
import type { RailSearchResult } from "./railAvailability";
import type { BusResult } from "../publicBus";

describe("transport provider adapter normalization", () => {
  it("normalizes a flight offer to airport IATA node identities with resolved timezone", async () => {
    const result: SerpApiFlightSearchResult = {
      status: "offers_found",
      provider: "SerpApi",
      environment: "live",
      checkedAt: "2026-11-25T09:00:00+05:30",
      originCode: "IXJ",
      destinationCode: "DEL",
      totalOffersReturned: 1,
      hasMoreOffers: false,
      offers: [{
        id: "offer-1",
        amount: "2450.00",
        currency: "INR",
        owner: "Example Airline",
        totalDurationMinutes: 95,
        segments: [{
          from: "Jammu (IXJ)",
          to: "Delhi (DEL)",
          departure: "2026-12-20 08:00",
          arrival: "2026-12-20 09:35",
          carrier: "Example Airline",
          flightNumber: "EX101",
        }],
      }],
    };
    const normalized = await normalizeSerpApiFlightResult(result, async () => "Asia/Kolkata");
    expect(normalized.status).toBe("results");
    if (normalized.status !== "results") return;
    expect(normalized.items[0].fromNodeId).toBe("airport:iata:IXJ");
    expect(normalized.items[0].toNodeId).toBe("airport:iata:DEL");
    expect(normalized.items[0].price).toBe(2450);
    expect(normalized.items[0].currency).toBe("INR");
    expect(normalized.items[0].departureAt).toBe("2026-12-20T02:30:00.000Z");
    expect(normalized.items[0].arrivalAt).toBe("2026-12-20T04:05:00.000Z");
    expect(validateNormalizedLeg(normalized.items[0])).toEqual({ valid: true });
  });

  it("keeps an unconfigured flight provider distinct from an empty search", async () => {
    const result: SerpApiFlightSearchResult = {
      status: "provider_not_configured",
      provider: "SerpApi",
      environment: "unknown",
      message: "API key missing",
      offers: [],
    };
    expect((await normalizeSerpApiFlightResult(result)).status).toBe("not_configured");
  });

  it("normalizes train journeys using stable RailCore station codes", () => {
    const result: RailSearchResult = {
      status: "offers_found",
      provider: "RailCore",
      retrievedAt: "2026-11-25T09:00:00+05:30",
      travelDate: "2026-12-20",
      originStationCode: "JAT",
      destinationStationCode: "NDLS",
      trains: [{
        trainNumber: "12345",
        trainName: "Test Express",
        departureTime: "08:00",
        arrivalTime: "18:00",
        durationMinutes: 600,
        classes: ["3A"],
        runningDays: ["Daily"],
      }],
      disclaimer: "Timetable only",
    };
    const normalized = normalizeRailSearchResult(result, { origin: "Jammu Tawi", destination: "New Delhi" });
    expect(normalized.status).toBe("results");
    if (normalized.status !== "results") return;
    expect(normalized.items[0].fromNodeId).toBe("rail:railcore:JAT");
    expect(normalized.items[0].toNodeId).toBe("rail:railcore:NDLS");
    expect(normalized.items[0].durationMinutes).toBe(600);
    expect(normalized.items[0].departureAt).toBe("2026-12-20T02:30:00.000Z");
    expect(normalized.items[0].arrivalAt).toBe("2026-12-20T12:30:00.000Z");
    expect(validateNormalizedLeg(normalized.items[0])).toEqual({ valid: true });
  });

  it("normalizes feed-scoped GTFS stop IDs and service-date timestamps", () => {
    const result: BusResult = {
      status: "offers_found",
      provider: "Reclaim India GTFS",
      retrievedAt: "2026-11-25T09:00:00+05:30",
      feed: "Example feed",
      state: "Example",
      offers: [{
        route: "R1",
        headsign: "Central",
        departureTime: "08:00:00",
        arrivalTime: "09:00:00",
        intermediateStops: 3,
        fromStop: "Stop A",
        toStop: "Stop B",
        feedId: "feed-xyz",
        fromStopId: "stop-a",
        toStopId: "stop-b",
        serviceDate: "2026-12-20",
        fromTimezone: "Asia/Kolkata",
        toTimezone: "Asia/Kolkata",
      }],
      disclaimer: "Schedule only",
      sourceLicence: "Open",
    };
    const normalized = normalizePublicBusResult(result);
    expect(normalized.status).toBe("results");
    if (normalized.status !== "results") return;
    expect(normalized.items[0].fromNodeId).toBe("bus:gtfs:feed-xyz:stop-a");
    expect(normalized.items[0].toNodeId).toBe("bus:gtfs:feed-xyz:stop-b");
    expect(normalized.items[0].price).toBeUndefined();
    expect(normalized.items[0].departureAt).toBe("2026-12-20T02:30:00.000Z");
    expect(normalized.items[0].arrivalAt).toBe("2026-12-20T03:30:00.000Z");
    expect(normalized.items[0].durationMinutes).toBe(60);
    expect(validateNormalizedLeg(normalized.items[0])).toEqual({ valid: true });
  });

  it("preserves provider failure instead of representing it as no service", () => {
    const result: BusResult = {
      status: "feed_not_available",
      provider: "Reclaim India GTFS",
      offers: [],
      message: "Feed unavailable",
    };
    expect(normalizePublicBusResult(result).status).toBe("provider_error");
  });
});
