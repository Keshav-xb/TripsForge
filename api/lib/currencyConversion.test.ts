import { afterEach, describe, expect, it, vi } from "vitest";
import { convertFlightPrice } from "./currencyConversion";

afterEach(() => vi.unstubAllGlobals());

describe("convertFlightPrice", () => {
  it("preserves the supplier amount when currencies already match", async () => {
    const result = await convertFlightPrice("69.90", "USD", "USD");
    expect(result.conversionStatus).toBe("same_currency");
    expect(result.displayAmount).toBe("69.90");
    expect(result.displayCurrency).toBe("EUR");
  });

  it("converts a supplier quote to the selected platform currency", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: "success",
        base_code: "USD",
        time_last_update_utc: "Fri, 20 Nov 2026 00:00:01 +0000",
        rates: { INR: 90.5 },
      }),
    }));
    const result = await convertFlightPrice("69.90", "USD", "INR");
    expect(result.conversionStatus).toBe("converted");
    expect(result.displayCurrency).toBe("INR");
    expect(result.displayAmount).toBe("6325.95");
    expect(result.originalAmount).toBe("69.90");
    expect(result.originalCurrency).toBe("USD");
  });

  it("falls back to supplier currency when exchange rates are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const result = await convertFlightPrice("69.90", "EUR", "INR");
    expect(result.conversionStatus).toBe("rate_unavailable");
    expect(result.displayCurrency).toBe("USD");
    expect(result.displayAmount).toBeUndefined();
  });
});
