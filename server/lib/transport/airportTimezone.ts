import { resolveAirportCoordinates } from "./gatewayDiscovery.js";

type TimezoneResponse = { timeZone?: string; timeZoneId?: string; timezone?: string };

const timezoneCache = new Map<string, { expiresAt: number; timezone: string }>();
const pending = new Map<string, Promise<string | undefined>>();

export function resolveAirportTimezone(iataCode: string): Promise<string | undefined> {
  const code = iataCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return Promise.resolve(undefined);
  const cached = timezoneCache.get(code);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.timezone);
  const existing = pending.get(code);
  if (existing) return existing;
  const task = (async () => {
    try {
      const coordinates = await resolveAirportCoordinates(code);
      if (!coordinates) return undefined;
      const url = new URL("https://www.timeapi.io/api/TimeZone/coordinate");
      url.searchParams.set("latitude", String(coordinates.lat));
      url.searchParams.set("longitude", String(coordinates.lng));
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
      if (!response.ok) return undefined;
      const body = await response.json() as TimezoneResponse;
      const timezone = body.timeZone ?? body.timeZoneId ?? body.timezone;
      if (!timezone || !timezone.includes("/")) return undefined;
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
      } catch {
        return undefined;
      }
      timezoneCache.set(code, { timezone, expiresAt: Date.now() + 30 * 24 * 60 * 60_000 });
      return timezone;
    } catch {
      return undefined;
    } finally {
      pending.delete(code);
    }
  })();
  pending.set(code, task);
  return task;
}
