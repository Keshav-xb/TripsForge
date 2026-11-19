import { describe, expect, it } from "vitest";
import { createEmptyTransportLeg, getTransportLegTotal, validateTransportLegs } from "./transportLegs";

describe("transport leg helpers", () => {
  it("creates a leg with the supplied endpoints", () => {
    expect(createEmptyTransportLeg("Jammu", "Delhi")).toMatchObject({ origin: "Jammu", destination: "Delhi", mode: "unverified", unitCost: 0, enabled: true });
  });

  it("totals only enabled, positive finite leg costs", () => {
    const legs = [
      { ...createEmptyTransportLeg("Jammu", "Delhi"), unitCost: 4200 },
      { ...createEmptyTransportLeg("Delhi", "Paris"), unitCost: 38000 },
      { ...createEmptyTransportLeg("Paris", "Rome"), unitCost: 0 },
      { ...createEmptyTransportLeg("Rome", "Delhi"), unitCost: 9000, enabled: false },
    ];
    expect(getTransportLegTotal(legs)).toBe(42200);
  });

  it("reports incomplete or identical enabled leg endpoints", () => {
    const legs = [createEmptyTransportLeg("", "Delhi"), createEmptyTransportLeg("Paris", "Paris")];
    expect(validateTransportLegs(legs)).toEqual([
      "Leg 1: add an origin.",
      "Leg 2: origin and destination must differ.",
    ]);
  });
});
