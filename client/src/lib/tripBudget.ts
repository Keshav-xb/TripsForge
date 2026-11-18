/**
 * Dynamic trip budget calculation primitives.
 *
 * This module performs arithmetic only. It does not invent market prices.
 * Provider adapters or traveller-entered assumptions supply each unit cost,
 * currency, source classification and freshness metadata.
 */
export type BudgetCategory =
  | "transport"
  | "accommodation"
  | "food"
  | "activities"
  | "visa"
  | "insurance"
  | "connectivity"
  | "shopping"
  | "tips"
  | "miscellaneous"
  | "contingency";

export type BudgetSourceType =
  | "live_quote"
  | "provider_estimate"
  | "modeled_estimate"
  | "traveller_input";

export type BudgetQuantityRule =
  | "per_trip"
  | "per_person"
  | "per_adult"
  | "per_child"
  | "per_infant"
  | "per_person_per_night"
  | "per_room_per_night"
  | "per_group_per_day"
  | "per_vehicle";

export type BudgetScenario = "economy" | "expected" | "comfort";

export type BudgetCostItem = {
  id: string;
  label: string;
  category: BudgetCategory;
  enabled: boolean;
  unitCost: number;
  quantityRule: BudgetQuantityRule;
  /** Required for per_vehicle items. */
  vehicleCount?: number;
  /** Optional scenario-specific unit cost overrides. */
  scenarioUnitCosts?: Partial<Record<BudgetScenario, number>>;
  sourceType: BudgetSourceType;
  sourceLabel: string;
  currency: string;
  observedAt?: string;
  /** Provider quote expiry, if supplied. */
  validUntil?: string;
  /** True only when a supplier has returned an actual bookable quote. */
  bookable?: boolean;
};

export type BudgetTripInputs = {
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  currency: string;
  items: BudgetCostItem[];
};

export type BudgetLineResult = {
  id: string;
  label: string;
  category: BudgetCategory;
  enabled: boolean;
  unitCost: number;
  quantity: number;
  total: number;
  sourceType: BudgetSourceType;
  sourceLabel: string;
  observedAt?: string;
  validUntil?: string;
  bookable: boolean;
};

export type BudgetScenarioResult = {
  scenario: BudgetScenario;
  total: number;
  perPerson: number;
  categoryTotals: Record<BudgetCategory, number>;
  lines: BudgetLineResult[];
  /** Categories with no enabled, priced item. */
  unpricedCategories: BudgetCategory[];
  /** Sum of priced enabled categories divided by all categories. */
  pricedCategoryCoverage: number;
  liveQuoteTotal: number;
  modeledEstimateTotal: number;
  travellerInputTotal: number;
};

const categories: BudgetCategory[] = [
  "transport", "accommodation", "food", "activities", "visa",
  "insurance", "connectivity", "shopping", "tips", "miscellaneous",
  "contingency",
];

export function getTripNights(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T12:00:00Z`);
  const end = Date.parse(`${endDate}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 86_400_000);
}

function getQuantity(item: BudgetCostItem, trip: BudgetTripInputs, nights: number): number {
  const people = Math.max(0, trip.adults) + Math.max(0, trip.children) + Math.max(0, trip.infants);
  switch (item.quantityRule) {
    case "per_trip": return 1;
    case "per_person": return people;
    case "per_adult": return Math.max(0, trip.adults);
    case "per_child": return Math.max(0, trip.children);
    case "per_infant": return Math.max(0, trip.infants);
    case "per_person_per_night": return people * nights;
    case "per_room_per_night": return Math.max(0, trip.rooms) * nights;
    case "per_group_per_day": return nights + 1;
    case "per_vehicle": return Math.max(0, item.vehicleCount ?? 0);
  }
}

export function calculateBudgetScenario(
  trip: BudgetTripInputs,
  scenario: BudgetScenario,
): BudgetScenarioResult {
  const nights = getTripNights(trip.startDate, trip.endDate);
  const people = Math.max(0, trip.adults) + Math.max(0, trip.children) + Math.max(0, trip.infants);
  const categoryTotals = Object.fromEntries(categories.map(category => [category, 0])) as Record<BudgetCategory, number>;
  const lines = trip.items.map(item => {
    const quantity = getQuantity(item, trip, nights);
    const scenarioCost = item.scenarioUnitCosts?.[scenario] ?? item.unitCost;
    const unitCost = Number.isFinite(scenarioCost) && scenarioCost > 0 ? scenarioCost : 0;
    const enabled = item.enabled && quantity > 0 && unitCost > 0;
    const total = enabled ? Math.round(unitCost * quantity * 100) / 100 : 0;
    if (enabled) categoryTotals[item.category] += total;
    return {
      id: item.id,
      label: item.label,
      category: item.category,
      enabled: item.enabled,
      unitCost,
      quantity,
      total,
      sourceType: item.sourceType,
      sourceLabel: item.sourceLabel,
      observedAt: item.observedAt,
      validUntil: item.validUntil,
      bookable: item.sourceType === "live_quote" && item.bookable === true,
    };
  });
  const total = Math.round(lines.reduce((sum, line) => sum + line.total, 0) * 100) / 100;
  const pricedCategories = categories.filter(category => categoryTotals[category] > 0);
  const unpricedCategories = categories.filter(category => !pricedCategories.includes(category));
  const sourceTotal = (source: BudgetSourceType) =>
    lines.filter(line => line.sourceType === source).reduce((sum, line) => sum + line.total, 0);
  return {
    scenario,
    total,
    perPerson: people > 0 ? Math.round((total / people) * 100) / 100 : 0,
    categoryTotals,
    lines,
    unpricedCategories,
    pricedCategoryCoverage: Math.round((pricedCategories.length / categories.length) * 100),
    liveQuoteTotal: sourceTotal("live_quote"),
    modeledEstimateTotal: sourceTotal("modeled_estimate") + sourceTotal("provider_estimate"),
    travellerInputTotal: sourceTotal("traveller_input"),
  };
}

export function calculateAllBudgetScenarios(trip: BudgetTripInputs) {
  return {
    economy: calculateBudgetScenario(trip, "economy"),
    expected: calculateBudgetScenario(trip, "expected"),
    comfort: calculateBudgetScenario(trip, "comfort"),
  };
}
