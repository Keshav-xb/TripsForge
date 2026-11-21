import { useState } from "react";
import { AlertCircle, ArrowLeftRight, CalendarDays, Plane, Search, Users } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

type FlightOffer = {
  id: string; amount: string; currency: string; owner: string;
  priceDisplay?: { originalAmount: string; originalCurrency: string; displayAmount?: string; displayCurrency: string; rateSource?: string; conversionStatus: string };
  segments: Array<{ from: string; to: string; departure: string; arrival: string; carrier: string; marketingCarrier?: string; flightNumber?: string; duration?: string; baggage?: string[] }>;
};
type SearchResult = { status: string; provider?: string; environment?: "test" | "live" | "unknown"; originCode?: string; destinationCode?: string; totalOffersReturned?: number; hasMoreOffers?: boolean; offers: FlightOffer[]; message?: string; displayCurrency?: string };
const today = new Date().toISOString().slice(0, 10);
const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD"];
const initialSearch = new URLSearchParams(window.location.search);
const formatPrice = (amount: string, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
const formatDuration = (value?: string) => {
  if (!value) return undefined;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!match) return undefined;
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
      {result && <section className="mx-auto mt-8 max-w-4xl space-y-4">
        {result.environment === "test" && <div className="rounded-xl bg-[#fff0df] p-4 text-sm leading-6 text-[#8b542d]"><strong>Duffel test environment.</strong> These are sandbox offers only, not real purchasable tickets.</div>}
        {result.environment === "live" && <div className="rounded-xl bg-[#edf5ef] p-4 text-sm leading-6 text-[#45645b]"><strong>Flight results retrieved from Google Flights.</strong> Prices and availability can change. No booking has been made.</div>}
        {result.status === "provider_not_configured" && <div className="rounded-xl bg-[#fff0df] p-4 text-sm text-[#8b542d]">Flight search is temporarily unavailable. Please try again later.</div>}
        {result.status === "no_offers" && <div className="rounded-xl bg-white p-5 text-sm text-[#637e76]">No offers were returned for {result.originCode} to {result.destinationCode} on this date. This does not prove that no flights operate.</div>}
        {result.status === "offers_found" && <><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-display text-2xl">Flight offers <span className="text-base font-sans font-medium text-[#71857e]">({result.offers.length} shown)</span></h2><p className="mt-1 text-xs text-[#71857e]">Google Flights returned {result.totalOffersReturned ?? result.offers.length} option{(result.totalOffersReturned ?? result.offers.length) === 1 ? "" : "s"}.</p></div><p className="text-sm text-[#71857e]">{result.originCode} <ArrowLeftRight className="mx-1 inline h-3 w-3" /> {result.destinationCode}</p></div>{result.offers.map(offer => <article key={offer.id} className="rounded-2xl border border-[#123a35]/10 bg-[#fffdf8] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-1 text-xs font-semibold text-[#637e76]">{Math.max(0, offer.segments.length - 1)} stop{Math.max(0, offer.segments.length - 1) === 1 ? "" : "s"}</p><p className="text-base font-bold text-[#123a35]">{offer.segments[0]?.carrier || "Airline details unavailable"}</p><p className="mt-1 text-xs text-[#71857e]">Offer provided by {offer.owner}</p><p className="mt-1 text-2xl font-black">{offer.priceDisplay?.displayAmount ? formatPrice(offer.priceDisplay.displayAmount, offer.priceDisplay.displayCurrency) : formatPrice(offer.amount, offer.currency)}</p>{offer.priceDisplay?.conversionStatus === "converted" && <p className="mt-1 text-xs text-[#71857e]">Approx. converted from {offer.amount} {offer.currency} · {offer.priceDisplay.rateSource}</p>}</div><span className="rounded-full bg-[#e9eee7] px-3 py-1 text-xs font-bold text-[#45645b]">Google Flights result</span></div>
          {offer.segments.map((segment, index) => <div key={index} className="mt-4 border-t border-[#123a35]/10 pt-3 text-sm leading-6 text-[#637e76]"><p className="font-bold text-[#123a35]">{segment.carrier}{segment.flightNumber ? ` · ${segment.flightNumber}` : ""}</p>{segment.marketingCarrier && <p className="text-xs text-[#71857e]">Marketing airline: {segment.marketingCarrier}</p>}<p>{segment.from} → {segment.to}</p><p>Depart {new Date(segment.departure).toLocaleString()} · Arrive {new Date(segment.arrival).toLocaleString()}</p>{formatDuration(segment.duration) && <p>Flight time: {formatDuration(segment.duration)}</p>}{index === 0 && offer.totalDurationMinutes ? <p>Total journey time: {formatDuration(offer.totalDurationMinutes)}</p> : null}{segment.baggage?.length ? <p>Baggage: {segment.baggage.join(", ")}</p> : null}</div>)}
          <p className="mt-3 text-xs leading-5 text-[#87958f]">Offer details and price may change. Booking and ticketing are not available in TripsForge yet.</p>
        </article>)}</>}
      </section>}
      <div className="mx-auto mt-10 max-w-4xl text-center"><p className="text-sm text-[#71857e]">Planning a complete trip instead?</p><a href="/planner" className="mt-2 inline-flex rounded-full border border-[#123a35]/20 px-5 py-2.5 text-sm font-bold hover:bg-white">Open Journey Studio</a></div>
    </main>
    <SiteFooter />
  </div>;
}
