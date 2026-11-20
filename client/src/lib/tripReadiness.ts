export type TripReadinessInput = {
  origin: string;
  destination: string;
  originConfirmed: boolean;
  destinationConfirmed: boolean;
  startDate: string;
  endDate: string;
  travellers: number;
  budgetLimit: number;
  estimatedTotal: number;
  pricedCategoryCoverage: number;
  enabledLegs: Array<{ origin: string; destination: string; mode: string; unitCost: number }>;
  interests: string[];
  routeResearchCompleted: boolean;
};

export type ReadinessCheck = {
  id: string;
  label: string;
  weight: number;
  complete: boolean;
  action: string;
  severity: "blocker" | "warning" | "info";
};

export function assessTripReadiness(input: TripReadinessInput) {
  const validDates = Boolean(input.startDate && input.endDate && input.endDate > input.startDate);
  const legsValid = input.enabledLegs.length > 0 && input.enabledLegs.every(leg =>
    leg.origin.trim() && leg.destination.trim() && leg.mode !== "unverified"
  );
  const budgetWithinLimit = input.budgetLimit > 0 && input.estimatedTotal > 0 && input.estimatedTotal <= input.budgetLimit;
  const checks: ReadinessCheck[] = [
    { id: "destination", label: "Destination selected from map search", weight: 12, complete: input.destinationConfirmed, action: "Confirm the destination using a location suggestion.", severity: "blocker" },
    { id: "origin", label: "Starting point confirmed", weight: 12, complete: input.originConfirmed, action: "Confirm the departure city using a location suggestion.", severity: "blocker" },
    { id: "dates", label: "Travel dates form a valid stay", weight: 10, complete: validDates, action: "Set a return date after departure.", severity: "blocker" },
    { id: "travellers", label: "Traveller count is valid", weight: 6, complete: input.travellers > 0, action: "Add at least one traveller.", severity: "blocker" },
    { id: "transport", label: "Every enabled transport leg has a mode", weight: 18, complete: legsValid, action: "Choose a transport assumption for each enabled leg and verify it with an operator.", severity: "warning" },
    { id: "budget", label: "Budget has priced categories", weight: 14, complete: input.pricedCategoryCoverage >= 50, action: "Add real quotes or clearly marked estimates to at least half of your budget categories.", severity: "warning" },
    { id: "budget-fit", label: "Current estimate is within budget", weight: 12, complete: budgetWithinLimit, action: "Add missing cost estimates or adjust the budget until the estimate fits.", severity: "warning" },
    { id: "interests", label: "Trip interests selected", weight: 6, complete: input.interests.length > 0, action: "Choose interests so the itinerary can reflect what matters to you.", severity: "info" },
    { id: "route-evidence", label: "Route evidence researched", weight: 10, complete: input.routeResearchCompleted, action: "Run route research for the selected endpoints. This checks mapped infrastructure, not scheduled service.", severity: "warning" },
  ];
  const score = Math.round(checks.reduce((total, check) => total + (check.complete ? check.weight : 0), 0));
  const openChecks = checks.filter(check => !check.complete);
  return {
    score,
    checks,
    openChecks,
    blockers: openChecks.filter(check => check.severity === "blocker"),
    nextBestAction: openChecks[0]?.action ?? "Your planning inputs are complete. Verify operator schedules, prices and availability before committing money.",
    status: score >= 85 ? "Plan well specified" : score >= 60 ? "Plan taking shape" : "Early-stage plan",
    disclaimer: "This measures planning completeness, not trip safety, live availability or booking readiness. Unverified data stays unverified.",
  };
}
