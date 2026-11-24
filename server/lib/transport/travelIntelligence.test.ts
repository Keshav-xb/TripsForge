import { describe, expect, it } from "vitest";
import { buildTravelIntelligence } from "./travelIntelligence";
import type { RouteResearchResult } from "./routeResearch";

const base: RouteResearchResult = {
  provider: "OpenStreetMap / Overpass + OSRM",
  retrievedAt: "2026-11-20T04:00:00.000Z",
  origin: "Jammu, India",
  destination: "Srinagar, India",
  travelDate: "2026-11-25",
  road: { status: "route_found", distanceKm: 235.2, durationMinutes: 224, provider: "OSRM" },
  infrastructure: [
    { kind: "flight", originCount: 1, destinationCount: 1, originExamples: ["Jammu Airport"], destinationExamples: ["Srinagar Airport"], checked: true },
    { kind: "train", originCount: 1, destinationCount: 0, originExamples: ["Jammu Tawi"], destinationExamples: [], checked: true },
  ],
  modes: [
    { mode: "flight", status: "infrastructure_at_both_ends", evidence: "Mapped airports at both endpoints.", serviceStatus: "unverified", bookingStatus: "not_connected" },
    { mode: "train", status: "infrastructure_partial", evidence: "Mapped railway infrastructure at origin only.", serviceStatus: "unverified", bookingStatus: "not_connected" },
    { mode: "bus", status: "not_checked", evidence: "Infrastructure lookup timed out.", serviceStatus: "unverified", bookingStatus: "not_connected" },
    { mode: "car", status: "road_route_found", evidence: "235.2 km road estimate.", serviceStatus: "unverified", bookingStatus: "not_connected" },
    { mode: "ferry", status: "not_checked", evidence: "Infrastructure lookup timed out.", serviceStatus: "unverified", bookingStatus: "not_connected" },
  ],
  limitations: ["No live timetables or fares are connected."],
};

describe("buildTravelIntelligence", () => {
  it("summarizes positive and partial evidence without claiming a scheduled service", () => {
    const report = buildTravelIntelligence(base, "2026-11-20T04:01:00.000Z");
    expect(report.findings.find(item => item.mode === "flight")?.level).toBe("positive");
    expect(report.findings.find(item => item.mode === "train")?.level).toBe("unknown");
    expect(report.findings.find(item => item.mode === "train")?.headline).toContain("Train timetable lookup unavailable");
    expect(report.findings.every(item => item.verifiedService === false)).toBe(true);
    expect(report.summary).toContain("No train timetable options were confirmed");
  });

  it("keeps provider timeouts unknown, not unavailable", () => {
    const report = buildTravelIntelligence(base);
    const bus = report.findings.find(item => item.mode === "bus")!;
    expect(bus.level).toBe("unknown");
    expect(bus.headline).toContain("research could not be completed");
  });

  it("always states the evidence gaps and anti-hallucination rules", () => {
    const report = buildTravelIntelligence(base);
    expect(report.missingEvidence).toContain("Live departure confirmation, fares and seat availability from the railway operator.");
    expect(report.safetyRules.join(" ")).toContain("Never generate a fare");
  });
});
