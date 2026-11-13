import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { buildTrip, getDestination, type ForgedTrip, type PlanInputs } from "@/lib/tripData";

export type SimulatorTransport = "flight" | "train" | "bus" | "car";
export type SimulatorStyle = PlanInputs["travelStyle"] | "Luxury" | "Backpacking" | "Budget" | "Comfortable";

export type SimulatorControls = {
  budgetDelta: number;
  dayDelta: number;
  destination: string;
  transportation: SimulatorTransport;
  travelStyle: SimulatorStyle;
};

export type SimulatorResult = {
  original: ForgedTrip;
  simulated: ForgedTrip;
  controls: SimulatorControls;
  changes: string[];
  assumptions: string[];
};

const transportAdjustments: Record<SimulatorTransport, { label: string; multiplier: number; time: number }> = {
  flight: { label: "Flight", multiplier: 1.35, time: 0.8 },
  train: { label: "Train", multiplier: 0.8, time: 1.2 },
  bus: { label: "Bus", multiplier: 0.62, time: 1.45 },
  car: { label: "Car", multiplier: 1.05, time: 1.1 },
};

const styleMultipliers: Record<SimulatorStyle, number> = {
  Backpacking: 0.72,
  Budget: 0.78,
  Relaxed: 1,
  Balanced: 1,
  Packed: 1.08,
  Comfortable: 1.18,
  Luxury: 1.55,
};

function shiftedEndDate(startDate: string, endDate: string, dayDelta: number) {
  const currentDays = Math.max(1, differenceInCalendarDays(parseISO(endDate), parseISO(startDate)));
  return format(addDays(parseISO(startDate), Math.max(1, currentDays + dayDelta)), "yyyy-MM-dd");
}

function normalizeStyle(style: SimulatorStyle): PlanInputs["travelStyle"] {
  if (style === "Backpacking" || style === "Budget") return "Relaxed";
  if (style === "Luxury" || style === "Comfortable") return "Packed";
  return style;
}

export function defaultSimulatorControls(trip: ForgedTrip): SimulatorControls {
  return { budgetDelta: 0, dayDelta: 0, destination: trip.destination.name, transportation: "train", travelStyle: trip.plan.travelStyle };
}

export function simulateTrip(trip: ForgedTrip, controls: SimulatorControls): SimulatorResult {
  const destination = getDestination(controls.destination);
  const budgetBase = Math.max(5000, trip.budget.total + controls.budgetDelta);
  const styleMultiplier = styleMultipliers[controls.travelStyle];
  const transport = transportAdjustments[controls.transportation];
  const simulatedPlan: PlanInputs = {
    ...trip.plan,
    destination: destination.name,
    endDate: shiftedEndDate(trip.plan.startDate, trip.plan.endDate, controls.dayDelta),
    budget: Math.round(budgetBase * styleMultiplier),
    budgetLevel: controls.travelStyle === "Luxury" ? "Premium" : controls.travelStyle === "Backpacking" || controls.travelStyle === "Budget" ? "Budget" : trip.plan.budgetLevel,
    travelStyle: normalizeStyle(controls.travelStyle),
  };
  const generated = buildTrip(simulatedPlan);
  const total = Math.round(generated.budget.total * styleMultiplier);
  const transportation = Math.round(total * 0.18 * transport.multiplier);
  const hotels = Math.round(total * (controls.travelStyle === "Luxury" ? 0.42 : controls.travelStyle === "Backpacking" ? 0.2 : 0.32));
  const food = Math.round(total * (controls.travelStyle === "Backpacking" ? 0.14 : 0.2));
  const activities = Math.round(total * (controls.travelStyle === "Luxury" ? 0.2 : 0.18));
  const miscellaneous = Math.max(0, total - transportation - hotels - food - activities);
  const simulated: ForgedTrip = {
    ...generated,
    budget: { transportation, hotels, food, activities, miscellaneous, total: transportation + hotels + food + activities + miscellaneous },
    totalDistance: Math.round(generated.totalDistance * transport.time),
    travelTime: `${Math.max(1, Math.round((Number.parseFloat(generated.travelTime) || 1) * transport.time * 10) / 10)}h`,
    score: Math.max(78, Math.min(99, generated.score + (controls.dayDelta > 0 ? 2 : controls.dayDelta < 0 ? -2 : 0))),
  };
  const changes: string[] = [];
  if (controls.destination !== trip.destination.name) changes.push(`Destination changes from ${trip.destination.name} to ${destination.name}.`);
  if (controls.dayDelta) changes.push(`${Math.abs(controls.dayDelta)} day${Math.abs(controls.dayDelta) === 1 ? "" : "s"} ${controls.dayDelta > 0 ? "added to" : "removed from"} the route.`);
  if (controls.budgetDelta) changes.push(`${controls.budgetDelta >= 0 ? "Budget increased" : "Budget reduced"} by ${Math.abs(controls.budgetDelta).toLocaleString("en-IN")} INR before style adjustments.`);
  changes.push(`Transportation is modeled as ${transport.label.toLowerCase()} travel.`);
  if (controls.travelStyle !== trip.plan.travelStyle) changes.push(`Travel style changes to ${controls.travelStyle}.`);
  return {
    original: trip,
    simulated,
    controls,
    changes,
    assumptions: ["All prices are planning estimates, not live availability or confirmed quotes.", "Transportation cost uses a relative mode multiplier and should be checked before booking.", "Generated activities preserve your destination interests and travel preferences where possible."],
  };
}

export function parseScenarioInstruction(instruction: string, trip: ForgedTrip): Partial<SimulatorControls> {
  const text = instruction.toLowerCase();
  const budgetMatch = text.match(/(?:₹|rs\.?|inr\s*)\s?([\d,]+)|([\d,]+)\s*(?:₹|rs\.?|inr)/i);
  const daysMatch = text.match(/(add|remove|increase|decrease|extend|shorten)\D{0,12}(\d+)\s*day/i);
  const destination = ["Jaipur", "Goa", "Manali", "Kerala", "Udaipur", "Rishikesh", "Srinagar"].find((name) => text.includes(name.toLowerCase()));
  const transportation = (Object.entries(transportAdjustments).find(([, value]) => text.includes(value.label.toLowerCase()))?.[0] ?? (text.includes("flight") ? "flight" : undefined)) as SimulatorTransport | undefined;
  const style = (["Backpacking", "Budget", "Relaxed", "Balanced", "Packed", "Comfortable", "Luxury"] as SimulatorStyle[]).find((value) => text.includes(value.toLowerCase()));
  const budgetValue = budgetMatch ? Number((budgetMatch[1] ?? budgetMatch[2]).replaceAll(",", "")) : undefined;
  return {
    ...(budgetValue ? { budgetDelta: text.includes("decrease") || text.includes("reduce") || text.includes("lower") ? -budgetValue : budgetValue } : {}),
    ...(daysMatch ? { dayDelta: (daysMatch[1] === "remove" || daysMatch[1] === "decrease" || daysMatch[1] === "shorten" ? -1 : 1) * Number(daysMatch[2]) } : {}),
    ...(destination ? { destination } : {}),
    ...(transportation ? { transportation } : {}),
    ...(style ? { travelStyle: style } : {}),
  };
}
