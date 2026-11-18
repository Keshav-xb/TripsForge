import { getTripDays, type PlanInputs } from "@/lib/tripData";

type BudgetProfile = {
  dailyPerTravellerInr: number;
  label: string;
};

// Indicative minimum on-the-ground spend per traveller, per day.
// These are planning floors, not live prices or booking quotes.
const profiles: Array<{ names: string[]; profile: BudgetProfile }> = [
  { names: ["paris"], profile: { dailyPerTravellerInr: 14000, label: "Paris, France" } },
  { names: ["london"], profile: { dailyPerTravellerInr: 16000, label: "London, United Kingdom" } },
  { names: ["new york", "nyc"], profile: { dailyPerTravellerInr: 18000, label: "New York, USA" } },
  { names: ["tokyo"], profile: { dailyPerTravellerInr: 11000, label: "Tokyo, Japan" } },
  { names: ["singapore"], profile: { dailyPerTravellerInr: 12000, label: "Singapore" } },
  { names: ["dubai"], profile: { dailyPerTravellerInr: 11000, label: "Dubai, UAE" } },
  { names: ["amsterdam"], profile: { dailyPerTravellerInr: 14000, label: "Amsterdam, Netherlands" } },
  { names: ["rome"], profile: { dailyPerTravellerInr: 12000, label: "Rome, Italy" } },
  { names: ["swiss alps", "zurich", "geneva", "lucerne"], profile: { dailyPerTravellerInr: 18000, label: "Switzerland" } },
  { names: ["jaipur"], profile: { dailyPerTravellerInr: 3500, label: "Jaipur, India" } },
  { names: ["shimla"], profile: { dailyPerTravellerInr: 4500, label: "Shimla, India" } },
  { names: ["manali"], profile: { dailyPerTravellerInr: 4500, label: "Manali, India" } },
  { names: ["goa"], profile: { dailyPerTravellerInr: 5000, label: "Goa, India" } },
  { names: ["delhi", "new delhi"], profile: { dailyPerTravellerInr: 4500, label: "Delhi, India" } },
  { names: ["mumbai"], profile: { dailyPerTravellerInr: 5500, label: "Mumbai, India" } },
  { names: ["srinagar"], profile: { dailyPerTravellerInr: 5000, label: "Srinagar, India" } },
  { names: ["jammu"], profile: { dailyPerTravellerInr: 3500, label: "Jammu, India" } },
  { names: ["kerala", "kochi", "munnar", "alleppey"], profile: { dailyPerTravellerInr: 5000, label: "Kerala, India" } },
];

export type BudgetEstimate = {
  minimum: number;
  dailyPerTraveller: number;
  days: number;
  travellers: number;
  destinationLabel: string;
} | null;

export function estimateMinimumBudget(plan: PlanInputs): BudgetEstimate {
  const key = plan.destination.trim().toLocaleLowerCase();
  const match = profiles.find(item => item.names.some(name => key === name || key.startsWith(`${name},`) || key.startsWith(`${name} `)));
  if (!match) return null;
  const days = getTripDays(plan.startDate, plan.endDate);
  const travellers = Math.max(1, plan.adults + plan.children);
  return {
    minimum: match.profile.dailyPerTravellerInr * days * travellers,
    dailyPerTraveller: match.profile.dailyPerTravellerInr,
    days,
    travellers,
    destinationLabel: match.profile.label,
  };
}
