export type TransportMode = "flight" | "train" | "bus" | "car" | "ferry" | "other";

export type TransportLeg = {
  id: string;
  origin: string;
  destination: string;
  mode: TransportMode;
  travelDate: string;
  unitCost: number;
  enabled: boolean;
};

let nextLegId = 1;

export function createEmptyTransportLeg(origin = "", destination = ""): TransportLeg {
  return {
    id: `transport-leg-${nextLegId++}`,
    origin,
    destination,
    mode: "flight",
    travelDate: "",
    unitCost: 0,
    enabled: true,
  };
}

export function getTransportLegTotal(legs: TransportLeg[]): number {
  return Math.round(legs.reduce((total, leg) => {
    if (!leg.enabled || !Number.isFinite(leg.unitCost) || leg.unitCost <= 0) return total;
    return total + leg.unitCost;
  }, 0) * 100) / 100;
}

export function validateTransportLegs(legs: TransportLeg[]): string[] {
  return legs.filter(leg => leg.enabled).flatMap((leg, index) => {
    const errors: string[] = [];
    if (!leg.origin.trim()) errors.push(`Leg ${index + 1}: add an origin.`);
    if (!leg.destination.trim()) errors.push(`Leg ${index + 1}: add a destination.`);
    if (leg.origin.trim().toLocaleLowerCase() === leg.destination.trim().toLocaleLowerCase()) errors.push(`Leg ${index + 1}: origin and destination must differ.`);
    if (!Number.isFinite(leg.unitCost) || leg.unitCost < 0) errors.push(`Leg ${index + 1}: enter a valid non-negative cost.`);
    return errors;
  });
}
