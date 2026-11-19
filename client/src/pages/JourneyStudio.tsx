import { useEffect, useMemo, useState } from "react";
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
    budget: plan.budget > 0 ? plan.budget : defaultPlan.budget,
    destination,
    destinationLocation: hasCoordinates ? { lat, lng } : plan.destinationLocation,
    startDate: dateOffset(30),
    endDate: dateOffset(33),
  }));
  const [error, setError] = useState("");
  const [budgetInput, setBudgetInput] = useState(String(plan.budget > 0 ? plan.budget : defaultPlan.budget));
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
  const destinationPoint = draft.destinationLocation;
  const destinationPoint = draft.destinationLocation;
  const hasDestinationPoint = !!destinationPoint && Number.isFinite(destinationPoint.lat) && Number.isFinite(destinationPoint.lng);
  const [roadCheck, setRoadCheck] = useState<{ status: "idle" | "loading" | "verified" | "unavailable" | "error"; distanceKm?: number; durationMinutes?: number; reason?: string; provider?: string; checkedAt?: string }>({ status: "idle" });
  const [flightCheck, setFlightCheck] = useState<{ status: "idle" | "loading" | "offers_found" | "no_offers_for_search" | "not_configured" | "location_unresolved" | "error"; message?: string; checkedAt?: string; origin?: { code: string; name: string }; destination?: { code: string; name: string }; offers?: Array<{ id: string; price: string | null; currency: string | null; airlines: Array<{ code: string; name: string }>; itineraries: Array<{ duration: string | null; segments: Array<{ from: string; to: string; departureAt: string | null; arrivalAt: string | null; airline: string; flightNumber: string }> }> }>; coverageNote?: string }>({ status: "idle" });
  useEffect(() => {
    const origin = draft.startLocationPoint;
    const destinationPoint = draft.destinationLocation;
    if (!origin || !destinationPoint) {
      setRoadCheck({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setRoadCheck({ status: "loading" });
    const input = encodeURIComponent(JSON.stringify({ json: { origin, destination: destinationPoint } }));
    fetch(`/api/trpc/route.feasibility?input=${input}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("ROAD_CHECK_FAILED");
        const payload = await response.json();
        const result = payload?.result?.data?.json;
        if (!result || !["verified", "unavailable"].includes(result.status)) throw new Error("INVALID_ROAD_CHECK_RESPONSE");
        setRoadCheck(result);
      })
      .catch(error => {
        if (error instanceof Error && error.name === "AbortError") return;
        setRoadCheck({ status: "error", reason: "Road-network verification is temporarily unavailable." });
      });
    return () => controller.abort();
  }, [draft.startLocationPoint, draft.destinationLocation]);
  const markers = useMemo<MapMarker[]>(() => hasDestinationPoint ? [{ id: "destination", label: draft.destination, position: destinationPoint!, description: "Your selected destination" }] : [], [draft.destination, hasDestinationPoint, destinationPoint]);
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
    forgeTrip(draft, transportLegs);
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
              <LocationSearch
                label="Destination"
                value={draft.destination}
                placeholder="Search your destination city"
                onChange={value => { patch({ destination: value, destinationLocation: undefined }); setTransportLegs(legs => legs.map((leg, index) => index === legs.length - 1 ? { ...leg, destination: value } : leg)); }}
                onSelect={location => { patch({ destination: location.label, destinationLocation: { lat: location.lat, lng: location.lng } }); setTransportLegs(legs => legs.map((leg, index) => index === legs.length - 1 ? { ...leg, destination: location.label } : leg)); }}
              />
              {hasDestinationPoint && <p className="mt-2 text-xs text-[#71857e]">Map location attached · {destinationPoint!.lat.toFixed(4)}, {destinationPoint!.lng.toFixed(4)}</p>}
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
              {flightCheck.status !== "idle" && <div className="mt-3 rounded-xl border border-[#123a35]/10 bg-white p-4" aria-live="polite">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">Flight intelligence</p><span className="text-[11px] text-[#87958f]">Amadeus</span></div>
                {flightCheck.status === "loading" && <p className="mt-2 text-sm text-[#71857e]">Checking flight offers for your dates…</p>}
                {flightCheck.status === "not_configured" && <p className="mt-2 text-sm text-[#71857e]">Flight provider credentials are not configured on the server yet.</p>}
                {flightCheck.status === "location_unresolved" && <p className="mt-2 text-sm text-[#71857e]">{flightCheck.message}</p>}
                {flightCheck.status === "error" && <p className="mt-2 text-sm text-[#71857e]">{flightCheck.message}</p>}
                {flightCheck.status === "no_offers_for_search" && <p className="mt-2 text-sm text-[#71857e]">No offers were returned for these dates and search criteria. This does not mean no flights operate on this route.</p>}
                {flightCheck.status === "offers_found" && <><p className="mt-2 text-xs text-[#71857e]">{flightCheck.origin?.name} ({flightCheck.origin?.code}) → {flightCheck.destination?.name} ({flightCheck.destination?.code})</p>
                  <div className="mt-3 space-y-2">{(flightCheck.offers ?? []).slice(0, 5).map(offer => <div key={offer.id} className="rounded-lg border border-[#123a35]/10 p-3">
                    <p className="font-bold">{offer.price ? `${offer.currency} ${offer.price}` : "Price not supplied"}</p>
                    <p className="mt-1 text-xs text-[#71857e]">{offer.airlines.map(airline => airline.name).join(", ") || "Airline details unavailable"}</p>
                    {(offer.itineraries ?? []).map((itinerary, itineraryIndex) => <div key={itineraryIndex} className="mt-2 text-xs text-[#71857e]"><p>{itinerary.duration ?? "Duration unavailable"} · {itinerary.segments.length} flight segment(s)</p>{itinerary.segments.map((segment, segmentIndex) => <p key={segmentIndex}>{segment.from} → {segment.to} · {segment.airline} {segment.flightNumber} · {segment.departureAt ? new Date(segment.departureAt).toLocaleString() : "time unavailable"}</p>)}</div>)}
                  </div>)}</div>
                </>}
                {flightCheck.coverageNote && <p className="mt-3 text-[11px] leading-4 text-[#87958f]">{flightCheck.coverageNote}</p>}
                {flightCheck.checkedAt && <p className="mt-2 text-[11px] text-[#87958f]">Checked {new Date(flightCheck.checkedAt).toLocaleString()}</p>}
              </div>}
              {roadCheck.status !== "idle" && <div className="mt-3 rounded-xl border border-[#123a35]/10 bg-[#f5f7f2] p-4" aria-live="polite">
                <p className="text-sm font-bold">Road route check</p>
                {roadCheck.status === "loading" && <p className="mt-1 text-sm text-[#71857e]">Checking the road network…</p>}
                {roadCheck.status === "verified" && <><p className="mt-1 text-sm font-semibold text-[#28745c]">Car route found</p><p className="mt-1 text-sm">{roadCheck.distanceKm} km · about {Math.floor((roadCheck.durationMinutes || 0) / 60)}h {(roadCheck.durationMinutes || 0) % 60}m</p></>}
                {roadCheck.status === "unavailable" && <p className="mt-1 text-sm text-[#71857e]">No drivable route was returned. TripsForge will not recommend car travel for this pair based on this check.</p>}
                {roadCheck.status === "error" && <p className="mt-1 text-sm text-[#71857e]">{roadCheck.reason}</p>}
                {roadCheck.provider && <p className="mt-2 text-[11px] text-[#87958f]">Source: {roadCheck.provider} · checked {roadCheck.checkedAt ? new Date(roadCheck.checkedAt).toLocaleString() : "just now"}</p>}
              </div>}
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
                <label className="grid gap-2 text-sm font-semibold">Budget limit for everyone ({draft.currency})<input type="text" inputMode="decimal" value={budgetInput} onChange={e => { const value = e.target.value; if (value === "" || /^\d*(\.\d*)?$/.test(value)) { setBudgetInput(value); if (value.trim() !== "" && Number.isFinite(Number(value))) patch({ budget: Math.max(0, Number(value)) }); } }} onBlur={() => { if (budgetInput.trim() === "") setBudgetInput(String(draft.budget > 0 ? draft.budget : defaultPlan.budget)); }} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-3" /></label>
                <label className="grid gap-2 text-sm font-semibold">Travel style<select value={draft.travelStyle} onChange={e => patch({ travelStyle: e.target.value as PlanInputs["travelStyle"] })} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-3"><option>Relaxed</option><option>Balanced</option><option>Packed</option></select></label>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#71857e]">This is your spending limit for the whole group. It stays fixed when traveller numbers change; the trip estimate below recalculates from the unit prices you enter.</p><div className="mt-3 flex flex-wrap gap-2">{(["Budget", "Balanced", "Premium"] as const).map(level => <button type="button" key={level} onClick={() => patch({ budgetLevel: level })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${draft.budgetLevel === level ? "border-[#123a35] bg-[#123a35] text-white" : "border-[#123a35]/15 bg-white"}`}>{level}</button>)}</div>
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
                <div><h2 className="font-display text-2xl">Trip cost breakdown</h2><p className="mt-1 text-sm text-[#71857e]">Enter a cost per unit. Totals recalculate when prices, traveller counts, rooms or dates change.</p></div>
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
              <p className="mt-2 text-xs leading-5 text-[#87958f]">Only entered prices are included, so an empty breakdown can show zero. Per-person items scale with travellers; room items scale with rooms and nights; per-trip items are counted once. These are traveller-entered planning amounts, not live supplier quotes. Live fares, timetables and bookable availability are not connected yet.</p>
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
              {hasDestinationPoint ? <MapView initialCenter={destinationPoint!} initialZoom={11} markers={markers} className="h-[300px]" /> : <div className="grid h-[300px] place-items-center bg-[#eaf1ed] p-6 text-center text-sm text-[#71857e]">Select a destination from the suggestions to preview its location.</div>}
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
