import { describe, expect, it } from "vitest";
import {
  isLegFresh,
  parseOffsetTimestamp,
  validateNormalizedLeg,
  type NormalizedServiceLeg,
} from "./providerContract";

const validLeg: NormalizedServiceLeg = {
  id: "provider-trip-1",
  provider: "ExampleProvider",
  mode: "train",
  fromNodeId: "rail:source:station-a",
  toNodeId: "rail:source:station-b",
  fromLabel: "Station A",
  toLabel: "Station B",
  departureAt: "2026-12-01T08:00:00+05:30",
  arrivalAt: "2026-12-01T11:00:00+05:30",
  durationMinutes: 180,
  price: 450,
  currency: "INR",
  evidence: "published_schedule",
  retrievedAt: "2026-11-25T09:00:00+05:30",
  validUntil: "2026-12-01T23:59:00+05:30",
};

describe("normalized transport provider contract", () => {
  it("accepts a valid provider leg with explicit timezone offsets", () => {
    expect(validateNormalizedLeg(validLeg)).toEqual({ valid: true });
  });

  it("rejects timezone-less schedule timestamps", () => {
    const result = validateNormalizedLeg({
      ...validLeg,
      departureAt: "2026-12-01T08:00:00",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues).toContain("invalid_timestamp");
  });

  it("rejects identical canonical endpoint IDs", () => {
    const result = validateNormalizedLeg({
      ...validLeg,
      toNodeId: validLeg.fromNodeId,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues).toContain("same_origin_destination");
  });

  it("does not allow a fare without a valid ISO currency", () => {
    const result = validateNormalizedLeg({ ...validLeg, currency: "rupees" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues).toContain("invalid_currency");
  });

  it("does not allow currency metadata without a fare", () => {
    const { price: _price, ...withoutPrice } = validLeg;
    const result = validateNormalizedLeg(withoutPrice);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues).toContain("currency_without_price");
  });

  it("rejects non-HTTPS or credential-bearing booking URLs", () => {
    expect(validateNormalizedLeg({ ...validLeg, bookingUrl: "http://provider.example/book" }).valid).toBe(false);
    expect(validateNormalizedLeg({ ...validLeg, bookingUrl: "https://user:pass@provider.example/book" }).valid).toBe(false);
  });

  it("rejects freshness windows that end before they begin", () => {
    const result = validateNormalizedLeg({
      ...validLeg,
      validUntil: "2026-11-25T08:59:00+05:30",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues).toContain("invalid_freshness");
  });

  it("parses explicit offsets but rejects local timestamps", () => {
    expect(parseOffsetTimestamp("2026-12-01T08:00:00Z")).toBeTypeOf("number");
    expect(parseOffsetTimestamp("2026-12-01T08:00:00+05:30")).toBeTypeOf("number");
    expect(parseOffsetTimestamp("2026-12-01T08:00:00")).toBeUndefined();
  });

  it("treats expired evidence as stale and future retrieval as invalid", () => {
    expect(isLegFresh({ retrievedAt: "2026-01-01T00:00:00Z", validUntil: "2026-01-02T00:00:00Z" }, Date.parse("2026-01-03T00:00:00Z"))).toBe(false);
    expect(isLegFresh({ retrievedAt: "2026-01-02T00:00:00Z" }, Date.parse("2026-01-01T00:00:00Z"))).toBe(false);
    expect(isLegFresh({ retrievedAt: "2026-01-01T00:00:00Z" }, Date.parse("2026-01-01T12:00:00Z"))).toBe(true);
  });
});
