import { describe, expect, it } from "vitest";
import type { NormalizedServiceLeg } from "./providerContract";
import { assessNormalizedTransfer } from "./transferValidation";

function leg(overrides: Partial<NormalizedServiceLeg> = {}): NormalizedServiceLeg {
  return {
    id: "leg-1",
    provider: "TestProvider",
    mode: "flight",
    fromNodeId: "airport:iata:AAA",
    toNodeId: "airport:iata:BBB",
    fromLabel: "Airport A",
    toLabel: "Airport B",
    departureAt: "2026-12-20T06:00:00.000Z",
    arrivalAt: "2026-12-20T08:00:00.000Z",
    evidence: "live_offer",
    retrievedAt: "2025-01-01T05:00:00.000Z",
    ...overrides,
  };
}

describe("normalized transfer validation", () => {
  it("accepts exact-node transfers with enough timezone-aware layover", () => {
    const incoming = leg();
    const outgoing = leg({
      id: "leg-2",
      mode: "train",
      fromNodeId: "airport:iata:BBB",
      toNodeId: "rail:station:CCC",
      departureAt: "2026-12-20T10:00:00.000Z",
      arrivalAt: "2026-12-20T15:00:00.000Z",
    });
    expect(assessNormalizedTransfer(incoming, outgoing)).toMatchObject({
      status: "feasible",
      transferMinutes: 120,
      requiredMinutes: 90,
    });
  });

  it("rejects a transfer below the mode-specific minimum", () => {
    const incoming = leg();
    const outgoing = leg({
      id: "leg-2",
      fromNodeId: "airport:iata:BBB",
      toNodeId: "airport:iata:CCC",
      departureAt: "2026-12-20T08:45:00.000Z",
    });
    expect(assessNormalizedTransfer(incoming, outgoing)).toMatchObject({
      status: "impossible",
      transferMinutes: 45,
      requiredMinutes: 90,
    });
  });

  it("does not join different canonical nodes or missing timestamps", () => {
    const incoming = leg();
    expect(assessNormalizedTransfer(incoming, leg({ id: "leg-2", fromNodeId: "airport:iata:OTHER" })).toMatchObject({ status: "unverified" });
    expect(assessNormalizedTransfer(incoming, leg({ id: "leg-3", departureAt: undefined })).toMatchObject({ status: "unverified" }));
  });

  it("rejects layovers beyond the supported connection window", () => {
    const incoming = leg();
    const outgoing = leg({
      id: "leg-2",
      fromNodeId: "airport:iata:BBB",
      toNodeId: "airport:iata:CCC",
      departureAt: "2026-12-21T00:30:00.000Z",
    });
    expect(assessNormalizedTransfer(incoming, outgoing)).toMatchObject({ status: "impossible", transferMinutes: 990 });
  });
});
