import { useMemo, useState } from "react";
import { AlertCircle, ArrowLeftRight, CalendarDays, Clock3, Luggage, Plane, Search, SlidersHorizontal, Users } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

type FlightOffer = {
  id: string; amount: string; currency: string; owner: string; totalDurationMinutes?: number; connectionNote?: string;
  priceDisplay?: { originalAmount: string; originalCurrency: string; displayAmount?: string; displayCurrency: string; rateSource?: string; conversionStatus: string };
  segments: Array<{ from: string; to: string; departure: string; arrival: string; carrier: string; marketingCarrier?: string; flightNumber?: string; duration?: string; baggage?: string[] }>;
};
type SearchResult = { status: string; provider?: string; environment?: "test" | "live" | "unknown"; originCode?: string; destinationCode?: string; totalOffersReturned?: number; hasMoreOffers?: boolean; offers: FlightOffer[]; message?: string; displayCurrency?: string };
const today = new Date().toISOString().slice(0, 10);
const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD"];
const initialSearch = new URLSearchParams(window.location.search);
const formatPrice = (amount: string, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
type FlightSort = "recommended" | "cheapest" | "fastest";
const durationMinutes = (offer: FlightOffer) => offer.totalDurationMinutes ?? offer.segments.reduce((sum, segment) => {
  const match = segment.duration?.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/i);
  return sum + (match ? Number(match[1] || 0) * 60 + Number(match[2] || 0) : 0);
}, 0);
const numericPrice = (offer: FlightOffer) => Number(offer.priceDisplay?.displayAmount ?? offer.amount);
const layoverMinutes = (offer: FlightOffer, index: number) => {
  const arrival = new Date(offer.segments[index]?.arrival).getTime();
  const departure = new Date(offer.segments[index + 1]?.departure).getTime();
  return Number.isFinite(arrival) && Number.isFinite(departure) ? Math.max(0, Math.round((departure - arrival) / 60000)) : undefined;
};
const formatLayover = (minutes?: number) => minutes === undefined ? "Layover duration unavailable" : minutes < 60 ? `${minutes}m layover` : `${Math.floor(minutes / 60)}h ${minutes % 60}m layover`;
const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
};
const formatDuration = (value?: string | number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const hours = Math.floor(value / 60), minutes = value % 60;
    return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""].filter(Boolean).join(" ") || "0m";
  }
  if (!value) return undefined;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!match) return value;
  const hours = Number(match[1] || 0), minutes = Number(match[2] || 0);
  return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""].filter(Boolean).join(" ") || "0m";
};

