import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe2, Search } from "lucide-react";

type ResearchSource = {
  title: string;
  url: string;
  snippet: string;
  pageContent: string | null;
  score: number | null;
  publishedAt: string | null;
  sourceDomain: string;
};

type ResearchResponse =
  | { status: "provider_not_configured"; provider: string; query: string; results: []; message: string }
  | { status: "results_found" | "no_results"; provider: string; query: string; answer?: string | null; retrievedAt: string; results: ResearchSource[]; limitations: string[] };

function safeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function WebResearchPanel({ origin, destination, travelDate }: { origin: string; destination: string; travelDate: string }) {
  const suggestedQuery = useMemo(() => [origin, destination].filter(Boolean).join(" to ") + (travelDate ? ` ${travelDate}` : "") + " travel planning advice, route context, highlights and travel conditions", [origin, destination, travelDate]);
  const [query, setQuery] = useState(suggestedQuery);
  const [response, setResponse] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setQuery(suggestedQuery);
    setResponse(null);
    setError("");
  }, [suggestedQuery]);

  async function search() {
    if (query.trim().length < 3 || loading) return;
    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const input = { json: { query: query.trim().slice(0, 400), maxResults: 5 } };
      const result = await fetch(`/api/trpc/web.research?input=${encodeURIComponent(JSON.stringify(input))}`);
      const raw = await result.text();
      let payload: { result?: { data?: { json?: ResearchResponse } }; error?: { json?: { message?: string } } };
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new Error(`Research service returned an unreadable response (HTTP ${result.status}).`);
      }
      const data = payload.result?.data?.json;
      if (!result.ok || !data) throw new Error(payload.error?.json?.message || `Research request failed (HTTP ${result.status}).`);
      setResponse(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Web research could not complete. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return <section aria-labelledby="web-research-heading" className="mt-5 rounded-2xl border border-[#123a35]/10 bg-[#f7f9f5] p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#45645b]"><Globe2 className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#e6651b]">TripsForge intelligence</p>
        <h3 id="web-research-heading" className="mt-1 font-display text-xl">Build a travel brief</h3>
        <p className="mt-1 text-xs leading-5 text-[#71857e]">TripsForge summarizes useful context for your trip. Source websites are supporting evidence, not the itinerary itself.</p>
      </div>
    </div>
    <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); void search(); }}>
      <label className="sr-only" htmlFor="trip-web-research-query">Trip research question</label>
      <input id="trip-web-research-query" value={query} onChange={event => setQuery(event.target.value)} maxLength={400} placeholder="What should TripsForge research for this trip?" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#123a35]/15 bg-white px-3 text-sm text-[#123a35] outline-none focus:border-[#e6651b] focus:ring-2 focus:ring-[#e6651b]/20" />
      <button type="submit" disabled={loading || query.trim().length < 3} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123a35] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"><Search className="h-4 w-4" />{loading ? "Preparing…" : "Build travel brief"}</button>
    </form>
    {loading && <p role="status" aria-live="polite" className="mt-3 text-xs text-[#71857e]">Researching sources and preparing your travel brief…</p>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-[#fff0e5] p-3 text-xs leading-5 text-[#a84b19]">{error}</p>}
    {response?.status === "provider_not_configured" && <div className="mt-4 rounded-xl border border-[#e6d5b8] bg-[#fffaf0] p-3"><p className="text-sm font-bold text-[#8b5b20]">Web search is not connected</p><p className="mt-1 text-xs leading-5 text-[#8b6b42]">{response.message}</p></div>}
    {response?.status === "no_results" && <p className="mt-4 rounded-xl bg-white p-3 text-sm text-[#71857e]">The search provider returned no usable sources for this query.</p>}
    {response?.status === "results_found" && <div className="mt-4 space-y-3">
      <article className="rounded-2xl border border-[#123a35]/10 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#e6651b]">Your TripsForge travel brief</p><p className="text-[10px] text-[#87958f]">Updated {new Date(response.retrievedAt).toLocaleString()}</p></div>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#294d44]">{response.answer?.trim() || "Sources were found, but the search provider did not return a synthesized answer. Check the supporting evidence before making plans."}</p>
        <p className="mt-3 text-[10px] leading-4 text-[#87958f]">Research context only. It does not confirm bookings, live transport schedules, fares or availability.</p>
      </article>
      <details className="rounded-xl border border-[#123a35]/10 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-[#45645b]">{response.results.length} supporting sources · View evidence</summary>
        <div className="space-y-2 border-t border-[#123a35]/8 p-3">
          {response.results.map((source, index) => {
            const href = safeSourceUrl(source.url);
            return <article key={source.url || index} className="rounded-lg bg-[#f7f9f5] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-[#87958f]">{source.sourceDomain}</p><h4 className="mt-1 text-xs font-extrabold leading-5 text-[#123a35]">{source.title}</h4></div>
                {href && <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open source: ${source.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#45645b] hover:bg-[#e8eee6]"><ExternalLink className="h-4 w-4" /></a>}
              </div>
              <p className="mt-2 text-xs leading-5 text-[#637e76]">{source.snippet || "No source summary was provided."}</p>
              {source.publishedAt && <p className="mt-2 text-[10px] text-[#87958f]">Source date: {source.publishedAt}</p>}
              {source.pageContent && <details className="mt-2"><summary className="cursor-pointer text-[11px] font-bold text-[#45645b]">View extracted page text</summary><p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[#71857e]">{source.pageContent}</p></details>}
            </article>;
          })}
        </div>
      </details>
      <p className="text-[10px] leading-4 text-[#87958f]">Web content may be incomplete or outdated. Verify important travel requirements with the original provider.</p>
    </div>}
  </section>;
}
