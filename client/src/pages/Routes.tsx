import { ArrowRight, CalendarDays, Compass, Globe2, Loader2, MapPin, Route as RouteIcon, SlidersHorizontal, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { formatRouteBudget, type RouteRecord } from "@/lib/routeData";
import { listExploreRoutes } from "@/lib/supabaseRoutes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const selectTriggerClass = "h-11 w-full rounded-xl border-[#123a35]/15 bg-white px-3 text-sm font-semibold text-[#355752] shadow-none transition hover:border-[#e6651b]/50 focus:ring-2 focus:ring-[#e6651b]/15";

function values(routes: RouteRecord[], key: "continent" | "country" | "region") {
  return Array.from(new Set(routes.map((route) => route[key]))).sort();
}

export default function Routes() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [source, setSource] = useState<"supabase" | "sample">("sample");
  const [loading, setLoading] = useState(true);
  const [continent, setContinent] = useState("All continents");
  const [country, setCountry] = useState("All countries");
  const [region, setRegion] = useState("All regions");
  const [budget, setBudget] = useState("Any budget");
  const [duration, setDuration] = useState("Any duration");
  const [style, setStyle] = useState("All styles");

  useEffect(() => {
    let active = true;
    void listExploreRoutes().then((result) => { if (active) { setRoutes(result.routes); setSource(result.source); } }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => routes.filter((route) => {
    const budgetMatch = budget === "Any budget" || (budget === "Under ₹50k" ? route.budgetMin < 50000 : budget === "₹50k–₹1.5L" ? route.budgetMin < 150000 && route.budgetMax >= 50000 : route.budgetMin >= 150000);
    const durationMatch = duration === "Any duration" || (duration === "1 week or less" ? route.durationDays <= 7 : duration === "8–10 days" ? route.durationDays >= 8 && route.durationDays <= 10 : route.durationDays > 10);
    const styleMatch = style === "All styles" || route.travelStyles.includes(style);
    return (continent === "All continents" || route.continent === continent) && (country === "All countries" || route.country === country) && (region === "All regions" || route.region === region) && budgetMatch && durationMatch && styleMatch;
  }), [routes, continent, country, region, budget, duration, style]);

  const reset = () => { setContinent("All continents"); setCountry("All countries"); setRegion("All regions"); setBudget("Any budget"); setDuration("Any duration"); setStyle("All styles"); };

  return <div className="min-h-screen bg-[#fffdf8] text-[#123a35]"><SiteHeader /><main>
    <section className="relative overflow-hidden border-b border-[#123a35]/10 bg-[#f2eddf] px-5 py-14 lg:px-10 lg:py-20"><div className="absolute -right-24 -top-28 h-80 w-80 rounded-full border-[34px] border-[#e6651b]/10" /><div className="relative mx-auto max-w-[1440px]"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#e6651b]"><Globe2 className="h-4 w-4" /> Global route discovery</div><h1 className="mt-5 max-w-4xl font-display text-5xl leading-[.92] tracking-[-.07em] sm:text-7xl">Find the route <em>between</em> the places.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#5d7771]">Curated multi-stop journeys for travellers who want more than a pin on the map. Start with a continent, follow a region, and let the route take shape.</p><div className="mt-8 flex flex-wrap gap-3 text-sm font-bold"><span className="rounded-full bg-[#123a35] px-4 py-2 text-white">{routes.length || 6} route ideas</span><span className="rounded-full border border-[#123a35]/15 bg-white/60 px-4 py-2 text-[#56716a]">Sample catalog · ready to expand</span></div></div></section>
    <section className="px-5 py-8 lg:px-10 lg:py-12"><div className="mx-auto max-w-[1440px]"><div className="rounded-[1.6rem] border border-[#123a35]/10 bg-white p-4 shadow-[0_18px_50px_-38px_rgba(18,58,53,.6)] sm:p-5"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#e6651b]" /><p className="text-sm font-black uppercase tracking-[.12em] text-[#123a35]">Shape your search</p></div><button onClick={reset} className="text-xs font-bold text-[#e6651b] hover:underline">Reset filters</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="grid gap-2 text-xs font-bold text-[#6a817a]">Continent
          <Select value={continent} onValueChange={(value) => { setContinent(value); setCountry("All countries"); setRegion("All regions"); }}>
            <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1300] rounded-xl border-[#123a35]/10 bg-white text-[#123a35] shadow-xl">
              <SelectItem value="All continents">All continents</SelectItem>{values(routes, "continent").map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-2 text-xs font-bold text-[#6a817a]">Country
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1300] rounded-xl bg-white text-[#123a35] shadow-xl">
              <SelectItem value="All countries">All countries</SelectItem>{values(routes.filter(route => continent === "All continents" || route.continent === continent), "country").map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-2 text-xs font-bold text-[#6a817a]">State / region
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1300] rounded-xl bg-white text-[#123a35] shadow-xl">
              <SelectItem value="All regions">All regions</SelectItem>{values(routes.filter(route => (continent === "All continents" || route.continent === continent) && (country === "All countries" || route.country === country)), "region").map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-2 text-xs font-bold text-[#6a817a]">Budget
          <Select value={budget} onValueChange={setBudget}>
            <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1300] rounded-xl bg-white text-[#123a35] shadow-xl">
              {["Any budget","Under ₹50k","₹50k–₹1.5L","₹1.5L+"].map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-2 text-xs font-bold text-[#6a817a]">Duration
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1300] rounded-xl bg-white text-[#123a35] shadow-xl">
              {["Any duration","1 week or less","8–10 days","11+ days"].map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-2 text-xs font-bold text-[#6a817a]">Travel style
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1300] rounded-xl bg-white text-[#123a35] shadow-xl">
              {["All styles","Cultural","Food","Nature","Romantic","Adventure","Road trip"].map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div></div>
      <div className="mt-10 flex items-end justify-between gap-5"><div><p className="atlas-label text-[#e6651b]">{source === "supabase" ? "Live catalog" : "Starter catalog"}</p><h2 className="mt-3 font-display text-3xl tracking-[-.05em]">{filtered.length} routes to follow</h2></div><p className="hidden max-w-xs text-right text-sm leading-6 text-[#6b827c] sm:block">Every route is a starting point. Shape it around your dates, budget and pace in TripsForge.</p></div>
      {loading ? <div className="grid min-h-[300px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#e6651b]" /></div> : filtered.length ? <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((route) => <RouteCard key={route.slug} route={route} />)}</div> : <div className="mt-7 rounded-[1.6rem] bg-[#f2eddf] p-10 text-center"><Compass className="mx-auto h-8 w-8 text-[#e6651b]" /><h3 className="mt-4 font-display text-3xl">That combination is still being mapped.</h3><button onClick={reset} className="mt-4 font-bold text-[#e6651b]">See every route</button></div>}
    </div></section>
  </main><SiteFooter /></div>;
}

function RouteCard({ route }: { route: RouteRecord }) {
  return <article className="group overflow-hidden rounded-[1.7rem] border border-[#123a35]/10 bg-white shadow-[0_16px_40px_-32px_rgba(18,58,53,.7)]"><Link href={`/routes/${route.slug}`} className="block"><div className="relative h-64 overflow-hidden"><img src={route.photoUrl} alt={`${route.name} route`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#08221f]/75 via-[#08221f]/10 to-transparent" /><span className="absolute left-4 top-4 rounded-full bg-[#fffdf8]/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-[#123a35]">{route.isSample ? "Sample route" : route.travelCategory}</span><div className="absolute bottom-4 left-4 right-4 text-white"><p className="atlas-label text-[#ffcb75]">{route.country} · {route.region}</p><h3 className="mt-1 font-display text-3xl tracking-[-.05em]">{route.name}</h3></div></div></Link><div className="p-5"><div className="flex items-center gap-2 text-sm font-bold text-[#355b53]"><MapPin className="h-4 w-4 text-[#e6651b]" /> {route.startDestination} <span className="text-[#e6651b]">→</span> {route.endDestination}</div><p className="mt-3 text-sm leading-6 text-[#637e76]">{route.overview}</p><div className="mt-4 flex flex-wrap gap-2">{route.intermediateStops.map((stop) => <span key={stop} className="rounded-full bg-[#f2eddf] px-2.5 py-1 text-xs font-bold text-[#55736b]">{stop}</span>)}</div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#123a35]/10 pt-4 text-xs font-bold text-[#55736b]"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#e6651b]" /> {route.durationDays} days</span><span className="flex items-center gap-1.5"><WalletCards className="h-3.5 w-3.5 text-[#e6651b]" /> {formatRouteBudget(route.budgetMin, route.budgetMax)}</span></div><div className="mt-5 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[.12em] text-[#e6651b]">{route.travelCategory}</span><span className="inline-flex items-center gap-1 text-sm font-black text-[#123a35]">View route <ArrowRight className="h-4 w-4 text-[#e6651b]" /></span></div></div></article>;
}
