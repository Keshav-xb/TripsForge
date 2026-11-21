import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bus, CarFront, Clock3, TrainFront } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

type TrainResult = {
  status: string;
  provider?: string;
  trains?: Array<{ trainNumber: string; trainName: string; departureTime?: string; arrivalTime?: string; durationMinutes?: number; classes: string[]; runningDays: string[] }>;
  disclaimer?: string;
  message?: string;
};

const params = new URLSearchParams(window.location.search);
const today = new Date().toISOString().slice(0, 10);

export default function TransportSearch() {
  const [, navigate] = useLocation();
  const mode = window.location.pathname.split("/").pop() ?? "train";
  const [origin, setOrigin] = useState(params.get("origin") ?? "");
  const [destination, setDestination] = useState(params.get("destination") ?? "");
  const [travelDate, setTravelDate] = useState(params.get("travelDate") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrainResult | null>(null);
  const [road, setRoad] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);
  const [error, setError] = useState("");
  const title = mode === "bus" ? "Bus options" : mode === "car" ? "Road journey" : "Train options";
  const Icon = mode === "bus" ? Bus : mode === "car" ? CarFront : TrainFront;

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setResult(null); setRoad(null); setLoading(true);
    try {
      if (mode === "train") {
        const response = await fetch(`/api/trpc/trains.search?input=${encodeURIComponent(JSON.stringify({ json: { origin, destination, travelDate } }))}`);
        const body = await response.json();
        const data = body.result?.data?.json as TrainResult | undefined;
        if (!response.ok || !data) throw new Error(body.error?.json?.message ?? "Train search could not be completed.");
        setResult(data);
      } else if (mode === "car") {
        const originLat = Number(params.get("originLat")), originLng = Number(params.get("originLng"));
        const destinationLat = Number(params.get("destinationLat")), destinationLng = Number(params.get("destinationLng"));
        if (![originLat, originLng, destinationLat, destinationLng].every(Number.isFinite) || !params.has("originLat") || !params.has("destinationLat")) {
          throw new Error("Return to Journey Studio and select both places from the location suggestions to calculate a road route.");
        }
        const coordinates = `${originLng},${originLat};${destinationLng},${destinationLat}`;
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`);
        const body = await response.json();
        if (!response.ok || body.code !== "Ok" || !body.routes?.[0]) throw new Error("No drivable route was returned for these coordinates.");
        setRoad({ distanceKm: Math.round(body.routes[0].distance / 100) / 10, durationMinutes: Math.round(body.routes[0].duration / 60) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="min-h-screen bg-[#f7f2e7] text-[#123a35]">
    <SiteHeader />
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <button type="button" onClick={() => navigate("/planner")} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#637e76]"><ArrowLeft className="h-4 w-4" /> Back to Journey Studio</button>
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e9eee7] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#45645b]"><Icon className="h-4 w-4" /> TripsForge {title}</span>
        <h1 className="mt-5 font-display text-4xl tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#637e76]">{mode === "train" ? "Search timetable options for your selected route and date." : mode === "bus" ? "Bus services will appear here when a verified operator timetable connection is available." : "Check the mapped road route and estimated driving time."}</p>
      </div>
      <form onSubmit={search} className="grid gap-4 rounded-3xl border border-[#123a35]/10 bg-[#fffdf8] p-5 shadow-sm sm:grid-cols-2 sm:p-7">
        <label className="grid gap-2 text-sm font-bold">From<input required value={origin} onChange={e => setOrigin(e.target.value)} className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3 font-medium" /></label>
        <label className="grid gap-2 text-sm font-bold">To<input required value={destination} onChange={e => setDestination(e.target.value)} className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3 font-medium" /></label>
        <label className="grid gap-2 text-sm font-bold sm:col-span-2">Travel date<input required type="date" min={today} value={travelDate} onChange={e => setTravelDate(e.target.value)} className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3 font-medium" /></label>
        {mode !== "bus" && <button disabled={loading} className="rounded-xl bg-[#123a35] px-5 py-4 font-bold text-white disabled:opacity-60 sm:col-span-2">{loading ? "Checking…" : mode === "car" ? "Check road route" : "Search trains"}</button>}
      </form>
      {mode === "bus" && <div className="mt-6 rounded-2xl border border-[#123a35]/10 bg-white p-5"><p className="font-bold">Bus timetable connection not active yet</p><p className="mt-2 text-sm leading-6 text-[#637e76]">TripsForge will show bus options only after an operator confirms services for this route and date. No placeholder buses or guessed schedules will be displayed.</p></div>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {road && <div className="mt-6 rounded-2xl border border-[#123a35]/10 bg-white p-5"><p className="font-bold">Road route found</p><p className="mt-2 text-2xl font-black">{road.distanceKm.toLocaleString()} km</p><p className="mt-1 text-sm text-[#637e76]">About {Math.floor(road.durationMinutes / 60)}h {road.durationMinutes % 60}m in normal routing conditions. Not live traffic or road status.</p></div>}
      {result?.status === "offers_found" && <section className="mt-6 space-y-3"><div><h2 className="text-xl font-bold">Trains returned</h2><p className="mt-1 text-xs text-[#71857e]">{result.provider} · {result.trains?.length ?? 0} options</p></div>{result.trains?.map(train => <article key={train.trainNumber} className="rounded-2xl border border-[#123a35]/10 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{train.trainName}</h3><p className="text-xs text-[#71857e]">Train {train.trainNumber}</p></div><TrainFront className="h-5 w-5 text-[#e6651b]" /></div><div className="mt-4 flex items-center gap-3 text-sm font-semibold"><span>{train.departureTime ?? "Time unavailable"}</span><span className="h-px flex-1 bg-[#d9e1da]" /><span>{train.arrivalTime ?? "Time unavailable"}</span></div>{train.durationMinutes ? <p className="mt-2 flex items-center gap-1 text-xs text-[#71857e]"><Clock3 className="h-3 w-3" /> {Math.floor(train.durationMinutes / 60)}h {train.durationMinutes % 60}m</p> : null}<p className="mt-2 text-xs text-[#71857e]">{train.classes.join(" · ") || "Class details unavailable"}</p></article>)}<p className="text-xs leading-5 text-[#71857e]">{result.disclaimer}</p></section>}
      {result && result.status !== "offers_found" && <div className="mt-6 rounded-2xl border border-[#123a35]/10 bg-white p-5"><p className="font-bold">{result.status === "no_service_found" ? "No trains returned for this date" : result.status === "provider_not_configured" ? "Train search setup needed" : "Train search unavailable"}</p><p className="mt-2 text-sm leading-6 text-[#637e76]}>{result.message ?? result.disclaimer}</p></div>}
    </main>
    <SiteFooter />
  </div>;
}
