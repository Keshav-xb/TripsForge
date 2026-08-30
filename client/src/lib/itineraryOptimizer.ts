import type { Activity, DayPlan, ForgedTrip, Interest, PlanInputs } from "./tripData";

export type OptimizationOptions = Pick<PlanInputs, "travelStyle" | "budgetLevel" | "interests">;

export type OptimizedDay = {
  day: DayPlan;
  movedActivities: number;
  distanceSavedKm: number;
  reasons: string[];
};

function parseDistance(distance: string) {
  const value = Number.parseFloat(distance.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function coordinateDistance(first: Activity, second: Activity) {
  if (!first.location || !second.location) return null;
  const latScale = 111;
  const lngScale = 111 * Math.cos((first.location.lat * Math.PI) / 180);
  const latitude = (first.location.lat - second.location.lat) * latScale;
  const longitude = (first.location.lng - second.location.lng) * lngScale;
  return Math.sqrt(latitude * latitude + longitude * longitude);
}

function interestScore(activity: Activity, interests: Interest[]) {
  return interests.includes(activity.category as Interest) ? 7 : 0;
}

function costScore(activity: Activity, budgetLevel: OptimizationOptions["budgetLevel"]) {
  if (budgetLevel === "Budget") return Math.max(0, 4 - activity.cost / 450);
  if (budgetLevel === "Premium") return Math.min(3, activity.cost / 500);
  return 1;
}

function routeDistance(activities: Activity[]) {
  return activities.reduce((total, activity, index) => {
    if (!index) return total;
    const previous = activities[index - 1];
    return total + (coordinateDistance(previous, activity) ?? parseDistance(activity.distance));
  }, 0);
}

function countMoved(before: Activity[], after: Activity[]) {
  return after.reduce((total, activity, index) => total + (before[index]?.id === activity.id ? 0 : 1), 0);
}

export function applyOptimizedDay(trip: ForgedTrip, dayIndex: number, optimizedDay: DayPlan) {
  return { ...trip, days: trip.days.map((day, index) => index === dayIndex ? optimizedDay : day) };
}

export function restoreDay(trip: ForgedTrip, dayIndex: number, previousDay: DayPlan) {
  return { ...trip, days: trip.days.map((day, index) => index === dayIndex ? previousDay : day) };
}

export function optimizeDay(day: DayPlan, options: OptimizationOptions): OptimizedDay {
  if (day.activities.length < 2) {
    return { day, movedActivities: 0, distanceSavedKm: 0, reasons: ["This day is already compact, so its current order is the best fit."] };
  }

  const [anchor, ...remaining] = day.activities;
  const ordered: Activity[] = [anchor];
  let current = anchor;

  while (remaining.length) {
    const ranked = remaining.map((activity, index) => {
      const proximity = coordinateDistance(current, activity);
      const routeScore = proximity === null ? 0 : Math.max(0, 12 - proximity);
      const preferenceScore = interestScore(activity, options.interests);
      const budgetScore = costScore(activity, options.budgetLevel);
      const paceScore = options.travelStyle === "Relaxed" && activity.duration.includes("2") ? -1 : options.travelStyle === "Packed" ? 1 : 0;
      return { activity, index, score: routeScore * 2 + preferenceScore + budgetScore + paceScore };
    });
    ranked.sort((first, second) => second.score - first.score || first.index - second.index);
    const next = ranked[0].activity;
    ordered.push(next);
    remaining.splice(ranked[0].index, 1);
    current = next;
  }

  const beforeDistance = routeDistance(day.activities);
  const afterDistance = routeDistance(ordered);
  const distanceSavedKm = Math.max(0, Math.round((beforeDistance - afterDistance) * 10) / 10);
  const movedActivities = countMoved(day.activities, ordered);
  const updatedActivities = ordered.map((activity, index) => ({ ...activity, marker: index + 1 }));
  const updatedDay: DayPlan = {
    ...day,
    activities: updatedActivities,
    subtitle: `${updatedActivities.length} route moments • optimized for shorter movement and a ${options.travelStyle.toLowerCase()} pace`,
  };

  const reasons = [
    distanceSavedKm > 0 ? `Grouped nearby stops to reduce roughly ${distanceSavedKm} km of cross-city movement.` : "Kept the day compact while preserving its key route anchors.",
    options.interests.length ? `Prioritized ${options.interests.slice(0, 2).join(" and ").toLowerCase()} moments earlier in the route.` : "Preserved the route around your preferred pace.",
    options.budgetLevel === "Budget" ? "Protected the lower-spend plan without changing any activity prices." : options.budgetLevel === "Premium" ? "Left room for the day’s higher-value experiences without adding stops." : "Kept the current estimate intact; no prices or stops were added.",
  ];

  return { day: updatedDay, movedActivities, distanceSavedKm, reasons };
}
