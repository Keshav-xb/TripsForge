import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CalendarDays, Compass, MapPin, Minus, Plus, Sparkles, Users, Wallet } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { MapView, type MapMarker } from "@/components/Map";
import LocationSearch from "@/components/LocationSearch";
import { calculateAllBudgetScenarios, type BudgetCategory, type BudgetCostItem, type BudgetQuantityRule } from "@/lib/tripBudget";
import { createEmptyTransportLeg, getTransportLegTotal, validateTransportLegs, type TransportLeg, type TransportMode } from "@/lib/transportLegs";
import { useTrip } from "@/contexts/TripContext";
import { defaultPlan, type Interest, type PlanInputs } from "@/lib/tripData";

const interests: Interest[] = ["Nature", "Food", "History", "Adventure", "Shopping", "Nightlife", "Photography", "Culture", "Beaches", "Architecture", "Family"];
const budgetDefaults: Array<{ category: BudgetCategory; label: string; rule: BudgetQuantityRule }> = [
  { category: "transport", label: "Transport (all journey legs)", rule: "per_trip" },
  { category: "accommodation", label: "Accommodation", rule: "per_room_per_night" },
  { category: "food", label: "Meals and drinks", rule: "per_person_per_night" },
  { category: "activities", label: "Attractions and experiences", rule: "per_person" },
  { category: "visa", label: "Visa and entry permits", rule: "per_person" },
  { category: "insurance", label: "Travel insurance", rule: "per_person" },
  { category: "connectivity", label: "SIM / eSIM and connectivity", rule: "per_person" },
  { category: "shopping", label: "Shopping and souvenirs", rule: "per_person" },
  { category: "tips", label: "Tips and service charges", rule: "per_trip" },
  { category: "miscellaneous", label: "Other expenses", rule: "per_trip" },
  { category: "contingency", label: "Emergency contingency", rule: "per_trip" },
];
const money = (amount: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const dateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export default function JourneyStudio() {
  const [, navigate] = useLocation();
  const { forgeTrip, plan } = useTrip();
  const params = new URLSearchParams(window.location.search);
  const destination = params.get("name") || plan.destination || defaultPlan.destination;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const [draft, setDraft] = useState<PlanInputs>(() => ({
    ...defaultPlan,
    ...plan,
    destination,
    destinationLocation: hasCoordinates ? { lat, lng } : plan.destinationLocation,
    startDate: dateOffset(30),
    endDate: dateOffset(33),
  }));
  const [error, setError] = useState("");
  const [transportLegs, setTransportLegs] = useState<TransportLeg[]>(() => [createEmptyTransportLeg(plan.startLocation || defaultPlan.startLocation, destination)]);
  const transportTotal = getTransportLegTotal(transportLegs);
  const updateTransportLeg = (id: string, updates: Partial<TransportLeg>) => setTransportLegs(legs => legs.map(leg => leg.id === id ? { ...leg, ...updates } : leg));
  const [infants, setInfants] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [budgetItems, setBudgetItems] = useState<BudgetCostItem[]>(() => budgetDefaults.map(item => ({
    id: item.category,
    label: item.label,
    category: item.category,
    enabled: true,
    unitCost: 0,
    quantityRule: item.rule,
    sourceType: "traveller_input",
    sourceLabel: "Traveller-entered estimate",
    currency: defaultPlan.currency,
  })));
  const [activeScenario, setActiveScenario] = useState<"economy" | "expected" | "comfort">("expected");
  const budgetScenarios = useMemo(() => calculateAllBudgetScenarios({
    startDate: draft.startDate,
    endDate: draft.endDate,
    adults: draft.adults,
    children: draft.children,
    infants,
    rooms,
    currency: draft.currency,
    items: budgetItems.map(item => item.category === "transport" ? { ...item, unitCost: transportTotal, enabled: transportTotal > 0 } : item),
  }), [draft.startDate, draft.endDate, draft.adults, draft.children, draft.currency, infants, rooms, budgetItems, transportTotal]);
  const currentBudget = budgetScenarios[activeScenario];
  const updateBudgetItem = (id: string, updates: Partial<BudgetCostItem>) =>
    setBudgetItems(items => items.map(item => item.id === id ? { ...item, ...updates } : item));
  const markers = useMemo<MapMarker[]>(() => hasCoordinates ? [{ id: "destination", label: destination, position: { lat, lng }, description: "Your selected destination" }] : [], [destination, hasCoordinates, lat, lng]);
  const patch = (values: Partial<PlanInputs>) => setDraft(current => ({ ...current, ...values }));
  const toggleInterest = (interest: Interest) => patch({ interests: draft.interests.includes(interest) ? draft.interests.filter(item => item !== interest) : [...draft.interests, interest] });
  const submit = () => {
    if (!draft.destination.trim()) return setError("Choose a destination first.");
    if (!draft.startLocation.trim() || !draft.startLocationPoint) return setError("Choose your departure city from the location suggestions.");
    if (!draft.startDate || !draft.endDate || draft.endDate <= draft.startDate) return setError("Choose an end date after your start date.");
    if (draft.adults + draft.children < 1) return setError("Add at least one traveller.");
    const legErrors = validateTransportLegs(transportLegs);
    if (legErrors.length) return setError(legErrors[0]);
    setError("");
    forgeTrip(draft);
    navigate("/itinerary");
  };
  const counter = (label: string, value: number, onChange: (value: number) => void, minimum: number) => (
    <div className="flex items-center justify-between rounded-2xl border border-[#123a35]/10 bg-white p-4">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(minimum, value - 1))} className="grid h-9 w-9 place-items-center rounded-full border border-[#123a35]/15"><Minus className="h-4 w-4" /></button>
        <span className="w-5 text-center font-bold tabular-nums">{value}</span>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-[#123a35] text-white"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-[#f7f2e7] text-[#123a35]">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12">
        <div className="mb-8">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#e6651b]"><Compass className="h-4 w-4" /> TripsForge Journey Studio</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[.98] tracking-[-.06em] sm:text-6xl">Shape a journey around <em>your way of travelling.</em></h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#637e76]">Set the essentials in one workspace. Your destination stays attached as you plan.</p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-6 rounded-[2rem] border border-[#123a35]/8 bg-[#fffdf8] p-5 shadow-sm sm:p-8">
            <div>
              <label className="mb-2 block text-sm font-bold">Destination</label>
              <div className="flex items-center gap-3 rounded-2xl border border-[#123a35]/15 bg-white px-4 py-4"><MapPin className="h-5 w-5 shrink-0 text-[#e6651b]" /><input value={draft.destination} onChange={e => { patch({ destination: e.target.value }); setTransportLegs(legs => legs.map((leg, index) => index === legs.length - 1 ? { ...leg, destination: e.target.value } : leg)); }} className="min-w-0 flex-1 bg-transparent font-semibold outline-none" aria-label="Destination" /></div>
              {hasCoordinates && <p className="mt-2 text-xs text-[#71857e]">Map location attached · {lat.toFixed(4)}, {lng.toFixed(4)}</p>}
            </div>
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><MapPin className="h-5 w-5 text-[#e6651b]" /> Starting point</h2>
              <LocationSearch
                label="Departure city"
                value={draft.startLocation}
                placeholder="Search your departure city"
                onChange={startLocation => { patch({ startLocation, startLocationPoint: undefined }); setTransportLegs(legs => legs.map((leg, index) => index === 0 ? { ...leg, origin: startLocation } : leg)); }}
                onSelect={location => { patch({ startLocation: location.label, startLocationPoint: { lat: location.lat, lng: location.lng } }); setTransportLegs(legs => legs.map((leg, index) => index === 0 ? { ...leg, origin: location.label } : leg)); }}
              />
              <p className="mt-2 text-xs text-[#71857e]">Required. Select a suggested place so TripsForge can estimate the journey from your actual starting point.</p>
              {draft.startLocationPoint && <p className="mt-1 text-xs font-semibold text-[#28745c]">Departure location selected · {draft.startLocationPoint.lat.toFixed(4)}, {draft.startLocationPoint.lng.toFixed(4)}</p>}
            </div>
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><CalendarDays className="h-5 w-5 text-[#e6651b]" /> Travel dates</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">Departure<input type="date" min={dateOffset(0)} value={draft.startDate} onChange={e => patch({ startDate: e.target.value })} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-3" /></label>
                <label className="grid gap-2 text-sm font-semibold">Return<input type="date" min={draft.startDate || dateOffset(0)} value={draft.endDate} onChange={e => patch({ endDate: e.target.value })} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-3" /></label>
              </div>
            </div>
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><Users className="h-5 w-5 text-[#e6651b]" /> Travellers</h2>
              <div className="grid gap-3 sm:grid-cols-2">{counter("Adults", draft.adults, adults => patch({ adults }), 1)}{counter("Children", draft.children, children => patch({ children }), 0)}{counter("Infants", infants, setInfants, 0)}{counter("Rooms", rooms, setRooms, 1)}</div>
            </div>
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><Wallet className="h-5 w-5 text-[#e6651b]" /> Budget</h2>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                <label className="grid gap-2 text-sm font-semibold">Total budget ({draft.currency})<input type="number" min="0" value={draft.budget} onChange={e => patch({ budget: Number(e.target.value) })} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-3" /></label>
                <label className="grid gap-2 text-sm font-semibold">Travel style<select value={draft.travelStyle} onChange={e => patch({ travelStyle: e.target.value as PlanInputs["travelStyle"] })} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-3"><option>Relaxed</option><option>Balanced</option><option>Packed</option></select></label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{(["Budget", "Balanced", "Premium"] as const).map(level => <button type="button" key={level} onClick={() => patch({ budgetLevel: level })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${draft.budgetLevel === level ? "border-[#123a35] bg-[#123a35] text-white" : "border-[#123a35]/15 bg-white"}`}>{level}</button>)}</div>
            </div>
            <div className="rounded-2xl border border-[#123a35]/10 bg-[#f5f7f2] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-display text-2xl">Journey transport legs</h2><p className="mt-1 text-sm text-[#71857e]">Break the route into separately priced segments.</p></div>
                <button type="button" onClick={() => setTransportLegs(legs => [...legs, createEmptyTransportLeg(legs.at(-1)?.destination || draft.startLocation, draft.destination)])} className="rounded-xl bg-[#123a35] px-3 py-2 text-sm font-bold text-white">Add leg +</button>
              </div>
              <div className="mt-4 space-y-3">
                {transportLegs.map((leg, index) => <div key={leg.id} className="rounded-xl border border-[#123a35]/10 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold">Leg {index + 1}</p><div className="flex items-center gap-3"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={leg.enabled} onChange={e => updateTransportLeg(leg.id, { enabled: e.target.checked })}/> Include</label>{transportLegs.length > 1 && <button type="button" onClick={() => setTransportLegs(legs => legs.filter(item => item.id !== leg.id))} className="text-xs font-semibold text-red-600">Remove</button>}</div></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold">From<input value={leg.origin} onChange={e => updateTransportLeg(leg.id, { origin: e.target.value })} placeholder="Origin" className="min-w-0 rounded-lg border border-[#123a35]/15 px-2 py-2 text-sm"/></label>
                    <label className="grid gap-1 text-xs font-semibold">To<input value={leg.destination} onChange={e => updateTransportLeg(leg.id, { destination: e.target.value })} placeholder="Destination" className="min-w-0 rounded-lg border border-[#123a35]/15 px-2 py-2 text-sm"/></label>
                    <label className="grid gap-1 text-xs font-semibold">Mode<select value={leg.mode} onChange={e => updateTransportLeg(leg.id, { mode: e.target.value as TransportMode })} className="rounded-lg border border-[#123a35]/15 px-2 py-2 text-sm"><option value="flight">Flight</option><option value="train">Train</option><option value="bus">Bus</option><option value="car">Car / taxi</option><option value="ferry">Ferry</option><option value="other">Other</option></select></label>
                    <label className="grid gap-1 text-xs font-semibold">Travel date<input type="date" value={leg.travelDate} onChange={e => updateTransportLeg(leg.id, { travelDate: e.target.value })} className="rounded-lg border border-[#123a35]/15 px-2 py-2 text-sm"/></label>
                    <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Estimated total for this leg ({draft.currency})<input type="number" min="0" value={leg.unitCost || ""} onChange={e => updateTransportLeg(leg.id, { unitCost: Math.max(0, Number(e.target.value) || 0) })} placeholder="Enter a quote or estimate" className="rounded-lg border border-[#123a35]/15 px-2 py-2 text-sm"/></label>
                  </div>
                  <p className="mt-2 text-[11px] text-[#87958f]">Traveller-entered amount for this segment. Not a live fare or availability result.</p>
                </div>)}
              </div>
              <p className="mt-3 text-sm font-bold">Transport total: {money(transportTotal, draft.currency)}</p>
            </div>
            <div className="rounded-2xl border border-[#123a35]/10 bg-[#f5f7f2] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-display text-2xl">Trip cost breakdown</h2><p className="mt-1 text-sm text-[#71857e]">Enter any known prices. Totals recalculate as you edit.</p></div>
                <select aria-label="Budget currency" value={draft.currency} onChange={e => { patch({ currency: e.target.value }); setBudgetItems(items => items.map(item => ({ ...item, currency: e.target.value }))); }} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-2 text-sm font-semibold">
                  {["INR","USD","EUR","GBP","AED","SGD","CAD","AUD"].map(currency => <option key={currency}>{currency}</option>)}
                </select>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["economy","expected","comfort"] as const).map(scenario => <button type="button" key={scenario} onClick={() => setActiveScenario(scenario)} className={`rounded-xl border px-2 py-3 text-sm font-bold capitalize ${activeScenario === scenario ? "border-[#123a35] bg-[#123a35] text-white" : "border-[#123a35]/15 bg-white"}`}>{scenario}</button>)}
              </div>
              <div className="mt-4 rounded-2xl bg-[#123a35] p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wider text-white/65">Current trip estimate · {activeScenario}</p>
                <p className="mt-1 text-3xl font-black tabular-nums">{money(currentBudget.total, draft.currency)}</p>
                <p className="mt-1 text-sm text-white/70">{money(currentBudget.perPerson, draft.currency)} per traveller · {draft.adults + draft.children + infants} travellers · {Math.max(0, Math.round((new Date(draft.endDate + "T12:00:00").getTime() - new Date(draft.startDate + "T12:00:00").getTime()) / 86400000))} nights</p>
              </div>
              <div className="mt-4 space-y-2">
                {budgetItems.filter(item => item.category !== "transport").map(item => <div key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(92px,120px)] items-center gap-2 rounded-xl bg-white p-3">
                  <input type="checkbox" checked={item.enabled} onChange={e => updateBudgetItem(item.id, { enabled: e.target.checked })} aria-label={`Include ${item.label}`} className="h-4 w-4 accent-[#123a35]" />
                  <div className="min-w-0"><p className="truncate text-sm font-bold">{item.label}</p><p className="text-[11px] text-[#87958f]">{item.quantityRule.replaceAll("_"," ")} · traveller estimate</p></div>
                  <label className="grid gap-1 text-[10px] font-bold uppercase text-[#71857e]">Unit price
                    <input type="number" min="0" step="1" value={item.unitCost || ""} placeholder="Add price" onChange={e => updateBudgetItem(item.id, { unitCost: Math.max(0, Number(e.target.value) || 0) })} className="w-full rounded-lg border border-[#123a35]/15 px-2 py-2 text-sm font-semibold text-[#123a35]" />
                  </label>
                </div>)}
              </div>
              <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-[#71857e]">
                <span>Priced category coverage: {currentBudget.pricedCategoryCoverage}%</span>
                <span>{currentBudget.unpricedCategories.length} categories still unpriced</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#87958f]">These are traveller-entered planning amounts, not live supplier quotes. Transport legs above are separate traveller-entered estimates. Live fares, timetables and bookable availability are not connected yet.</p>
            </div>
            <div>
              <h2 className="mb-3 font-display text-2xl">What do you want from this trip?</h2>
              <div className="flex flex-wrap gap-2">{interests.map(interest => <button type="button" key={interest} onClick={() => toggleInterest(interest)} className={`rounded-full border px-4 py-2.5 text-sm font-semibold ${draft.interests.includes(interest) ? "border-[#e6651b] bg-[#e6651b] text-white" : "border-[#123a35]/15 bg-white text-[#496961]"}`}>{interest}</button>)}</div>
            </div>
            {error && <p role="alert" className="rounded-xl bg-[#fff0e5] p-3 text-sm font-semibold text-[#bd4a10]">{error}</p>}
            <button type="button" onClick={submit} className="flex w-full items-center justify-between rounded-2xl bg-[#123a35] px-5 py-4 font-bold text-white transition hover:bg-[#1d514a]">Continue to itinerary <span className="flex items-center gap-2 text-[#ffbd70]"><Sparkles className="h-4 w-4" /><ArrowRight className="h-4 w-4" /></span></button>
            <p className="text-xs leading-5 text-[#87958f]">This creates a draft itinerary using the current planning engine. Live availability and AI-generated recommendations are not yet connected.</p>
          </section>
          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-[1.7rem] border border-[#123a35]/10 bg-white">
              <div className="border-b border-[#123a35]/10 px-4 py-3 text-sm font-bold">Journey preview</div>
              {hasCoordinates ? <MapView initialCenter={{ lat, lng }} initialZoom={11} markers={markers} className="h-[300px]" /> : <div className="grid h-[300px] place-items-center bg-[#eaf1ed] p-6 text-center text-sm text-[#71857e]">Select a destination with map coordinates to preview its location.</div>}
              <div className="p-4"><p className="font-display text-2xl">{draft.destination}</p><p className="mt-1 text-sm text-[#71857e]">{draft.adults + draft.children} travellers · {draft.travelStyle} pace</p></div>
            </div>
            <button type="button" onClick={() => navigate("/explore")} className="w-full rounded-xl border border-[#123a35]/15 bg-white px-4 py-3 text-sm font-bold">Change destination</button>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
