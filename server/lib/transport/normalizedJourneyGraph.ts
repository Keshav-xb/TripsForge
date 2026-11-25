import {
  isLegFresh,
  validateNormalizedLeg,
  type NormalizedServiceLeg,
  type ProviderResult,
} from "./providerContract.js";
import {
  buildJourneyOptions,
  type JourneyCandidateLeg,
  type JourneyGraphResult,
  type JourneyPriority,
} from "./journeyGraph.js";

export type NormalizedJourneyGraphResult = {
  graph: JourneyGraphResult;
  providerOutcomes: Array<Pick<ProviderResult<NormalizedServiceLeg>, "provider" | "status">>;
  excluded: {
    stale: number;
    invalid: number;
    staticNetwork: number;
  };
};

/**
 * Converts normalized adapter output into the existing bounded journey graph.
 * Only fresh, valid provider offers/schedules and explicit road estimates
 * enter the graph. Static network records are infrastructure, not services.
 */
export function buildNormalizedJourneyGraph(input: {
  providerResults: ProviderResult<NormalizedServiceLeg>[];
  originNode: string;
  destinationNode: string;
  priority?: JourneyPriority;
  now?: number;
  maxLegs?: number;
  maxOptions?: number;
}): NormalizedJourneyGraphResult {
  const legs: JourneyCandidateLeg[] = [];
  const excluded = { stale: 0, invalid: 0, staticNetwork: 0 };

  for (const result of input.providerResults) {
    if (result.status !== "results") continue;

    for (const normalized of result.items) {
      if (normalized.evidence === "static_network") {
        excluded.staticNetwork++;
        continue;
      }
      if (!isLegFresh(normalized, input.now)) {
        excluded.stale++;
        continue;
      }
      if (!validateNormalizedLeg(normalized).valid) {
        excluded.invalid++;
        continue;
      }

      const evidence = normalized.evidence === "live_offer"
        ? "provider_offer"
        : normalized.evidence === "published_schedule"
          ? "provider_schedule"
          : "route_estimate";

      legs.push({
        id: normalized.id,
        fromNode: normalized.fromNodeId,
        toNode: normalized.toNodeId,
        mode: normalized.mode,
        fromLabel: normalized.fromLabel,
        toLabel: normalized.toLabel,
        ...(normalized.departureAt ? { departureAt: normalized.departureAt } : {}),
        ...(normalized.arrivalAt ? { arrivalAt: normalized.arrivalAt } : {}),
        ...(normalized.durationMinutes !== undefined ? { durationMinutes: normalized.durationMinutes } : {}),
        ...(normalized.price !== undefined ? { price: normalized.price, currency: normalized.currency } : {}),
        provider: normalized.provider,
        evidence,
        ...(normalized.bookingUrl ? { bookingUrl: normalized.bookingUrl } : {}),
      });
    }
  }

  return {
    graph: buildJourneyOptions({
      legs,
      originNode: input.originNode,
      destinationNode: input.destinationNode,
      priority: input.priority,
      maxLegs: input.maxLegs,
      maxOptions: input.maxOptions,
    }),
    providerOutcomes: input.providerResults.map(({ provider, status }) => ({ provider, status })),
    excluded,
  };
}
