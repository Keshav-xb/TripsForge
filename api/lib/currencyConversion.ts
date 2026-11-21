type ExchangeRateResponse = {
  result?: string;
  base_code?: string;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
};

type RateCacheEntry = { expiresAt: number; rates: Record<string, number>; updatedAt: string };
const rateCache = new Map<string, RateCacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export type ConvertedFlightPrice = {
  originalAmount: string;
  originalCurrency: string;
  displayAmount?: string;
  displayCurrency: string;
  exchangeRate?: number;
  rateSource?: string;
  rateUpdatedAt?: string;
  conversionStatus: "same_currency" | "converted" | "rate_unavailable";
};

async function getRates(base: string): Promise<RateCacheEntry | null> {
  const cached = rateCache.get(base);
  if (cached && cached.expiresAt > Date.now()) return cached;
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json() as ExchangeRateResponse;
    if (data.result !== "success" || !data.rates || !data.time_last_update_utc) return null;
    const entry = { rates: data.rates, updatedAt: data.time_last_update_utc, expiresAt: Date.now() + CACHE_TTL_MS };
    rateCache.set(base, entry);
    return entry;
  } catch {
    return null;
  }
}

/** Converts only the displayed quote. The supplier amount/currency remain unchanged. */
export async function convertFlightPrice(amount: string, fromCurrency: string, toCurrency: string): Promise<ConvertedFlightPrice> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0 || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return { originalAmount: amount, originalCurrency: fromCurrency, displayCurrency: fromCurrency, conversionStatus: "rate_unavailable" };
  }
  if (from === to) {
    return { originalAmount: amount, originalCurrency: from, displayAmount: amount, displayCurrency: to, exchangeRate: 1, conversionStatus: "same_currency" };
  }
  const data = await getRates(from);
  const rate = data?.rates[to];
  if (!data || !Number.isFinite(rate) || rate <= 0) {
    return { originalAmount: amount, originalCurrency: from, displayCurrency: from, conversionStatus: "rate_unavailable" };
  }
  return {
    originalAmount: amount,
    originalCurrency: from,
    displayAmount: (numericAmount * rate).toFixed(2),
    displayCurrency: to,
    exchangeRate: rate,
    rateSource: "ExchangeRate-API",
    rateUpdatedAt: data.updatedAt,
    conversionStatus: "converted",
  };
}
