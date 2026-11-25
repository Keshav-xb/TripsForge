import { describe, expect, it } from "vitest";
import { buildNormalizedJourneyGraph } from "./normalizedJourneyGraph.js";
import type { NormalizedServiceLeg, ProviderResult } from "./providerContract.js";

const now = Date.parse("2026-11-25T12:00:00.000Z");
const fresh = new Date(now - 60_000).toISOString();

function leg(overrides: Partial<NormalizedServiceLeg> = {}): NormalizedServiceLeg {
  return {
    id: "leg-1",
    provider: "Test schedule",
    mode: "train",
    fromNodeId: "rail:station:A",
    toNodeId: "rail:station:B",
    fromLabel: "Station A",
    toLabel: "Station B",
    departureAt: "2026-12-01T08:00:00+05:30",
    arrivalAt: "2026-12-01T10:00:00+05:30",
    durationMinutes: 120,
    evidence: "published_schedule",
    retrievedAt: fresh,
    ...overrides,
  };
}

function results(items: NormalizedServiceLeg[]): ProviderResult<NormalizedServiceLeg> {
  return {
    provider: "Test schedule",
    retrievedAt: fresh,
    evidence: "published_schedule",
    status: "results",
    items,
  };
}

describe("buildNormalizedJourneyGraph", () => {
  it("connects fresh normalized legs through their exact canonical node", () => {
    const first = leg();
    const second = leg({
      id: "leg-2",
      fromNodeId: "rail:station:B",
      toNodeId: "rail:station:C",
      fromLabel: "Station B",
      toLabel: "Station C",
      departureAt: "2026-12-01T10:30:00+05:30",
      arrivalAt: "2026-12-01T12:00:00+05:30",
      durationMinutes: 90,
    });

    const result = buildNormalizedJourneyGraph({
      providerResults: [results([first, second])],
      originNode: "rail:station:A",
      destinationNode: "rail:station:C",
      now,
    });

    expect(result.graph.options).toHaveLength(1);
    expect(result.graph.options[0].legs.map(item => item.id)).toEqual(["leg-1", "leg-2"]);
    expect(result.graph.options[0].transferCount).toBe(1);
    expect(result.graph.options[0].connectionStatus).toBe("connection_time_checked");
  });

  it("excludes stale legs and static network nodes from service routing", () => {
    const stale = leg({ id: "stale", validUntil: "2026-11-20T12:00:00.000Z" });
    const infrastructure = leg({ id: "infra", evidence: "static_network" });

    const result = buildNormalizedJourneyGraph({
      providerResults: [results([stale, infrastructure])],
      originNode: "rail:station:A",
      destinationNode: "rail:station:B",
      now,
    });

    expect(result.graph.options).toHaveLength(0);
    expect(result.excluded).toEqual({ stale: 1, invalid: 0, staticNetwork: 1 });
  });

  it("retains provider failure and empty outcomes instead of converting them to no services", () => {
    const outcomes: ProviderResult<NormalizedServiceLeg>[] = [
      { provider: "Rail", retrievedAt: fresh, evidence: "published_schedule", status: "empty", message: "No matching service" },
      { provider: "Flights", retrievedAt: fresh, evidence: "live_offer", status: "provider_error", retryable: true, errorCode: "UPSTREAM" },
    ];

    const result = buildNormalizedJourneyGraph({
      providerResults: outcomes,
      originNode: "A",
      destinationNode: "B",
      now,
    });

    expect(result.providerOutcomes).toEqual([
      { provider: "Rail", status: "empty" },
      { provider: "Flights", status: "provider_error" },
    ]);
    expect(result.graph.options).toHaveLength(0);
  });

  it("rejects malformed normalized legs before they enter the graph", () => {
    const malformed = leg({ price: 100, currency: "not-a-currency" });

    const result = buildNormalizedJourneyGraph({
      providerResults: [results([malformed])],
      originNode: "rail:station:A",
      destinationNode: "rail:station:B",
      now,
    });

    expect(result.graph.options).toHaveLength(0);
    expect(result.excluded.invalid).toBe(1);
  });
});
