export type TravelMode = "flight" | "train" | "bus" | "car" | "ferry";
export type ProviderVerdict = "available" | "unavailable" | "unknown";

export type ResolvedPlace = {
  label: string;
  lat: number;
  lng: number;
  countryCode?: string;
};

export type ModeEvidence = Partial<Record<TravelMode, {
  verdict: ProviderVerdict;
  provider: string;
  checkedAt?: string;
  detail?: string;
}>>;

export type ModeAssessment = {
  mode: TravelMode;
  status: "verified" | "not_found" | "unverified";
  recommendable: boolean;
  reason: string;
  provider?: string;
  checkedAt?: string;
  detail?: string;
};

export type RouteFeasibilityResult = {
  origin: ResolvedPlace;
  destination: ResolvedPlace;
  distanceKm: number;
  journeyContext: "same_city" | "domestic" | "international";
  assessments: ModeAssessment[];
  recommendation: "choose_verified_mode" | "provider_data_required" | "same_location";
};

const MODES: TravelMode[] = ["flight", "train", "bus", "car", "ferry"];

function validPlace(place: ResolvedPlace): boolean {
  return Number.isFinite(place.lat) && Number.isFinite(place.lng)
    && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180
    && Boolean(place.label.trim());
}

export function haversineDistanceKm(a: ResolvedPlace, b: ResolvedPlace): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

/**
 * Evaluates transport modes using provider evidence only.
 * Geography supplies context, never proof of a road, rail, bus, ferry or flight service.
 * Unknown modes remain unverified instead of being presented as available or impossible.
 */
export function assessRouteFeasibility(
  origin: ResolvedPlace,
  destination: ResolvedPlace,
  evidence: ModeEvidence = {},
): RouteFeasibilityResult {
  if (!validPlace(origin) || !validPlace(destination)) {
    throw new Error("ROUTE_REQUIRES_RESOLVED_COORDINATES");
  }

  const distanceKm = haversineDistanceKm(origin, destination);
  const sameLocation = distanceKm < 1;
  const journeyContext = sameLocation
    ? "same_city"
    : origin.countryCode && destination.countryCode && origin.countryCode !== destination.countryCode
      ? "international"
      : "domestic";

  const assessments = MODES.map((mode): ModeAssessment => {
    if (sameLocation) {
      return { mode, status: "not_found", recommendable: false, reason: "Departure and destination resolve to the same location." };
    }

    const source = evidence[mode];
    if (!source || source.verdict === "unknown") {
      const reason = mode === "flight" && journeyContext === "domestic"
        ? "Flight services have not been checked with an aviation provider."
        : mode === "flight" && journeyContext === "international"
          ? "An international flight may be relevant, but an operating route has not been verified."
          : `${mode[0].toUpperCase() + mode.slice(1)} network and service data have not been checked for this journey.`;
      return { mode, status: "unverified", recommendable: false, reason, provider: source?.provider, checkedAt: source?.checkedAt };
    }

    if (source.verdict === "available") {
      return {
        mode, status: "verified", recommendable: true,
        reason: source.detail ?? `A provider returned a route for ${mode} travel.`,
        provider: source.provider, checkedAt: source.checkedAt, detail: source.detail,
      };
    }

    return {
      mode, status: "not_found", recommendable: false,
      reason: source.detail ?? `The connected provider did not find a ${mode} route.`,
      provider: source.provider, checkedAt: source.checkedAt, detail: source.detail,
    };
  });

  const hasVerifiedMode = assessments.some(item => item.recommendable);
  return {
    origin, destination, distanceKm: Math.round(distanceKm * 10) / 10, journeyContext,
    assessments,
    recommendation: sameLocation ? "same_location" : hasVerifiedMode ? "choose_verified_mode" : "provider_data_required",
  };
}
