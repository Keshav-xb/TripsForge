export type JourneyPriority = "balanced" | "cheapest" | "fastest" | "fewest_transfers";

export type JourneyCandidateLeg = {
  id: string;
  fromNode: string;
  toNode: string;
  mode: "flight" | "train" | "bus" | "car" | "ferry" | "walk" | "other";
  fromLabel: string;
  toLabel: string;
  departureAt?: string;
  arrivalAt?: string;
  durationMinutes?: number;
  price?: number;
  currency?: string;
  provider: string;
  evidence: "provider_schedule" | "provider_offer" | "route_estimate";
  bookingUrl?: string;
};

export type JourneyOption = {
  id: string;
  legs: JourneyCandidateLeg[];
  fromNode: string;
  toNode: string;
  departureAt?: string;
  arrivalAt?: string;
  durationMinutes?: number;
  transferCount: number;
  price?: number;
  currency?: string;
  priceComparable: boolean;
  connectionStatus: "direct" | "connection_time_checked";
  evidence: string[];
  priorityScore: number;
};

export type JourneyGraphResult = {
  options: JourneyOption[];
  discarded: { invalid: number; impossibleConnection: number; unsupportedConnection: number };
  rules: string[];
};

const MIN_TRANSFER_MINUTES: Record<JourneyCandidateLeg["mode"], number> = {
  flight: 90,
  train: 20,
  bus: 20,
  car: 0,
  ferry: 45,
  walk: 0,
  other: 45,
};

