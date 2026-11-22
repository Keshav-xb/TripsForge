import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bus, CarFront, Clock3, TrainFront, CalendarDays, ArrowRight, Info, ShieldCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

type BusResult = { status: string; provider?: string; retrievedAt?: string; feed?: string; state?: string; offers?: Array<{ route: string; headsign: string; departureTime: string; arrivalTime: string; intermediateStops: number; fromStop: string; toStop: string }>; message?: string; disclaimer?: string; sourceLicence?: string; };

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
  const [busResult, setBusResult] = useState<BusResult | null>(null);
  const [road, setRoad] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);
  const [error, setError] = useState("");
  const title = mode === "bus" ? "Bus options" : mode === "car" ? "Road journey" : "Train options";
  const Icon = mode === "bus" ? Bus : mode === "car" ? CarFront : TrainFront;

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setResult(null); setBusResult(null); setRoad(null); setLoading(true);
    try {
      if (mode === "bus") {
        const response = await fetch(`/api/trpc/buses.search?input=${encodeURIComponent(JSON.stringify({ json: { origin, destination, travelDate } }))}`);
        const body = await response.json();
        const data = body.result?.data?.json as BusResult | undefined;
        if (!response.ok || !data) throw new Error(body.error?.json?.message ?? "Bus timetable search could not be completed.");
        setBusResult(data);
      } else if (mode === "train") {
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
        <p className="mt-3 text-sm leading-6 text-[#637e76]">{mode === "train" ? "Search timetable options for your selected route and date." : mode === "bus" ? "Search published local public-transport timetables. Private intercity bus services are not included yet." : "Check the mapped road route and estimated driving time."}</p>
      </div>
      <form onSubmit={search} className="grid gap-4 rounded-3xl border border-[#123a35]/10 bg-[#fffdf8] p-5 shadow-sm sm:grid-cols-2 sm:p-7">
        <label className="grid gap-2 text-sm font-bold">From<input required value={origin} onChange={e => setOrigin(e.target.value)} className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3 font-medium" /></label>
        <label className="grid gap-2 text-sm font-bold">To<input required value={destination} onChange={e => setDestination(e.target.value)} className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3 font-medium" /></label>
        <label className="grid gap-2 text-sm font-bold sm:col-span-2">Travel date<input required type="date" min={today} value={travelDate} onChange={e => setTravelDate(e.target.value)} className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3 font-medium" /></label>
        {mode !== "bus" && <button disabled={loading} className="rounded-xl bg-[#123a35] px-5 py-4 font-bold text-white disabled:opacity-60 sm:col-span-2">{loading ? "Checking…" : mode === "car" ? "Check road route" : "Search trains"}</button>}
        {mode === "bus" && <button disabled={loading} className="rounded-xl bg-[#123a35] px-5 py-4 font-bold text-white disabled:opacity-60 sm:col-span-2">{loading ? "Checking public timetables…" : "Search public buses"}</button>}
      </form>
      {mode === "bus" && <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#dce5dc] bg-white p-4 text-xs leading-5 text-[#637e76]"><Info className="mt-0.5 h-4 w-4 shrink-0" />Free public transport timetable data. This does not include private bus inventory, fares, live seats, or ticket booking.</div>}
      {busResult?.status === "offers_found" && <section className="mt-7 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#e6651b]">Free public timetable</p><h2 className="mt-1 font-display text-2xl">Scheduled public buses</h2><p className="mt-1 text-xs text-[#71857e]">{origin} to {destination} · {travelDate} · {busResult.feed}</p></div><span className="rounded-full bg-[#e8eee7] px-3 py-2 text-xs font-bold text-[#31584e]">{busResult.offers?.length ?? 0} trips</span></div>
        {(busResult.offers ?? []).map((bus,index)=><article key={bus.route+"-"+bus.departureTime+"-"+index} className="rounded-2xl border border-[#123a35]/10 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#71857e]">Route {bus.route}</p><h3 className="mt-1 font-bold">{bus.headsign}</h3></div><span className="rounded-full bg-[#e8eee7] px-2.5 py-1 text-[10px] font-bold text-[#31584e]">Scheduled</span></div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div><p className="text-2xl font-black tabular-nums">{bus.departureTime}</p><p className="mt-1 text-xs text-[#71857e]">{bus.fromStop}</p></div><div className="flex items-center gap-1 text-[#87958f]"><span className="h-px w-6 bg-[#cbd8ce]"/><ArrowRight className="h-4 w-4"/><span className="h-px w-6 bg-[#cbd8ce]"/></div><div className="text-right"><p className="text-2xl font-black tabular-nums">{bus.arrivalTime}</p><p className="mt-1 text-xs text-[#71857e]">{bus.toStop}</p></div></div>
          <p className="mt-4 border-t border-[#123a35]/8 pt-3 text-xs text-[#71857e]">{bus.intermediateStops} intermediate stops · {busResult.state}</p>
        </article>)}
        <div className="rounded-xl border border-[#dce5dc] bg-white p-4"><p className="text-xs font-bold text-[#31584e]">Data source: {busResult.provider}</p><p className="mt-2 text-xs leading-5 text-[#71857e]">{busResult.disclaimer}</p><p className="mt-2 text-[10px] text-[#87958f]">Source licence: {busResult.sourceLicence}</p></div>
      </section>}
      {busResult && busResult.status !== "offers_found" && <div className="mt-6 rounded-2xl border border-[#123a35]/10 bg-white p-5"><p className="font-bold">{busResult.status === "no_service_found" ? "No matching local public timetable found" : "Public timetable temporarily unavailable"}</p><p className="mt-2 text-sm leading-6 text-[#637e76]">{busResult.status === "no_service_found" ? `The available public timetable feed did not return a scheduled service between ${origin} and ${destination} for ${travelDate}. This feed covers selected local public-transport networks, not a complete intercity bus directory. Private and intercity operators may still run this route.` : busResult.message}</p>{busResult.status === "no_service_found" && <p className="mt-3 text-xs font-semibold text-[#637e76]">Intercity bus search is not connected yet. No fares, seats or operator availability are being assumed.</p>}</div>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {road && <div className="mt-6 rounded-2xl border border-[#123a35]/10 bg-white p-5"><p className="font-bold">Road route found</p><p className="mt-2 text-2xl font-black">{road.distanceKm.toLocaleString()} km</p><p className="mt-1 text-sm text-[#637e76]">About {Math.floor(road.durationMinutes / 60)}h {road.durationMinutes % 60}m in normal routing conditions. Not live traffic or road status.</p></div>}
      {result?.status === "offers_found" && <section className="mt-7 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#e6651b]">Provider timetable</p><h2 className="mt-1 font-display text-2xl">Available train timetables</h2><p className="mt-1 text-xs text-[#71857e]">{origin} to {destination} · {new Date(travelDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</p></div><span className="rounded-full bg-[#e8eee7] px-3 py-2 text-xs font-bold text-[#31584e]">{result.trains?.length ?? 0} services</span></div>
        {[...(result.trains??[])].sort((a,b)=>(a.durationMinutes??Number.MAX_SAFE_INTEGER)-(b.durationMinutes??Number.MAX_SAFE_INTEGER)).map((train,index)=><article key={train.trainNumber} className="overflow-hidden rounded-2xl border border-[#123a35]/10 bg-white shadow-[0_8px_28px_rgba(18,58,53,.045)]">
          <div className="flex items-start justify-between gap-3 border-b border-[#123a35]/8 px-4 py-4 sm:px-5"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef3ed] text-[#31584e]"><TrainFront className="h-5 w-5"/></span><div className="min-w-0"><h3 className="truncate font-bold text-[#123a35]">{train.trainName}</h3><p className="mt-0.5 text-xs text-[#71857e]">Train no. {train.trainNumber}</p></div></div>{index===0&&<span className="shrink-0 rounded-full bg-[#fff0df] px-2.5 py-1.5 text-[10px] font-bold text-[#a9571d]">Shortest listed</span>}</div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-5 sm:px-5"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#87958f]">Departure</p><p className="mt-1 text-2xl font-black tabular-nums text-[#123a35]">{train.departureTime??"Not supplied"}</p><p className="mt-1 truncate text-xs text-[#71857e]">{origin}</p></div><div className="flex min-w-0 flex-col items-center gap-1 px-1 text-[#71857e]"><span className="text-[10px] font-semibold">{train.durationMinutes ? (Math.floor(train.durationMinutes/60)+"h "+(train.durationMinutes%60)+"m") : "Duration n/a"}</span><span className="flex w-full items-center"><span className="h-1.5 w-1.5 rounded-full bg-[#e6651b]"/><span className="h-px flex-1 bg-[#cbd8ce]"/><ArrowRight className="h-3.5 w-3.5 shrink-0"/></span><span className="text-[9px]">Journey time</span></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-[#87958f]">Arrival</p><p className="mt-1 text-2xl font-black tabular-nums text-[#123a35]">{train.arrivalTime??"Not supplied"}</p><p className="mt-1 truncate text-xs text-[#71857e]">{destination}</p></div></div>
          <div className="space-y-3 border-t border-[#123a35]/8 bg-[#fbfcf9] px-4 py-4 sm:px-5">
            <div><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#87958f]">Travel classes</p><div className="flex flex-wrap gap-1.5">{train.classes.length?train.classes.map(value=><span key={value} className="rounded-md border border-[#dce5dc] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#31584e]">{value}</span>):<span className="text-xs text-[#71857e]">Class details not supplied</span>}</div></div>
            <div><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#87958f]">Scheduled running days</p><div className="flex flex-wrap gap-1.5">{train.runningDays.length?train.runningDays.map(day=><span key={day} className="rounded-md bg-[#e8eee7] px-2 py-1 text-[10px] font-semibold text-[#31584e]">{day}</span>):<span className="text-xs text-[#71857e]">Running days not supplied</span>}</div></div>
            <div className="flex items-start gap-2 rounded-lg bg-[#f0f3ed] p-3 text-[11px] leading-5 text-[#637e76]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span>Intermediate stops, platform, fare and live seat availability are not included in this provider response.</span></div>
          </div>
        </article>)}
        <div className="rounded-xl border border-[#dce5dc] bg-white p-4"><p className="flex items-center gap-2 text-xs font-bold text-[#31584e]"><ShieldCheck className="h-4 w-4"/> Timetable data transparency</p><p className="mt-2 text-xs leading-5 text-[#71857e]">{result.disclaimer} Provider: {result.provider}. Results are sorted by shortest reported duration, not by fare or availability.</p></div>
      </section>}
      {result && result.status !== "offers_found" && <div className="mt-6 rounded-2xl border border-[#123a35]/10 bg-white p-5"><p className="font-bold">{result.status === "no_service_found" ? "No trains returned for this date" : result.status === "provider_not_configured" ? "Train search setup needed" : "Train search unavailable"}</p><p className="mt-2 text-sm leading-6 text-[#637e76]">{result.message ?? result.disclaimer}</p></div>}
    </main>
    <SiteFooter />
  </div>;
}
