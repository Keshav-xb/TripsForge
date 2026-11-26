import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CalendarDays, Compass, MapPin, Minus, Plus, Sparkles, Users, Wallet, Plane, TrainFront, BusFront, CarFront, ArrowUpRight } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { MapView, type MapMarker } from "@/components/Map";
import LocationSearch from "@/components/LocationSearch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calculateAllBudgetScenarios, type BudgetCategory, type BudgetCostItem, type BudgetQuantityRule } from "@/lib/tripBudget";
import { createEmptyTransportLeg, getTransportLegTotal, validateTransportLegs, type TransportLeg, type TransportMode } from "@/lib/transportLegs";
import { useTrip } from "@/contexts/TripContext";
import { defaultPlan, type Interest, type PlanInputs } from "@/lib/tripData";
import { assessTripReadiness } from "@/lib/tripReadiness";
import { createJourneyOptions } from "@/lib/journeyOptionBuilder";
import type { JourneyPriority } from "../../../server/lib/transport/journeyGraph";

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
const countryFromLabel = (label: string) => {
  const parts = label.split(",").map(part => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1].toLowerCase() : undefined;
};
const isInternationalRoute = (origin: string, destination: string) => {
  const originCountry = countryFromLabel(origin);
  const destinationCountry = countryFromLabel(destination);
  return Boolean(originCountry && destinationCountry && originCountry !== destinationCountry);
};

const dateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};