function timestamp(value?: string): number | undefined {
  if (!value) return undefined;
  // Reject timezone-less provider timestamps: server-local parsing is unsafe.
  if (!/T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validLeg(leg: JourneyCandidateLeg): boolean {
  if (!leg.id?.trim() || !leg.fromNode?.trim() || !leg.toNode?.trim() || leg.fromNode === leg.toNode || !leg.fromLabel?.trim() || !leg.toLabel?.trim() || !leg.provider?.trim()) return false;
  if (!["provider_schedule", "provider_offer", "route_estimate"].includes(leg.evidence)) return false;
  if (leg.price !== undefined && (!Number.isFinite(leg.price) || leg.price < 0)) return false;
  if (leg.durationMinutes !== undefined && (!Number.isFinite(leg.durationMinutes) || leg.durationMinutes < 0)) return false;
  const departure = timestamp(leg.departureAt);
  const arrival = timestamp(leg.arrivalAt);
  if (leg.departureAt && departure === undefined) return false;
  if (leg.arrivalAt && arrival === undefined) return false;
  if (departure !== undefined && arrival !== undefined && arrival <= departure) return false;
  return true;
}

function makeOption(legs: JourneyCandidateLeg[], priority: JourneyPriority): JourneyOption {
  const first = legs[0];
  const last = legs[legs.length - 1];
  const currencySet = new Set(legs.filter(leg => leg.price !== undefined).map(leg => leg.currency ?? ""));
  const allPriced = legs.every(leg => leg.price !== undefined);
  const priceComparable = allPriced && currencySet.size === 1 && !currencySet.has("");
  const price = priceComparable ? legs.reduce((sum, leg) => sum + (leg.price ?? 0), 0) : undefined;
  const departure = timestamp(first.departureAt);
  const arrival = timestamp(last.arrivalAt);
  const durationMinutes = departure !== undefined && arrival !== undefined
    ? Math.round((arrival - departure) / 60000)
    : legs.every(leg => leg.durationMinutes !== undefined)
      ? legs.reduce((sum, leg) => sum + (leg.durationMinutes ?? 0), 0)
      : undefined;
  const transfers = Math.max(0, legs.length - 1);
  const durationScore = durationMinutes === undefined ? undefined : Math.max(0, 100 - durationMinutes / 60);
  const priceScore = price === undefined ? undefined : Math.max(0, 100 - Math.log10(price + 1) * 20);
  const transferScore = Math.max(0, 100 - transfers * 25);
  // Never treat missing price or duration as a zero score. Balanced ranking
  // averages only dimensions that are actually supported by the provider data.
  const availableScores = [priceScore, durationScore, transferScore].filter((score): score is number => score !== undefined);
  const priorityScore = priority === "cheapest" ? (priceScore ?? -1)
    : priority === "fastest" ? (durationScore ?? -1)
      : priority === "fewest_transfers" ? transferScore
        : availableScores.reduce((sum, score) => sum + score, 0) / Math.max(1, availableScores.length);
  return {
    id: legs.map(leg => leg.id).join("::"),
    legs,
    fromNode: first.fromNode,
    toNode: last.toNode,
    ...(first.departureAt ? { departureAt: first.departureAt } : {}),
    ...(last.arrivalAt ? { arrivalAt: last.arrivalAt } : {}),
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    transferCount: transfers,
    ...(price !== undefined ? { price, currency: first.currency } : {}),
    priceComparable,
    connectionStatus: transfers === 0 ? "direct" : "connection_time_checked",
    evidence: Array.from(new Set(legs.map(leg => leg.provider))),
    priorityScore: Math.round(priorityScore * 100) / 100,
  };
}

/**
 * Builds direct and multi-leg options from provider-backed legs.
 * Multi-leg paths are only admitted when both legs have timestamps and the
 * transfer node matches exactly. Missing timestamps never become assumed connections.
 */
export function buildJourneyOptions(input: {
  legs: JourneyCandidateLeg[];
  originNode: string;
  destinationNode: string;
  priority?: JourneyPriority;
  maxLegs?: number;
  maxOptions?: number;
}): JourneyGraphResult {
  const priority = input.priority ?? "balanced";
  const maxLegs = Math.min(4, Math.max(1, input.maxLegs ?? 3));
  const maxOptions = Math.min(100, Math.max(1, input.maxOptions ?? 20));
  const valid = input.legs.filter(validLeg);
  const discarded = { invalid: input.legs.length - valid.length, impossibleConnection: 0, unsupportedConnection: 0 };
  const options: JourneyOption[] = [];
  // Bound graph exploration so a large provider response cannot exhaust a
  // serverless invocation. A capped search is explicitly reported below.
  const maxSearchStates = 5000;
  let searchStates = 0;
  let searchTruncated = false;
  const seenLegIds = new Set<string>();
  const deduplicated = valid.filter(leg => {
    if (seenLegIds.has(leg.id)) return false;
    seenLegIds.add(leg.id);
    return true;
  });
  discarded.invalid += valid.length - deduplicated.length;
  const visit = (path: JourneyCandidateLeg[], used: Set<string>) => {
    if (searchStates >= maxSearchStates) {
      searchTruncated = true;
      return;
    }
    searchStates++;

    const last = path[path.length - 1];
    if (last.toNode === input.destinationNode) {
      options.push(makeOption(path, priority));
      return;
    }
    if (path.length >= maxLegs) return;
    const arrival = timestamp(last.arrivalAt);
    const nextLegs = deduplicated.filter(next => next.fromNode === last.toNode && !used.has(next.id));
    for (const next of nextLegs) {
      if (arrival === undefined || !next.departureAt) {
        discarded.unsupportedConnection++;
        continue;
      }
      const departure = timestamp(next.departureAt);
      if (departure === undefined) {
        discarded.invalid++;
        continue;
      }
      const transferMinutes = (departure - arrival) / 60000;
      const minimum = Math.max(MIN_TRANSFER_MINUTES[last.mode], MIN_TRANSFER_MINUTES[next.mode]);
      if (transferMinutes < minimum || transferMinutes > 12 * 60) {
        discarded.impossibleConnection++;
        continue;
      }
      used.add(next.id);
      visit([...path, next], used);
      used.delete(next.id);
    }
  };

  for (const leg of deduplicated.filter(item => item.fromNode === input.originNode)) {
    visit([leg], new Set([leg.id]));
  }

  const unique = Array.from(new Map(options.map(option => [option.id, option])).values());
  unique.sort((a, b) => {
    if (priority === "cheapest" && a.priceComparable !== b.priceComparable) return a.priceComparable ? -1 : 1;
    if (priority === "fastest" && (a.durationMinutes !== undefined) !== (b.durationMinutes !== undefined)) return a.durationMinutes !== undefined ? -1 : 1;
    return b.priorityScore - a.priorityScore
      || a.transferCount - b.transferCount
      || (a.durationMinutes ?? Number.MAX_SAFE_INTEGER) - (b.durationMinutes ?? Number.MAX_SAFE_INTEGER);
  });
  return {
    options: unique.slice(0, maxOptions),
    discarded,
    rules: [
      "Only supplied provider-backed legs are considered; the graph does not invent services or prices.",
      "Multi-leg connections require an exact shared transfer-node identifier and real departure/arrival timestamps.",
      "Minimum transfer buffers are conservative defaults, not operator guarantees; verify terminal changes and accessibility.",
      "Prices are totalled only when every leg has a price in the same currency.",
      "Missing timestamps, locations or fares remain unknown rather than being estimated.",
      ...(searchTruncated ? ["Search reached its safety limit; returned options may not include every possible combination."] : []),
    ],
  };
}
