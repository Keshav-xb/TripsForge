/**
 * Converts a provider's local wall-clock service time to an absolute instant.
 *
 * The conversion requires an explicit IANA timezone. GTFS times beyond 24:00
 * are supported. Nonexistent and ambiguous DST wall times are rejected rather
 * than silently choosing an offset.
 */
export function localServiceTimeToIso(
  serviceDate: string,
  time: string,
  timezone: string,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return undefined;
  const date = new Date(serviceDate + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== serviceDate) return undefined;
  const match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(time);
  if (!match) return undefined;
  const hours = Number(match[1]), minutes = Number(match[2]), seconds = Number(match[3] ?? 0);
  if (hours > 47) return undefined;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return undefined;
  }

  const target = new Date(date.getTime() + ((hours * 60 + minutes) * 60 + seconds) * 1000);
  const targetParts = {
    year: target.getUTCFullYear(),
    month: target.getUTCMonth() + 1,
    day: target.getUTCDate(),
    hour: target.getUTCHours(),
    minute: target.getUTCMinutes(),
    second: target.getUTCSeconds(),
  };
  const matchesWallTime = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant))
      .filter(part => part.type !== "literal")
      .map(part => [part.type, Number(part.value)]));
    return parts.year === targetParts.year && parts.month === targetParts.month &&
      parts.day === targetParts.day && parts.hour === targetParts.hour &&
      parts.minute === targetParts.minute && parts.second === targetParts.second;
  };
  const offsets = new Set<number>();
  for (let hoursFromTarget = -36; hoursFromTarget <= 36; hoursFromTarget += 3) {
    const sample = target.getTime() + hoursFromTarget * 60 * 60 * 1000;
    const parts = Object.fromEntries(formatter.formatToParts(new Date(sample))
      .filter(part => part.type !== "literal")
      .map(part => [part.type, Number(part.value)]));
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    offsets.add(representedAsUtc - sample);
  }

  const candidates = new Set<number>();
  for (const offset of offsets) {
    const candidate = target.getTime() - offset;
    if (matchesWallTime(candidate)) candidates.add(candidate);
  }
  if (candidates.size !== 1) return undefined;
  return new Date([...candidates][0]).toISOString();
}
