/**
 * Shared provider contract for transport research.
 *
 * This module is intentionally provider-agnostic. Adapters should map source
 * payloads into this contract before data can enter journey graph construction.
 */

export type TransportMode = "flight" | "train" | "bus" | "ferry" | "car" | "walk";
export type TransportNodeKind = "airport" | "rail_station" | "bus_stop" | "bus_terminal" | "ferry_terminal" | "road_access" | "other";
export type TransportEvidence = "live_offer" | "published_schedule" | "route_estimate" | "static_network";

export type CanonicalTransportNode = {
  /** Stable ID from the source system, namespaced by source. */
  id: string;
  source: string;
  sourceId: string;
  kind: TransportNodeKind;
  name: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  /** IANA timezone, e.g. Europe/Paris. Never infer from the server timezone. */
  timezone?: string;
};

export type NormalizedServiceLeg = {
  id: string;
  provider: string;
  mode: TransportMode;
  fromNodeId: string;
  toNodeId: string;
  fromLabel: string;
  toLabel: string;
  departureAt?: string;
  arrivalAt?: string;
  durationMinutes?: number;
  price?: number;
  currency?: string;
  evidence: TransportEvidence;
  retrievedAt: string;
  validUntil?: string;
  bookingUrl?: string;
  sourceReference?: string;
};

export type ProviderResult<T> = {
  provider: string;
  requestId?: string;
  retrievedAt: string;
  evidence: TransportEvidence;
} & (
  | { status: "results"; items: T[] }
  | { status: "empty"; message?: string }
  | { status: "unsupported"; reason: string }
  | { status: "not_configured"; reason?: string }
  | { status: "rate_limited"; retryAfterSeconds?: number }
  | { status: "timeout"; retryable: true }
  | { status: "provider_error"; errorCode?: string; retryable: boolean }
  | { status: "malformed_response"; reason: string }
);

export type LegValidationIssue =
  | "missing_identity"
  | "invalid_node_identity"
  | "same_origin_destination"
  | "missing_labels"
  | "invalid_timestamp"
  | "arrival_not_after_departure"
  | "invalid_duration"
  | "invalid_price"
  | "invalid_currency"
  | "currency_without_price"
  | "invalid_freshness"
  | "invalid_booking_url"
  | "invalid_evidence";

export type LegValidation = { valid: true } | { valid: false; issues: LegValidationIssue[] };

const OFFSET_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/i;

export function parseOffsetTimestamp(value?: string): number | undefined {
  if (!value || !OFFSET_TIMESTAMP.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validBookingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateNormalizedLeg(leg: NormalizedServiceLeg): LegValidation {
  const issues: LegValidationIssue[] = [];
  if (!leg.id?.trim() || !leg.provider?.trim()) issues.push("missing_identity");
  if (!leg.fromNodeId?.trim() || !leg.toNodeId?.trim()) issues.push("invalid_node_identity");
  if (leg.fromNodeId && leg.fromNodeId === leg.toNodeId) issues.push("same_origin_destination");
  if (!leg.fromLabel?.trim() || !leg.toLabel?.trim()) issues.push("missing_labels");

  const departure = leg.departureAt ? parseOffsetTimestamp(leg.departureAt) : undefined;
  const arrival = leg.arrivalAt ? parseOffsetTimestamp(leg.arrivalAt) : undefined;
  if ((leg.departureAt && departure === undefined) || (leg.arrivalAt && arrival === undefined)) {
    issues.push("invalid_timestamp");
  }
  if (departure !== undefined && arrival !== undefined && arrival <= departure) {
    issues.push("arrival_not_after_departure");
  }

  if (leg.durationMinutes !== undefined && (!Number.isFinite(leg.durationMinutes) || leg.durationMinutes < 0)) {
    issues.push("invalid_duration");
  }
  if (leg.price !== undefined && (!Number.isFinite(leg.price) || leg.price < 0)) {
    issues.push("invalid_price");
  }
  if (leg.price !== undefined && (!leg.currency || !/^[A-Z]{3}$/.test(leg.currency))) {
    issues.push("invalid_currency");
  }
  if (leg.price === undefined && leg.currency !== undefined) {
    issues.push("currency_without_price");
  }

  if (!parseOffsetTimestamp(leg.retrievedAt)
    || (leg.validUntil !== undefined && !parseOffsetTimestamp(leg.validUntil))) {
    issues.push("invalid_freshness");
  } else if (leg.validUntil !== undefined
    && parseOffsetTimestamp(leg.validUntil)! <= parseOffsetTimestamp(leg.retrievedAt)!) {
    issues.push("invalid_freshness");
  }

  if (leg.bookingUrl !== undefined && !validBookingUrl(leg.bookingUrl)) {
    issues.push("invalid_booking_url");
  }
  if (!["live_offer", "published_schedule", "route_estimate", "static_network"].includes(leg.evidence)) {
    issues.push("invalid_evidence");
  }

  return issues.length ? { valid: false, issues } : { valid: true };
}

/** A stale leg can be retained for explanation, but must not be treated as a current offer. */
export function isLegFresh(leg: Pick<NormalizedServiceLeg, "retrievedAt" | "validUntil">, now = Date.now()): boolean {
  const retrieved = parseOffsetTimestamp(leg.retrievedAt);
  if (retrieved === undefined || retrieved > now) return false;
  if (leg.validUntil === undefined) return true;
  const validUntil = parseOffsetTimestamp(leg.validUntil);
  return validUntil !== undefined && validUntil > now;
}