export default function Flights() {
  const [origin, setOrigin] = useState(initialSearch.get("origin") ?? "");
  const [destination, setDestination] = useState(initialSearch.get("destination") ?? "");
  const [departureDate, setDepartureDate] = useState(initialSearch.get("departureDate") ?? "");
  const [adults, setAdults] = useState(Math.max(1, Math.min(9, Number(initialSearch.get("adults")) || 1)));
  const [currency, setCurrency] = useState(currencies.includes(initialSearch.get("currency") ?? "") ? initialSearch.get("currency")! : "INR");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<FlightSort>("recommended");
  const sortedOffers = useMemo(() => {
    if (!result?.offers) return [];
    const offers = [...result.offers];
    if (sort === "cheapest") return offers.sort((a, b) => numericPrice(a) - numericPrice(b));
    if (sort === "fastest") return offers.sort((a, b) => durationMinutes(a) - durationMinutes(b));
    const prices = offers.map(numericPrice), durations = offers.map(durationMinutes);
    const minPrice = Math.min(...prices), maxPrice = Math.max(...prices), minDuration = Math.min(...durations), maxDuration = Math.max(...durations);
    const score = (offer: FlightOffer) => {
      const priceScore = maxPrice === minPrice ? 0 : (numericPrice(offer) - minPrice) / (maxPrice - minPrice);
      const timeScore = maxDuration === minDuration ? 0 : (durationMinutes(offer) - minDuration) / (maxDuration - minDuration);
      return priceScore * 0.45 + timeScore * 0.45 + Math.max(0, offer.segments.length - 1) * 0.1;
    };
    return offers.sort((a, b) => score(a) - score(b));
  }, [result, sort]);
  const search = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setResult(null); setLoading(true);
    try {
      const input = { origin, destination, departureDate, adults, currency };
      const response = await fetch(`/api/trpc/flights.search?input=${encodeURIComponent(JSON.stringify({ json: input }))}`);
      const body = await response.json();
      const data = body.result?.data?.json as SearchResult | undefined;
      if (!response.ok || !data) throw new Error(body.error?.json?.message || "Flight search failed. Please try again.");
      setResult(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Flight search could not be completed."); }
    finally { setLoading(false); }
  };
  return <div className="min-h-screen bg-[#f7f2e7] text-[#123a35]">
    <SiteHeader />
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full bg-[#e9eee7] px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[#45645b]"><Plane className="h-4 w-4" /> TripsForge Flights</p>
        <h1 className="mt-5 font-display text-4xl leading-tight tracking-tight sm:text-6xl">Compare flights for your journey.</h1>
        {origin.trim() && destination.trim() && <p className="mx-auto mt-3 text-sm font-semibold text-[#45645b]">From {origin} to {destination}</p>}
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#637e76]">Start with your route and date. We’ll show supplier-returned options and clearly label what is live, estimated, or unavailable. TripsForge does not book or ticket flights yet.</p>
      </div>
      <form onSubmit={search} className="mx-auto mt-9 max-w-4xl rounded-[2rem] border border-[#123a35]/10 bg-[#fffdf8] p-5 shadow-[0_18px_60px_rgba(18,58,53,.08)] sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">From<input required minLength={2} maxLength={180} value={origin} onChange={e => setOrigin(e.target.value)} placeholder="e.g. Jammu" className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3.5 font-medium outline-none focus:border-[#e6651b]" /></label>
          <label className="grid gap-2 text-sm font-bold">To<input required minLength={2} maxLength={180} value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Delhi" className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3.5 font-medium outline-none focus:border-[#e6651b]" /></label>
          <label className="grid gap-2 text-sm font-bold"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#e6651b]" /> Departure</span><input required type="date" min={today} value={departureDate} onChange={e => setDepartureDate(e.target.value)} className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3.5 font-medium" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2 text-sm font-bold"><span className="flex items-center gap-2"><Users className="h-4 w-4 text-[#e6651b]" /> Adults</span><input type="number" min="1" max="9" value={adults} onChange={e => setAdults(Math.max(1, Math.min(9, Number(e.target.value) || 1)))} className="rounded-xl border border-[#123a35]/15 bg-white px-4 py-3.5 font-medium" /></label>
            <label className="grid gap-2 text-sm font-bold">Currency<select value={currency} onChange={e => setCurrency(e.target.value)} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-3.5 font-medium">{currencies.map(code => <option key={code}>{code}</option>)}</select></label>
          </div>
        </div>
        <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#123a35] px-5 py-4 font-bold text-white transition hover:bg-[#1d514a] disabled:opacity-60"><Search className="h-5 w-5" />{loading ? "Searching available offers…" : "Search flights"}</button>
        {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      </form>
      {result && <section className="mx-auto mt-8 max-w-4xl space-y-5">
        {result.environment === "live" && <div className="flex items-start gap-3 rounded-2xl border border-[#c9dfd1] bg-[#edf5ef] p-4 text-sm leading-6 text-[#45645b]"><span className="mt-0.5 rounded-full bg-white p-1.5"><Plane className="h-4 w-4" /></span><div><strong className="block text-[#123a35]">Results retrieved from Google Flights</strong><span>Prices and availability can change. TripsForge is for viewing and comparing flights. No booking has been made.</span></div></div>}
        {result.status === "provider_not_configured" && <div className="rounded-xl bg-[#fff0df] p-4 text-sm text-[#8b542d]">Flight search is not configured for this Preview deployment yet. Add `SERPAPI_API_KEY` to the Vercel Preview environment for this branch, then redeploy.</div>}
        {result.status === "no_offers" && <div className="rounded-[1.6rem] border border-[#ead9c8] bg-[#fffaf3] p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="rounded-xl bg-[#fff0df] p-2 text-[#a9571d]"><AlertCircle className="h-5 w-5" /></span><div><h3 className="text-lg font-extrabold text-[#123a35]">We couldn't build a verified flight journey for this date</h3><p className="mt-1 text-sm leading-6 text-[#637e76]">We checked {result.originCode} to {result.destinationCode}, then looked for separate connecting flights through major hubs. We couldn't verify both legs with a safe connection window, so we won't show guessed routes or prices.</p></div></div>
          <div className="mt-4 rounded-xl bg-white/80 p-3 text-xs leading-5 text-[#71857e]"><strong className="block text-[#45645b]">What you can try</strong>Choose another date, search from a nearby airport, or check the route in separate stages. Any connection shown by TripsForge must be supported by actual flight results for both legs.</div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.12em] text-[#87958f]">Try a nearby departure date</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([-1, 1] as const).map(offset => {
              const date = new Date(departureDate + "T12:00:00");
              date.setDate(date.getDate() + offset);
              const value = date.toISOString().slice(0, 10);
              const label = offset < 0 ? "Previous day" : "Next day";
              return <button key={offset} type="button" disabled={value < today} onClick={() => { setDepartureDate(value); setError(""); }} className="rounded-xl border border-[#123a35]/15 bg-white px-3 py-3 text-sm font-bold text-[#123a35] transition hover:border-[#e6651b] disabled:opacity-40">{label}<span className="mt-1 block text-xs font-medium text-[#87958f]">{new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date)}</span></button>;
            })}
          </div>
          <p className="mt-3 text-xs text-[#87958f]">Change the date above, then tap Search flights to check again. You can also try a nearby airport or a different date.</p>
        </div>}
        {result.status === "offers_found" && <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#e6651b]">Your flight shortlist</p><h2 className="mt-1 font-display text-3xl">Compare your options</h2><p className="mt-1 text-sm text-[#71857e]">{result.originCode} <ArrowLeftRight className="mx-1 inline h-3 w-3" /> {result.destinationCode} · {result.offers.length} options found</p></div>
            <span className="rounded-full bg-[#e9eee7] px-3 py-1.5 text-xs font-bold text-[#45645b]">View only · No booking</span>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#123a35]/10 bg-[#fffdf8] p-2 shadow-sm">
            {([{id:"recommended",label:"Best overall",hint:"Balanced"},{id:"cheapest",label:"Cheapest",hint:"Lowest price"},{id:"fastest",label:"Fastest",hint:"Shortest trip"}] as const).map(option => <button key={option.id} type="button" onClick={() => setSort(option.id)} aria-pressed={sort === option.id} className={`rounded-xl px-2 py-3 text-center transition ${sort === option.id ? "bg-[#123a35] text-white shadow-sm" : "text-[#637e76] hover:bg-[#f1f4ee]"}`}><span className="block text-xs font-bold sm:text-sm">{option.label}</span><span className={`mt-1 block text-[10px] sm:text-xs ${sort === option.id ? "text-white/70" : "text-[#87958f]"}`}>{option.hint}</span></button>)}
          </div>
          <div className="space-y-4">{sortedOffers.map((offer, index) => {
            const stops = Math.max(0, offer.segments.length - 1);
            const price = offer.priceDisplay?.displayAmount ? formatPrice(offer.priceDisplay.displayAmount, offer.priceDisplay.displayCurrency) : formatPrice(offer.amount, offer.currency);
            const total = durationMinutes(offer);
            const isTop = index === 0;
            return <article key={offer.id} className={`overflow-hidden rounded-[1.6rem] border bg-[#fffdf8] shadow-[0_10px_35px_rgba(18,58,53,.06)] ${isTop && sort === "recommended" ? "border-[#e6651b]/50 ring-1 ring-[#e6651b]/15" : "border-[#123a35]/10"}`}>
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">{isTop && <span className="rounded-full bg-[#fff0df] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#a9571d]">{sort === "recommended" ? "Best overall" : sort === "cheapest" ? "Lowest price" : "Shortest journey"}</span>}<span className="rounded-full bg-[#e9eee7] px-3 py-1 text-[11px] font-bold text-[#45645b]">{stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`}</span></div>
                    <h3 className="mt-3 text-lg font-extrabold text-[#123a35]">{offer.segments[0]?.carrier || "Airline details unavailable"}</h3>
                    <p className="mt-1 text-xs text-[#87958f]">Via Google Flights · {offer.owner}</p>
                  </div>
                  <div className="text-right"><p className="text-2xl font-black tracking-tight text-[#123a35] sm:text-3xl">{price}</p><p className="mt-1 text-[11px] text-[#87958f]">Total shown by provider</p></div>
                </div>
                {offer.connectionNote && <div className="mt-4 rounded-xl border border-[#e9cda9] bg-[#fff6e9] p-3 text-xs leading-5 text-[#85551f]"><strong className="block text-sm">Suggested connection</strong>{offer.connectionNote}</div>}
                <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-[#f3f5ef] p-4">
                  <div><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#87958f]"><Clock3 className="h-3.5 w-3.5" /> Total journey</p><p className="mt-1 text-lg font-extrabold text-[#123a35]">{formatDuration(total) || "Not supplied"}</p></div>
                  <div><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#87958f]"><Luggage className="h-3.5 w-3.5" /> Stops</p><p className="mt-1 text-lg font-extrabold text-[#123a35]">{stops === 0 ? "Direct" : stops}</p></div>
                </div>
                <div className="mt-5 space-y-0">{offer.segments.map((segment, segmentIndex) => <div key={segmentIndex}>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="min-w-0"><p className="text-lg font-extrabold text-[#123a35]">{dateTime(segment.departure).split(", ").slice(-1)[0]}</p><p className="truncate text-xs font-semibold text-[#637e76]">{segment.from}</p><p className="mt-1 text-[11px] text-[#87958f]">{dateTime(segment.departure)}</p></div>
                    <div className="flex min-w-[74px] flex-col items-center text-[#87958f]"><span className="text-[10px] font-bold">{formatDuration(segment.duration) || "Flight"}</span><div className="relative my-2 h-px w-full bg-[#cbd6ce]"><Plane className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-90 bg-[#fffdf8] px-0.5 text-[#e6651b]" /></div><span className="text-[10px]">Flight {segment.flightNumber || ""}</span></div>
                    <div className="min-w-0 text-right"><p className="text-lg font-extrabold text-[#123a35]">{dateTime(segment.arrival).split(", ").slice(-1)[0]}</p><p className="truncate text-xs font-semibold text-[#637e76]">{segment.to}</p><p className="mt-1 text-[11px] text-[#87958f]">{dateTime(segment.arrival)}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#dce3dc] py-3 text-xs text-[#71857e]"><span className="font-semibold">{segment.carrier}{segment.flightNumber ? ` · ${segment.flightNumber}` : ""}</span>{segment.baggage?.length ? <span>{segment.baggage.join(" · ")}</span> : <span>Baggage details not supplied</span>}</div>
                  {segmentIndex < offer.segments.length - 1 && <div className="mb-3 flex items-center gap-2 rounded-lg bg-[#fff0df] px-3 py-2 text-xs font-semibold text-[#8b542d]"><Clock3 className="h-3.5 w-3.5" />Change in {segment.to} · {formatLayover(layoverMinutes(offer, segmentIndex))}</div>}
                </div>)}</div>
                {offer.priceDisplay?.conversionStatus === "converted" && <p className="mt-3 text-[11px] text-[#87958f]">Approximate currency conversion from {offer.amount} {offer.currency} · {offer.priceDisplay.rateSource}</p>}
              </div>
              <div className="border-t border-[#123a35]/10 bg-[#f8f8f2] px-5 py-3 text-[11px] leading-5 text-[#87958f]">Prices and availability may change. This is a comparison result, not a booking confirmation.</div>
            </article>;
          })}</div>
          <p className="flex items-start gap-2 text-xs leading-5 text-[#87958f]"><SlidersHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Best overall is a TripsForge ranking based on relative price, total journey time and number of stops among these results. It is not an airline recommendation.</p>
        </>}
      </section>}
      <div className="mx-auto mt-10 max-w-4xl text-center"><p className="text-sm text-[#71857e]">Planning a complete trip instead?</p><a href="/planner" className="mt-2 inline-flex rounded-full border border-[#123a35]/20 px-5 py-2.5 text-sm font-bold hover:bg-white">Open Journey Studio</a></div>
    </main>
    <SiteFooter />
  </div>;
}
