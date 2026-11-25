import { describe, expect, it } from "vitest";
import { localServiceTimeToIso } from "./localServiceTime";

describe("local service-time conversion", () => {
  it("converts an explicit timezone without using the server timezone", () => {
    expect(localServiceTimeToIso("2026-12-20", "08:00", "Asia/Kolkata"))
      .toBe("2026-12-20T02:30:00.000Z");
  });

  it("supports GTFS service times beyond midnight", () => {
    expect(localServiceTimeToIso("2026-12-20", "25:10:00", "Asia/Kolkata"))
      .toBe("2026-12-20T19:40:00.000Z");
  });

  it("rejects nonexistent and ambiguous daylight-saving wall times", () => {
    expect(localServiceTimeToIso("2026-03-08", "02:30", "America/New_York")).toBeUndefined();
    expect(localServiceTimeToIso("2026-11-01", "01:30", "America/New_York")).toBeUndefined();
  });

  it("rejects invalid timezone identifiers and malformed GTFS time values", () => {
    expect(localServiceTimeToIso("2026-12-20", "08:00", "Not/A_Timezone")).toBeUndefined();
    expect(localServiceTimeToIso("2026-12-20", "48:00", "Asia/Kolkata")).toBeUndefined();
    expect(localServiceTimeToIso("2026-12-20", "8:70", "Asia/Kolkata")).toBeUndefined();
  });
});
