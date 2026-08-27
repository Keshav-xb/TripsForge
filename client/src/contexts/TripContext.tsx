/** Monsoon Atlas state: a compact client-only trip dossier that can later be replaced by real planning APIs. */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { buildTrip, defaultPlan, type ForgedTrip, type PlanInputs } from "@/lib/tripData";

type TripContextValue = {
  plan: PlanInputs;
  trip: ForgedTrip;
  isGenerating: boolean;
  forgeTrip: (nextPlan: PlanInputs) => void;
  finishGeneration: () => void;
  updateTrip: (nextTrip: ForgedTrip) => void;
};

const TripContext = createContext<TripContextValue | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState(defaultPlan);
  const [trip, setTrip] = useState(() => buildTrip(defaultPlan));
  const [isGenerating, setIsGenerating] = useState(false);
  const forgeTrip = useCallback((nextPlan: PlanInputs) => { setPlan(nextPlan); setTrip(buildTrip(nextPlan)); setIsGenerating(true); }, []);
  const finishGeneration = useCallback(() => setIsGenerating(false), []);
  const updateTrip = useCallback((nextTrip: ForgedTrip) => setTrip(nextTrip), []);
  const value = useMemo(() => ({
    plan,
    trip,
    isGenerating,
    forgeTrip,
    finishGeneration,
    updateTrip,
  }), [finishGeneration, forgeTrip, isGenerating, plan, trip, updateTrip]);
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) throw new Error("useTrip must be used inside TripProvider");
  return context;
}