function DateField({ label, value, min, onChange }: { label:string; value:string; min?:string; onChange:(value:string)=>void }) {
 const [open,setOpen]=useState(false);
 const selected=value?new Date(`${value}T12:00:00`):undefined;
 const minimum=min?new Date(`${min}T12:00:00`):undefined;
 return <div className="grid min-w-0 gap-2"><span className="text-xs font-bold uppercase tracking-[.12em] text-[#71857e]">{label}</span><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" className="flex min-h-[58px] w-full items-center gap-3 rounded-xl border border-[#123a35]/12 bg-white px-3 text-left transition hover:border-[#e6651b]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6651b]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#f3f5ef] text-[#45645b]"><CalendarDays className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-wider text-[#87958f]">{label}</span><span className="block truncate text-sm font-bold text-[#123a35]">{selected?selected.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}):"Choose date"}</span></span><ArrowUpRight className="h-4 w-4 text-[#9aaba4]"/></button></PopoverTrigger><PopoverContent align="start" className="z-[1400] w-[min(21rem,calc(100vw-2rem))] rounded-2xl border-[#123a35]/10 bg-white p-2 shadow-xl"><Calendar mode="single" selected={selected} onSelect={date=>{if(date){onChange(new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10));setOpen(false);}}} disabled={date=>!!minimum&&date<minimum} initialFocus className="mx-auto [--cell-size:2.35rem]"/></PopoverContent></Popover></div>;
}

export default function JourneyStudio() {
  const [, navigate] = useLocation();
  const { forgeTrip, plan } = useTrip();
  const params = new URLSearchParams(window.location.search);
  // Only a curated Explore Route is allowed to prefill the journey endpoints.
  // A regular "Plan a trip" visit starts with two empty location fields.
  const isCuratedRoute = params.get("route") === "explore";
  const routeOrigin = isCuratedRoute ? (params.get("origin") ?? "") : "";
  const routeDestination = isCuratedRoute ? (params.get("destination") ?? "") : "";
  const [draft, setDraft] = useState<PlanInputs>(() => ({
    ...defaultPlan,
    ...plan,
    adults: 1,
    children: 0,
    infants: 0,
    rooms: 1,
    budget: plan.budget > 0 ? plan.budget : defaultPlan.budget,
    destination: routeDestination,
    startLocation: routeOrigin,
    destinationLocation: undefined,
    startLocationPoint: undefined,
    startDate: dateOffset(30),
    endDate: dateOffset(33),
  }));
  const [error, setError] = useState("");
  const [budgetInput, setBudgetInput] = useState(String(plan.budget > 0 ? plan.budget : defaultPlan.budget));
  const [transportLegs, setTransportLegs] = useState<TransportLeg[]>([]);
  const transportTotal = getTransportLegTotal(transportLegs);
  const transportQuery = new URLSearchParams({ origin: draft.startLocation, destination: draft.destination, travelDate: draft.startDate, ...(draft.startLocationPoint ? { originLat: String(draft.startLocationPoint.lat), originLng: String(draft.startLocationPoint.lng) } : {}), ...(draft.destinationLocation ? { destinationLat: String(draft.destinationLocation.lat), destinationLng: String(draft.destinationLocation.lng) } : {}) }).toString();
  const [routeResearch, setRouteResearch] = useState<{
    origin: string;
    destination: string;
    retrievedAt: string;
    provider: string;
    modes: Array<{ mode: TransportMode; status: string; evidence: string; serviceStatus: string; bookingStatus: string }>;
    limitations: string[];
    road: null | { status: string; distanceKm?: number; durationMinutes?: number; provider: string; reason?: string };
    trainAvailability: {
      status: "offers_found" | "no_service_found" | "provider_not_configured" | "lookup_unavailable";
      provider: string;
      retrievedAt?: string;
      trains: Array<{ trainNumber: string; trainName: string; departureTime?: string; arrivalTime?: string; durationMinutes?: number; classes: string[]; runningDays: string[] }>;
      disclaimer?: string;
      message?: string;
    };
    busAvailability: { status: string; provider: string; message: string };
  } | null>(null);
  const [researching, setResearching] = useState(false);
  const researchRunId = useRef(0);
  const [modeComparison, setModeComparison] = useState<Array<{ mode: string; status: string; headline: string; detail: string }>>([]);
  const [journeyPriority, setJourneyPriority] = useState<JourneyPriority>("balanced");
  const [journeyOptions, setJourneyOptions] = useState<ReturnType<typeof createJourneyOptions> | null>(null);
  const [journeySources, setJourneySources] = useState<{ flights?: any; buses?: any } | null>(null);
  const [gatewayDiscovery, setGatewayDiscovery] = useState<{ radiusKm: number; origin: Array<{ id: string; name: string; mode: string; distanceKm: number; iataCode?: string; stationCode?: string }>; destination: Array<{ id: string; name: string; mode: string; distanceKm: number; iataCode?: string; stationCode?: string }>; limitations: string[] } | null>(null);
  const [gatewayJourneyResearch, setGatewayJourneyResearch] = useState<any>(null);
  const [gatewayResearchState, setGatewayResearchState] = useState<"idle" | "searching" | "complete" | "unavailable">("idle");
  const [gatewayResearchError, setGatewayResearchError] = useState("");
  const [researchError, setResearchError] = useState("");
  const researchRouteKey = [draft.startLocation, draft.destination, draft.startDate, draft.startLocationPoint?.lat, draft.startLocationPoint?.lng, draft.destinationLocation?.lat, draft.destinationLocation?.lng].join("|");
  const lastResearchRouteKey = useRef(researchRouteKey);
  useEffect(() => {
    if (lastResearchRouteKey.current === researchRouteKey) return;
    lastResearchRouteKey.current = researchRouteKey;
    researchRunId.current += 1;
    setResearching(false);
    setRouteResearch(null);
    setModeComparison([]);
    setJourneyOptions(null);
    setJourneySources(null);
    setGatewayDiscovery(null);
    setGatewayJourneyResearch(null);
    setGatewayResearchState("idle");
    setGatewayResearchError("");
    setIntelligenceReport(null);
    setResearchError("");
  }, [researchRouteKey]);
  const [intelligenceReport, setIntelligenceReport] = useState<{
    engine: string; summary: string; confidence: string;
    findings: Array<{ mode: string; level: string; headline: string; details: string[] }>;
    missingEvidence: string[]; recommendedNextSteps: string[]; safetyRules: string[];
  } | null>(null);
  const runRouteResearch = async () => {
    if (!draft.startLocationPoint || !draft.destinationLocation) {
      setResearchError("Select both departure and destination from the location suggestions first.");
      return;
    }
    const activeRunId = ++researchRunId.current;
    setResearching(true);
    setResearchError("");
    setRouteResearch(null);
    setModeComparison([]);
    setJourneyOptions(null);
    setJourneySources(null);
    setGatewayDiscovery(null);
    setGatewayJourneyResearch(null);
    setGatewayResearchState("searching");
    setGatewayResearchError("");
    setIntelligenceReport(null);
    try {
      const input = {
        origin: draft.startLocation,
        destination: draft.destination,
        originPoint: draft.startLocationPoint,
        destinationPoint: draft.destinationLocation,
        travelDate: transportLegs.find(leg => leg.travelDate)?.travelDate || draft.startDate,
      };
      const response = await fetch(`/api/trpc/route.research?input=${encodeURIComponent(JSON.stringify({ json: input }))}`);
      const responseText = await response.text();
      const contentType = response.headers.get("content-type") || "unknown content type";
      const requestId = response.headers.get("x-tripsforge-request-id") || "not supplied";
      let payload: { result?: { data?: { json?: typeof routeResearch } }; error?: { json?: { message?: string; data?: { requestId?: string } } } };
      try {
        payload = JSON.parse(responseText);
      } catch {
        const statusHint = `HTTP ${response.status} · ${contentType}`;
        const requestHint = requestId !== "not supplied" ? ` · Reference: ${requestId}` : "";
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error(`Route service unavailable (${statusHint}). Please retry shortly.${requestHint}`);
        }
        throw new Error(`Route API returned a non-JSON response (${statusHint}).${requestHint}`);
      }
      const result = payload.result?.data?.json;
      if (activeRunId !== researchRunId.current) return;
      if (!response.ok || !result) {
        const reference = payload.error?.json?.data?.requestId || requestId;
        const suffix = reference && reference !== "not supplied" ? ` · Reference: ${reference}` : "";
        throw new Error((payload.error?.json?.message || `Route research failed (HTTP ${response.status}).`) + suffix);
      }
      const safeResearch = {
        ...result,
        modes: Array.isArray(result.modes) ? result.modes : [],
        limitations: Array.isArray(result.limitations) ? result.limitations : [],
        trainAvailability: {
          ...result.trainAvailability,
          status: result.trainAvailability?.status ?? "lookup_unavailable",
          provider: result.trainAvailability?.provider ?? "unknown",
          message: result.trainAvailability?.message ?? "The train provider returned an incomplete response.",
          trains: Array.isArray(result.trainAvailability?.trains) ? result.trainAvailability.trains : [],
        },
      };
      setRouteResearch(safeResearch);
      setGatewayDiscovery(null);
      // Gateway research is visible and reports failures instead of silently disappearing.
      setGatewayResearchState("searching");
      setGatewayResearchError("");
      void fetch(`/api/trpc/route.gatewayJourneys?input=${encodeURIComponent(JSON.stringify({ json: {
        origin: draft.startLocationPoint, destination: draft.destinationLocation,
        originLabel: draft.startLocation, destinationLabel: draft.destination,
        travelDate: input.travelDate, adults: 1, currency: "INR", radiusKm: 300
      } }))}`)
        .then(async response => {
          const raw = await response.text();
          let payload: any = null;
          try { payload = JSON.parse(raw); } catch { /* non-JSON response handled below */ }
          if (!response.ok || !payload?.result?.data?.json) {
            throw new Error(payload?.error?.json?.message || `Gateway research returned HTTP ${response.status}.`);
          }
          return payload.result.data.json;
        })
        .then(data => {
          if (activeRunId !== researchRunId.current) return;
          setGatewayJourneyResearch(data);
          setGatewayDiscovery({
            radiusKm: Number.isFinite(data.gatewayRadiusKm) ? data.gatewayRadiusKm : 300,
            origin: Array.isArray(data.gateways?.origin) ? data.gateways.origin : [],
            destination: Array.isArray(data.gateways?.destination) ? data.gateways.destination : [],
            limitations: Array.isArray(data.gateways?.limitations) ? data.gateways.limitations : [],
          });
          setGatewayResearchState("complete");
        })
        .catch(error => {
          if (activeRunId !== researchRunId.current) return;
          setGatewayResearchError(error instanceof Error ? error.message : "Gateway research could not be completed.");
          setGatewayResearchState("unavailable");
        });
      // Query independent mode providers together. A failure in one mode must not hide the others.
      const safeModeSearch = async (mode: string, path: string, payload: Record<string, unknown>): Promise<any> => {
        try {
          const response = await fetch(`/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: payload }))}`);
          const raw = await response.text();
          const parsed = JSON.parse(raw) as { result?: { data?: { json?: Record<string, unknown> } }; error?: { json?: { message?: string } } };
          if (!response.ok || !parsed.result?.data?.json) return { mode, status: "unavailable", headline: "Search unavailable", detail: parsed.error?.json?.message || `Provider returned HTTP ${response.status}.` };
          const data = parsed.result.data.json;
          const offers = Array.isArray(data.offers) ? data.offers : [];
          if (mode === "Flights") {
            const found = data.status === "offers_found" && offers.length > 0;
            const airportRoute = data.originCode && data.destinationCode ? `${data.originCode} → ${data.destinationCode}` : "";
            const direct = found && offers.some((offer: any) => Array.isArray(offer.segments) && offer.segments.length === 1);
            return {
              mode,
              status: found ? "available" : data.status === "provider_not_configured" ? "not_configured" : "unavailable",
              headline: found ? `${offers.length} flight options available` : data.status === "provider_not_configured" ? "Flight search not configured" : "Flight search could not verify this route",
              detail: found ? `${airportRoute}${direct ? " · Direct option found" : " · Connecting options"} · Supplier-returned results; confirm price and availability before booking.` : String(data.message ?? "The flight provider did not return a verifiable result. This is not proof that flights do not operate."),
              data
            };
          }
          const found = data.status === "offers_found" && offers.length > 0;
          const first = offers[0] as Record<string, unknown> | undefined;
          const sample = first ? ` First departure: ${String(first.departureTime ?? "time not supplied")} from ${String(first.fromStop ?? "origin stop")}.` : "";
          return {
            mode,
            status: found ? "available" : "no_published_timetable",
            headline: found ? `${offers.length} public bus trips available` : "No matching public timetable",
            detail: found ? `Published public timetable results, not private coach inventory.${sample}` : String(data.message ?? "No matching published public timetable. This does not mean buses do not operate on this route."),
            data
          };
        } catch {
          return { mode, status: "unavailable", headline: "Search unavailable", detail: "This provider could not be reached. Other transport results remain available." };
        }
      };
      const [flightMode, busMode] = await Promise.all([
        safeModeSearch("Flights", "flights.search", { origin: draft.startLocation, destination: draft.destination, departureDate: input.travelDate, adults: draft.adults, currency: draft.currency }),
        safeModeSearch("Buses", "buses.search", { origin: draft.startLocation, destination: draft.destination, travelDate: input.travelDate }),
      ]);
      if (activeRunId !== researchRunId.current) return;
      setJourneySources({ flights: flightMode.data, buses: busMode.data });
      setJourneyOptions(createJourneyOptions({ research: safeResearch, flights: flightMode.data, buses: busMode.data, priority: journeyPriority }));
      const roadMode = safeResearch.road?.status === "route_found"
        ? { mode: "Car", status: "estimated", headline: `${safeResearch.road.distanceKm} km · ${Math.floor((safeResearch.road.durationMinutes ?? 0) / 60)}h ${(safeResearch.road.durationMinutes ?? 0) % 60}m`, detail: "Driving route estimate from OSRM. Time can change with traffic, weather, road conditions and stops." }
        : { mode: "Car", status: "unavailable", headline: "Road estimate unavailable", detail: "No reliable driving route was returned for these selected points." };
      const trainFound = safeResearch.trainAvailability.status === "offers_found" && safeResearch.trainAvailability.trains.length > 0;
      const trainMode = trainFound
        ? { mode: "Trains", status: "available", headline: `${safeResearch.trainAvailability.trains.length} train services available`, detail: safeResearch.trainAvailability.disclaimer ?? "Published train timetable results. Verify running status and seat availability before travel." }
        : safeResearch.trainAvailability.status === "provider_not_configured"
          ? { mode: "Trains", status: "not_configured", headline: "Train search not configured", detail: safeResearch.trainAvailability.message ?? "The timetable provider credentials are not configured. No availability conclusion can be made." }
          : safeResearch.trainAvailability.status === "lookup_unavailable"
            ? { mode: "Trains", status: "unavailable", headline: "Train provider unavailable", detail: safeResearch.trainAvailability.message ?? "The timetable provider could not verify this route. This does not mean trains are unavailable." }
            : { mode: "Trains", status: "no_verified_options", headline: "No matching timetable returned", detail: safeResearch.trainAvailability.message ?? "No matching train timetable was returned for this route and date. This does not prove that no train service exists." };
      setModeComparison([roadMode, busMode, flightMode, trainMode]);
      const intelligenceResponse = await fetch(`/api/trpc/route.intelligence?input=${encodeURIComponent(JSON.stringify({ json: { research: safeResearch } }))}`);
      const intelligenceText = await intelligenceResponse.text();
      if (!intelligenceResponse.ok) throw new Error("The evidence summary could not be generated.");
      const intelligencePayload = JSON.parse(intelligenceText) as { result?: { data?: { json?: typeof intelligenceReport } } };
      const report = intelligencePayload.result?.data?.json;
      if (activeRunId === researchRunId.current && report) setIntelligenceReport(report);
    } catch (error) {
      if (activeRunId === researchRunId.current) {
        const message = error instanceof Error ? error.message : "Route research failed. Please try again.";
        setResearchError(message);
        // If the primary route request fails, gateway lookup was never started.
        // Clear the loading state instead of leaving the transport panel spinning forever.
        if (gatewayResearchState === "searching" && !gatewayJourneyResearch) {
          setGatewayResearchState("unavailable");
          setGatewayResearchError("Gateway search could not start because route research failed. Correct the route or retry.");
        }
      }
    } finally {
      if (activeRunId === researchRunId.current) setResearching(false);
    }
  };
  const updateTransportLeg = (id: string, updates: Partial<TransportLeg>) => setTransportLegs(legs => legs.map(leg => leg.id === id ? { ...leg, ...updates } : leg));
  const addResearchModeToJourney = (mode: string) => {
    const normalizedMode = mode.toLowerCase();
    const transportMode: TransportMode = normalizedMode === "flights" ? "flight" : normalizedMode === "trains" ? "train" : normalizedMode === "buses" ? "bus" : normalizedMode === "car" ? "car" : "unverified";
    if (transportMode === "unverified") return;
    const travelDate = transportLegs.find(leg => leg.travelDate)?.travelDate || draft.startDate;
    setTransportLegs(legs => {
      const editable = legs.find(leg => leg.enabled && leg.mode === "unverified");
      if (editable) return legs.map(leg => leg.id === editable.id ? { ...leg, origin: draft.startLocation, destination: draft.destination, mode: transportMode, travelDate } : leg);
      return [...legs, { ...createEmptyTransportLeg(draft.startLocation, draft.destination), mode: transportMode, travelDate }];
    });
    document.getElementById("transport-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const addGatewayOptionToJourney = (candidate: any, option: any) => {
    const originAccess = candidate?.access?.origin?.status === "route_found";
    const destinationAccess = candidate?.access?.destination?.status === "route_found";
    if (!originAccess || !destinationAccess || !Array.isArray(option?.legs) || option.legs.length === 0) return;
    const date = draft.startDate;
    const newLegs: TransportLeg[] = [
      { ...createEmptyTransportLeg(draft.startLocation, String(candidate.originGateway?.name ?? "Origin gateway")), mode: "car", travelDate: date, unitCost: 0 },
      ...option.legs.map((leg: any) => {
        const mode: TransportMode = ["flight", "train", "bus", "car", "ferry"].includes(String(leg.mode)) ? leg.mode : "other";
        return { ...createEmptyTransportLeg(String(leg.fromLabel ?? candidate.originGateway?.name ?? ""), String(leg.toLabel ?? candidate.destinationGateway?.name ?? "")), mode, travelDate: date, unitCost: 0 };
      }),
      { ...createEmptyTransportLeg(String(candidate.destinationGateway?.name ?? "Destination gateway"), draft.destination), mode: "car", travelDate: date, unitCost: 0 },
    ];
    setTransportLegs(current => {
      const empty = current.findIndex(leg => leg.enabled && leg.mode === "unverified" && !leg.origin.trim() && !leg.destination.trim());
      return empty >= 0 ? [...current.slice(0, empty), ...newLegs, ...current.slice(empty + 1)] : [...current, ...newLegs];
    });
    document.getElementById("transport-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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
  const readiness = useMemo(() => assessTripReadiness({
    origin: draft.startLocation, destination: draft.destination,
    originConfirmed: !!draft.startLocationPoint, destinationConfirmed: !!draft.destinationLocation,
    startDate: draft.startDate, endDate: draft.endDate,
    travellers: draft.adults + draft.children + infants, budgetLimit: draft.budget,
    estimatedTotal: currentBudget.total, pricedCategoryCoverage: currentBudget.pricedCategoryCoverage,
    enabledLegs: transportLegs.filter(leg => leg.enabled), interests: draft.interests,
    routeResearchCompleted: !!routeResearch,
  }), [draft, infants, currentBudget.total, currentBudget.pricedCategoryCoverage, transportLegs, routeResearch]);
  const updateBudgetItem = (id: string, updates: Partial<BudgetCostItem>) =>
    setBudgetItems(items => items.map(item => item.id === id ? { ...item, ...updates } : item));
  const destinationPoint = draft.destinationLocation;
  const hasDestinationPoint = !!destinationPoint && Number.isFinite(destinationPoint.lat) && Number.isFinite(destinationPoint.lng);
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
          <nav aria-label="Trip planning steps" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <a href="#trip-details" className="rounded-xl border border-[#123a35]/10 bg-white px-3 py-3 text-sm font-bold hover:border-[#e6651b]"><span className="mr-2 text-[#e6651b]">01</span>Trip details</a>
            <a href="#transport-plan" className="rounded-xl border border-[#123a35]/10 bg-white px-3 py-3 text-sm font-bold hover:border-[#e6651b]"><span className="mr-2 text-[#e6651b]">02</span>Transport</a>
            <a href="#trip-budget" className="rounded-xl border border-[#123a35]/10 bg-white px-3 py-3 text-sm font-bold hover:border-[#e6651b]"><span className="mr-2 text-[#e6651b]">03</span>Budget</a>
            <a href="#trip-interests" className="rounded-xl border border-[#123a35]/10 bg-white px-3 py-3 text-sm font-bold hover:border-[#e6651b]"><span className="mr-2 text-[#e6651b]">04</span>Experiences</a>
          </nav>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-8">
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><MapPin className="h-5 w-5 text-[#e6651b]" /> Starting point</h2>
              <LocationSearch
                label="Departure city"
                value={draft.startLocation}
                placeholder="Search your departure city"
                onChange={startLocation => { setRouteResearch(null); patch({ startLocation, startLocationPoint: undefined }); setTransportLegs(legs => legs.map((leg, index) => index === 0 ? { ...leg, origin: startLocation } : leg)); }}
                onSelect={location => { setRouteResearch(null); patch({ startLocation: location.label, startLocationPoint: { lat: location.lat, lng: location.lng } }); setTransportLegs(legs => legs.map((leg, index) => index === 0 ? { ...leg, origin: location.label } : leg)); }}
              />
              <p className="mt-2 text-xs text-[#71857e]">Required. Select a suggested place so TripsForge can estimate the journey from your actual starting point.</p>
              {draft.startLocationPoint && <p className="mt-1 text-xs font-semibold text-[#28745c]">Departure location selected · {draft.startLocationPoint.lat.toFixed(4)}, {draft.startLocationPoint.lng.toFixed(4)}</p>}
            </div>
            <div id="trip-details" className="scroll-mt-6">
              <LocationSearch
                label="Destination"
                value={draft.destination}
                placeholder="Search your destination city"
                onChange={value => { setRouteResearch(null); patch({ destination: value, destinationLocation: undefined }); setTransportLegs(legs => legs.map((leg, index) => index === legs.length - 1 ? { ...leg, destination: value } : leg)); }}
                onSelect={location => { setRouteResearch(null); patch({ destination: location.label, destinationLocation: { lat: location.lat, lng: location.lng } }); setTransportLegs(legs => legs.map((leg, index) => index === legs.length - 1 ? { ...leg, destination: location.label } : leg)); }}
              />
              {hasDestinationPoint && <p className="mt-2 text-xs text-[#71857e]">Map location attached · {destinationPoint!.lat.toFixed(4)}, {destinationPoint!.lng.toFixed(4)}</p>}
            </div>
            <div><h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><CalendarDays className="h-5 w-5 text-[#e6651b]"/> Travel dates</h2><div className="grid gap-3 sm:grid-cols-2"><DateField label="Departure" value={draft.startDate} min={dateOffset(0)} onChange={value=>{setRouteResearch(null);patch({startDate:value,...(draft.endDate<value?{endDate:value}:{})});}}/><DateField label="Return" value={draft.endDate} min={draft.startDate||dateOffset(0)} onChange={value=>patch({endDate:value})}/></div></div>
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><Users className="h-5 w-5 text-[#e6651b]" /> Travellers</h2>
              <div className="grid gap-3 sm:grid-cols-2">{counter("Adults", draft.adults, adults => patch({ adults }), 1)}{counter("Children", draft.children, children => patch({ children }), 0)}{counter("Infants", infants, setInfants, 0)}{counter("Rooms", rooms, setRooms, 1)}</div>
            </div>
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><Wallet className="h-5 w-5 text-[#e6651b]" /> Budget</h2>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                <label className="grid gap-2 text-sm font-semibold">Budget limit for everyone ({draft.currency})<input type="text" inputMode="decimal" value={budgetInput} onChange={e => { const value = e.target.value; if (value === "" || /^\d*(\.\d*)?$/.test(value)) { setBudgetInput(value); if (value.trim() !== "" && Number.isFinite(Number(value))) patch({ budget: Math.max(0, Number(value)) }); } }} onBlur={() => { if (budgetInput.trim() === "") setBudgetInput(String(draft.budget > 0 ? draft.budget : defaultPlan.budget)); }} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-3" /></label>
                <div className="grid gap-2 text-sm font-semibold">
                  <span>Travel style</span>
                  <Select value={draft.travelStyle} onValueChange={value => patch({ travelStyle: value as PlanInputs["travelStyle"] })}>
                    <SelectTrigger className="h-11 w-full rounded-xl border-[#123a35]/15 bg-white px-3 text-sm font-medium text-[#123a35] shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[1300] rounded-xl bg-white text-[#123a35] shadow-xl">
                      <SelectItem value="Relaxed">Relaxed</SelectItem>
                      <SelectItem value="Balanced">Balanced</SelectItem>
                      <SelectItem value="Packed">Packed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#71857e]">This is your spending limit for the whole group. It stays fixed when traveller numbers change; the trip estimate below recalculates from the unit prices you enter.</p><div className="mt-3 flex flex-wrap gap-2">{(["Budget", "Balanced", "Premium"] as const).map(level => <button type="button" key={level} onClick={() => patch({ budgetLevel: level })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${draft.budgetLevel === level ? "border-[#123a35] bg-[#123a35] text-white" : "border-[#123a35]/15 bg-white"}`}>{level}</button>)}</div>
            </div>
            <div id="transport-plan" className="scroll-mt-6 border-y border-[#123a35]/10 py-7">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#e6651b]">02 · Getting around</p><h2 className="mt-1 font-display text-2xl sm:text-3xl">Transport</h2><p className="mt-1 text-sm text-[#71857e]">Research transport options, then add a suitable mode directly to your journey segments.</p></div><span className="text-xs font-semibold text-[#71857e]">{transportLegs.length} {transportLegs.length===1?"segment":"segments"}</span></div>
              <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Journey segments</h3><p className="mt-1 text-xs text-[#71857e]">Add a segment for each change of transport or stop.</p></div><button type="button" onClick={()=>setTransportLegs(legs=>[...legs,createEmptyTransportLeg()])} className="inline-flex items-center gap-2 rounded-lg border border-[#123a35]/15 px-3 py-2 text-xs font-bold text-[#123a35] hover:bg-[#f3f5ef]"><Plus className="h-4 w-4"/> Add segment</button></div>
              <div className="relative mt-5 space-y-4 pl-5 before:absolute before:bottom-5 before:left-[7px] before:top-5 before:w-px before:bg-[#cbd8ce]">
                {transportLegs.map((leg,index)=>{
                  const ModeIcon = leg.mode === "flight" ? Plane : leg.mode === "train" ? TrainFront : leg.mode === "bus" ? BusFront : leg.mode === "car" ? CarFront : Compass;
                  const modeLabel = leg.mode === "unverified" ? "Choose transport" : leg.mode === "car" ? "Car / taxi" : leg.mode.charAt(0).toUpperCase()+leg.mode.slice(1);
                  const dateLabel = leg.travelDate ? new Date(leg.travelDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "Date not set";
                  return <article key={leg.id} className={`relative min-w-0 rounded-2xl border p-4 transition sm:p-5 ${leg.enabled ? "border-[#123a35]/10 bg-white shadow-[0_8px_28px_rgba(18,58,53,.045)]" : "border-dashed border-[#123a35]/20 bg-[#f7f8f4] opacity-70"}`}>
                    <span className={`absolute -left-[25px] top-6 h-3.5 w-3.5 rounded-full border-[3px] border-[#f7f2e7] ${leg.enabled ? "bg-[#e6651b]" : "bg-[#aab8af]"}`}/>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef3ed] text-[#31584e]"><ModeIcon className="h-[18px] w-[18px]"/></span>
                        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#87958f]">Segment {index+1}</p><p className="mt-0.5 text-sm font-bold text-[#123a35]">{modeLabel}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#45645b]"><input type="checkbox" checked={leg.enabled} onChange={e=>updateTransportLeg(leg.id,{enabled:e.target.checked})} className="h-4 w-4 accent-[#123a35]"/> Include</label>
                        {transportLegs.length>1&&<button type="button" onClick={()=>setTransportLegs(legs=>legs.filter(item=>item.id!==leg.id))} className="text-xs font-semibold text-[#b44b3e] hover:underline">Remove</button>}
                      </div>
                    </div>
                    <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl bg-[#f6f8f4] px-3 py-3">
                      <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-[#87958f]">From</p><p className="mt-1 truncate text-sm font-bold text-[#123a35]">{leg.origin||"Add origin"}</p></div>
                      <ArrowRight className="h-4 w-4 text-[#a0afa6]"/>
                      <div className="min-w-0 text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-[#87958f]">To</p><p className="mt-1 truncate text-sm font-bold text-[#123a35]">{leg.destination||"Add destination"}</p></div>
                    </div>
                    <details className="group mt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-2 text-xs font-bold text-[#45645b] marker:content-none hover:text-[#d45d1b]"><span>Edit segment details</span><span className="text-base leading-none transition group-open:rotate-45">+</span></summary>
                      <div className="grid gap-3 border-t border-[#123a35]/10 pt-4 sm:grid-cols-2">
                        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#45645b]">From<input value={leg.origin} onChange={e=>updateTransportLeg(leg.id,{origin:e.target.value})} placeholder="Origin" className="min-w-0 rounded-lg border border-[#123a35]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#123a35]"/></label>
                        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#45645b]">To<input value={leg.destination} onChange={e=>updateTransportLeg(leg.id,{destination:e.target.value})} placeholder="Destination" className="min-w-0 rounded-lg border border-[#123a35]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#123a35]"/></label>
                        <div className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#45645b]"><span>Transport mode</span><Select value={leg.mode} onValueChange={value=>updateTransportLeg(leg.id,{mode:value as TransportMode})}><SelectTrigger className="h-11 w-full rounded-xl border-[#123a35]/15 bg-white px-3 text-sm font-medium text-[#123a35] shadow-none"><SelectValue placeholder="Choose transport"/></SelectTrigger><SelectContent className="z-[1300] rounded-xl bg-white text-[#123a35] shadow-xl"><SelectItem value="unverified">Not decided</SelectItem><SelectItem value="flight">Flight</SelectItem><SelectItem value="train">Train</SelectItem><SelectItem value="bus">Bus</SelectItem><SelectItem value="car">Car / taxi</SelectItem><SelectItem value="ferry">Ferry</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                        <DateField label="Travel date" value={leg.travelDate} min={draft.startDate} onChange={value=>{setRouteResearch(null);updateTransportLeg(leg.id,{travelDate:value});}}/>
                        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#45645b] sm:col-span-2">Estimated cost ({draft.currency})<input type="number" min="0" value={leg.unitCost||""} onChange={e=>updateTransportLeg(leg.id,{unitCost:Math.max(0,Number(e.target.value)||0)})} placeholder="Enter your estimate" className="rounded-lg border border-[#123a35]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#123a35]"/></label>
                      </div>
                      <p className="mt-3 text-[11px] leading-5 text-[#87958f]">Traveller-entered estimate only. Not a live fare or availability result.</p>
                    </details>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#123a35]/8 pt-3 text-xs"><span className="inline-flex items-center gap-1.5 text-[#71857e]"><CalendarDays className="h-3.5 w-3.5"/>{dateLabel}</span><strong className="tabular-nums text-[#123a35]">{leg.unitCost>0?money(leg.unitCost,draft.currency):"Cost not added"}</strong></div>
                  </article>;
                })}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm"><span className="font-semibold text-[#71857e]">Estimated transport total</span><strong className="text-[#123a35]">{money(transportTotal,draft.currency)}</strong></div>
              <div className="mt-7 border-t border-[#123a35]/10 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#e6651b]">Route intelligence</p><h3 className="mt-1 font-display text-xl">Research this route</h3><p className="mt-1 text-xs leading-5 text-[#71857e]">Research available road estimates, published train and bus services, and flight options for your selected route and date. Add a suitable result to your journey segments.</p></div><button type="button" disabled={researching||!draft.startLocationPoint||!draft.destinationLocation} onClick={runRouteResearch} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123a35] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{researching?"Researching sources…":"Research route"} <ArrowRight className="h-4 w-4"/></button></div>
                {(!draft.startLocationPoint||!draft.destinationLocation)&&<p className="mt-3 text-xs text-[#9a6a35]">Select both endpoints from the location suggestions to enable route research.</p>}
                {researching&&<div role="status" aria-live="polite" className="mt-5 overflow-hidden rounded-2xl border border-[#123a35]/10 bg-white p-4 shadow-[0_12px_36px_rgba(18,58,53,0.06)]"><div className="flex items-center gap-3"><span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef3ed]"><span className="absolute h-6 w-6 animate-ping rounded-full bg-[#e6651b]/15"/><Compass className="relative h-5 w-5 text-[#123a35]"/></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-[#123a35]">Building your route picture</p><p className="mt-0.5 text-xs leading-5 text-[#71857e]">Checking road, rail, flight and public transport sources independently. Results appear as each check completes.</p></div><span className="h-2 w-2 animate-pulse rounded-full bg-[#e6651b]"/></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eef3ed]"><div className="h-full w-2/5 animate-pulse rounded-full bg-[#e6651b]"/></div></div>}{researchError&&<p role="alert" className="mt-3 rounded-lg bg-[#fff0e5] p-3 text-xs leading-5 text-[#a84b19]">{researchError}</p>}
                {routeResearch&&<div className="mt-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{routeResearch.origin} <span className="px-1 text-[#e6651b]">→</span> {routeResearch.destination}</p><span className="text-[10px] text-[#87958f]">Checked {new Date(routeResearch.retrievedAt).toLocaleString()}</span></div>
                  <section className="rounded-2xl border border-[#123a35]/10 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#e6651b]">All ways to get there</p><h3 className="mt-1 font-display text-xl">Transport options for this journey</h3></div><span className="rounded-full bg-[#eef3ed] px-3 py-1.5 text-[10px] font-bold text-[#45645b]">Selected travel date</span></div>
                    <div className="mt-5 space-y-5">
                      {([{key:"Flights",title:"Air connections",description:"Airports and flight services for this route.",icon:Plane},{key:"Trains",title:"Rail connections",description:"Train services and reachable railway gateways.",icon:TrainFront},{key:"Buses",title:"Bus connections",description:"Published public timetable evidence.",icon:BusFront},{key:"Car",title:"Road connections",description:"Direct driving and verified ground transfers.",icon:CarFront}] as const).map(group=>{const item=modeComparison.find(result=>result.mode===group.key);const Icon=group.icon;if((group.key==="Trains"||group.key==="Buses") && isInternationalRoute(routeResearch.origin,routeResearch.destination)) return null;if(item && !(item.status==="available" || item.status==="estimated")) return null;if(!item)return null;return <section key={group.key} className="overflow-hidden rounded-2xl border border-[#123a35]/10 bg-white shadow-[0_8px_28px_rgba(18,58,53,0.045)]">
                        <div className="flex items-center gap-3 border-b border-[#123a35]/8 bg-[#f7f9f5] px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#45645b]"><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><h4 className="text-sm font-extrabold text-[#123a35]">{group.title}</h4><p className="text-[10px] text-[#87958f]">{group.description}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#45645b]">{item.status.replaceAll("_"," ")}</span></div>
                        <div className="p-4"><p className="text-lg font-black leading-snug text-[#123a35]">{item.headline}</p><p className="mt-1 text-xs leading-5 text-[#71857e]">{item.detail}</p>{item.status==="available"||item.status==="estimated"?<button type="button" onClick={()=>addResearchModeToJourney(item.mode)} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#123a35] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1d514a]">Add {group.key.toLowerCase()} to journey <ArrowRight className="ml-2 h-3.5 w-3.5"/></button>:<p className="mt-3 text-[10px] text-[#87958f]">This provider did not return a selectable service. Check the indirect gateway results below before ruling out this mode.</p>}</div>
                      </section>})}
                    </div>
                    {journeyOptions && journeyOptions.options.length > 0 && <section className="mt-6 rounded-2xl border border-[#e6651b]/20 bg-[#fffaf5] p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#e6651b]">TripsForge journey intelligence</p><h3 className="mt-1 text-lg font-black">Ranked journey options</h3><p className="mt-1 text-xs text-[#71857e]">Compared from provider results and road estimates for your selected route.</p></div>
                        <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#45645b]">{journeyOptions.options.length} options</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">{([{value:"balanced",label:"Best balance"},{value:"cheapest",label:"Cheapest"},{value:"fastest",label:"Fastest"},{value:"fewest_transfers",label:"Fewest changes"}] as const).map(item=><button key={item.value} type="button" onClick={()=>{setJourneyPriority(item.value);setJourneyOptions(createJourneyOptions({research:routeResearch!,flights:journeySources?.flights,buses:journeySources?.buses,priority:item.value}));}} className={`rounded-full border px-3 py-2 text-[11px] font-bold ${journeyPriority===item.value?"border-[#123a35] bg-[#123a35] text-white":"border-[#123a35]/15 bg-white text-[#45645b]"}`}>{item.label}</button>)}</div>
                      {journeyOptions.options.length ? <div className="mt-4 space-y-3">{journeyOptions.options.slice(0,3).map((option,index)=><article key={option.id} className="rounded-xl border border-[#123a35]/10 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-extrabold">Option {index+1} · {option.legs.map(leg=>leg.mode==="car"?"Car":leg.mode.charAt(0).toUpperCase()+leg.mode.slice(1)).join(" + ")}</p><span className="rounded-full bg-[#eef3ed] px-2.5 py-1 text-[9px] font-bold uppercase text-[#45645b]">{option.connectionStatus==="direct"?"Direct provider option":"Connection time checked"}</span></div>
                        <p className="mt-2 text-sm font-bold">{option.legs.map(leg=>leg.fromLabel).at(0)} <span className="text-[#e6651b]">→</span> {option.legs.at(-1)?.toLabel}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#71857e]"><span>{option.durationMinutes!==undefined?`${Math.floor(option.durationMinutes/60)}h ${option.durationMinutes%60}m`:"Duration not supplied"}</span><span>{option.price!==undefined&&option.currency?new Intl.NumberFormat(undefined,{style:"currency",currency:option.currency,maximumFractionDigits:0}).format(option.price):"Fare not supplied"}</span></div>
                        <p className="mt-2 text-[10px] leading-5 text-[#87958f]">Evidence-backed result. This is a comparison, not a booking or availability guarantee.</p>
                      </article>)}</div> : <p className="mt-4 rounded-lg bg-white p-3 text-xs text-[#71857e]">No complete options could be built from the returned provider evidence. This is not proof that no transport service exists.</p>}
                      <p className="mt-3 text-[10px] leading-5 text-[#87958f]">Transfers between different services are not suggested unless exact shared station or terminal identifiers and reliable time-zone-aware schedules are available. Missing data is never guessed.</p>
                    </section>}
                    {gatewayResearchState === "searching" && <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-[#123a35]/10 bg-white p-4"><p className="text-sm font-bold">Checking indirect gateways…</p><p className="mt-1 text-xs leading-5 text-[#71857e]">Searching nearby airports, rail stations and bus terminals, then checking provider services and road access separately.</p></div>}
                    {gatewayResearchState === "unavailable" && <div role="alert" className="mt-5 rounded-xl border border-[#b44b3e]/20 bg-[#fff4f0] p-4"><p className="text-sm font-bold text-[#9d4338]">Indirect gateway research could not complete</p><p className="mt-1 text-xs leading-5 text-[#8d625b]">{gatewayResearchError || "The gateway provider request failed. Direct transport results above remain available."}</p></div>}
                    {gatewayResearchState === "complete" && gatewayJourneyResearch && <section className="mt-6 rounded-2xl border border-[#123a35]/10 bg-[#f7f9f5] p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#e6651b]">Indirect route discovery</p><h3 className="mt-1 text-lg font-black">Gateway connections</h3><p className="mt-1 text-xs leading-5 text-[#71857e]">Service search between nearby transport hubs, with road access checked at both ends.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#45645b]">{Array.isArray(gatewayJourneyResearch.candidates) ? gatewayJourneyResearch.candidates.length : 0} gateway searches</span></div>
                      {Array.isArray(gatewayJourneyResearch.candidates) && gatewayJourneyResearch.candidates.length > 0 ? <div className="mt-4 space-y-3">{gatewayJourneyResearch.candidates.slice(0,8).map((candidate:any,index:number)=> {
                        const options = Array.isArray(candidate.serviceOptions) ? candidate.serviceOptions : [];
                        const services = Array.isArray(candidate.services) ? candidate.services : [];
                        const access = candidate.access ?? {};
                        const accessText = (leg:any) => leg?.status === "route_found" ? `${leg.distanceKm} km road access · ${Math.floor((leg.durationMinutes ?? 0)/60)}h ${(leg.durationMinutes ?? 0)%60}m` : "Road access not verified";
                        return <article key={candidate.originGateway?.id + "-" + candidate.destinationGateway?.id + "-" + candidate.mode + "-" + index} className="rounded-xl border border-[#123a35]/10 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-extrabold">{candidate.mode === "flight" ? "Flight" : candidate.mode === "train" ? "Rail" : "Public bus"} · {candidate.originGateway?.name} → {candidate.destinationGateway?.name}</p><span className="rounded-full bg-[#eef3ed] px-2.5 py-1 text-[9px] font-bold uppercase text-[#45645b]">{String(candidate.status ?? "unknown").replaceAll("_"," ")}</span></div>
                          <div className="mt-2 grid gap-2 text-xs text-[#71857e] sm:grid-cols-2"><p>Start: {accessText(access.origin)}</p><p>Finish: {accessText(access.destination)}</p></div>
                          {options.length > 0 ? <div className="mt-3 space-y-2">{options.slice(0,2).map((option:any,optionIndex:number)=><div key={option.id ?? optionIndex} className="rounded-lg bg-[#f7f9f5] p-3"><p className="text-xs font-bold">{option.legs?.map((leg:any)=>`${leg.mode} ${leg.fromLabel} → ${leg.toLabel}`).join(" · ") || "Provider itinerary"}</p><p className="mt-1 text-[10px] text-[#71857e]">{option.durationMinutes !== undefined ? `${Math.floor(option.durationMinutes/60)}h ${option.durationMinutes%60}m service time` : "Service duration unavailable"} · {option.price !== undefined && option.currency ? new Intl.NumberFormat(undefined,{style:"currency",currency:option.currency,maximumFractionDigits:0}).format(option.price) : "Fare not comparable"}</p>{candidate.access?.origin?.status === "route_found" && candidate.access?.destination?.status === "route_found" && <button type="button" onClick={()=>addGatewayOptionToJourney(candidate,option)} className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-[#123a35] px-3 py-2 text-[10px] font-bold text-white">Add gateway itinerary to segments <ArrowRight className="ml-2 h-3 w-3"/></button>}</div>)}</div> : <p className="mt-3 text-xs text-[#71857e]">{services.length ? `${services.length} provider service(s) returned. Connection timing could not be validated.` : candidate.caveat || "No selectable provider service returned for this gateway pair."}</p>}
                          <p className="mt-3 text-[10px] leading-5 text-[#87958f]">{candidate.caveat || "Candidate only. Confirm terminal identity, service times, transfers and operator availability before relying on this route."}</p>
                        </article>;
                      })}</div> : <p className="mt-4 rounded-lg bg-white p-3 text-xs leading-5 text-[#71857e]">No gateway services were returned for the searched pairs. This is not proof that indirect transport does not exist.</p>}
                      {Array.isArray(gatewayJourneyResearch.limitations) && gatewayJourneyResearch.limitations.length > 0 && <div className="mt-4 rounded-lg bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#87958f]">Search limitations</p><ul className="mt-2 space-y-1">{gatewayJourneyResearch.limitations.slice(0,4).map((limitation:string,index:number)=><li key={index} className="text-[10px] leading-5 text-[#71857e]">• {limitation}</li>)}</ul></div>}
                    </section>}
                  </section>
                  {intelligenceReport&&<div className="rounded-xl border border-[#dce5dc] bg-white p-4"><p className="text-[10px] font-black uppercase tracking-wider text-[#e6651b]">TripsForge assessment · {intelligenceReport.confidence} confidence</p><p className="mt-2 text-sm font-semibold leading-6 text-[#123a35]">{intelligenceReport.summary}</p>{(intelligenceReport.recommendedNextSteps?.length ?? 0)>0&&<div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#87958f]">Recommended next steps</p><ul className="mt-2 space-y-2">{intelligenceReport.recommendedNextSteps.map((step,index)=><li key={index} className="flex gap-2 text-xs leading-5 text-[#637e76]"><span className="font-bold text-[#e6651b]">{index+1}.</span>{step}</li>)}</ul></div>}</div>}
                  {routeResearch.limitations.length>0&&<div><p className="text-[10px] font-bold uppercase tracking-wider text-[#87958f]">What this research cannot confirm</p><ul className="mt-2 space-y-1.5">{routeResearch.limitations.map((item,index)=><li key={index} className="text-[11px] leading-5 text-[#87958f]">• {item}</li>)}</ul></div>}
                </div>}
              </div>
            </div>
            <div id="trip-budget" className="scroll-mt-6 rounded-2xl border border-[#123a35]/10 bg-[#f5f7f2] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-display text-2xl">Trip budget</h2><p className="mt-1 text-sm text-[#71857e]">Enter a cost per unit. Totals recalculate when prices, traveller counts, rooms or dates change.</p></div>
                <Select value={draft.currency} onValueChange={currency => { patch({ currency }); setBudgetItems(items => items.map(item => ({ ...item, currency }))); }}>
                  <SelectTrigger aria-label="Budget currency" className="h-10 w-[112px] rounded-xl border-[#123a35]/15 bg-white px-3 text-sm font-semibold text-[#123a35] shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[1300] rounded-xl bg-white text-[#123a35] shadow-xl">
                    {["INR","USD","EUR","GBP","AED","SGD","CAD","AUD"].map(currency => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}
                  </SelectContent>
                </Select>
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
            <div id="trip-interests" className="scroll-mt-6">
              <h2 className="mb-3 font-display text-2xl">Experiences you care about</h2>
              <div className="flex flex-wrap gap-2">{interests.map(interest => <button type="button" key={interest} onClick={() => toggleInterest(interest)} className={`rounded-full border px-4 py-2.5 text-sm font-semibold ${draft.interests.includes(interest) ? "border-[#e6651b] bg-[#e6651b] text-white" : "border-[#123a35]/15 bg-white text-[#496961]"}`}>{interest}</button>)}</div>
            </div>
            {error && <p role="alert" className="rounded-xl bg-[#fff0e5] p-3 text-sm font-semibold text-[#bd4a10]">{error}</p>}
            <button type="button" onClick={submit} className="flex w-full items-center justify-between rounded-2xl bg-[#123a35] px-5 py-4 font-bold text-white transition hover:bg-[#1d514a]">Continue to itinerary <span className="flex items-center gap-2 text-[#ffbd70]"><Sparkles className="h-4 w-4" /><ArrowRight className="h-4 w-4" /></span></button>
            <p className="text-xs leading-5 text-[#87958f]">This creates a draft itinerary using the current planning engine. Live availability and AI-generated recommendations are not yet connected.</p>
          </section>
          <aside className="space-y-4 lg:sticky lg:top-6">
            <section className="overflow-hidden rounded-[1.7rem] border border-[#123a35]/10 bg-[#123a35] p-5 text-white">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ffbd70]">TripsForge control tower</p><h2 className="mt-1 font-display text-2xl">Plan readiness</h2></div>
                <div className="grid h-16 w-16 place-items-center rounded-full border-[5px] border-[#ffbd70]/80 text-xl font-black tabular-nums">{readiness.score}<span className="text-[9px] font-bold">/100</span></div></div>
              <p className="mt-3 text-sm font-semibold text-white">{readiness.status}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#ffbd70] transition-all" style={{ width: `${readiness.score}%` }} /></div>
              <div className="mt-4 space-y-2">{readiness.checks.map(check => <div key={check.id} className="flex items-start gap-2 text-xs leading-5"><span className={check.complete ? "text-[#9bd5b2]" : check.severity === "blocker" ? "text-[#ffbd70]" : "text-white/45"}>{check.complete ? "✓" : "○"}</span><span className={check.complete ? "text-white/75" : "text-white"}>{check.label}</span></div>)}</div>
              <div className="mt-4 rounded-xl bg-white/10 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-[#ffbd70]">Next best action</p><p className="mt-1 text-xs leading-5 text-white">{readiness.nextBestAction}</p></div>
              <p className="mt-3 text-[10px] leading-4 text-white/55">{readiness.disclaimer}</p>
            </section>
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
