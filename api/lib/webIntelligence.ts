export type WebResearchResult = {
  title: string;
  url: string;
  snippet: string;
  pageContent: string | null;
  score: number | null;
  publishedAt: string | null;
  sourceDomain: string;
};

export type WebResearchResponse =
  | {
      status: "provider_not_configured";
      provider: "Tavily";
      query: string;
      results: [];
      message: string;
    }
  | {
      status: "results_found" | "no_results";
      provider: "Tavily";
      query: string;
      answer: string | null;
      retrievedAt: string;
      results: WebResearchResult[];
      limitations: string[];
    };

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
  published_date?: string | null;
};

function safeDomain(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.username || parsed.password) return null;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || host === "::1") return null;
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function searchWeb(queryValue: unknown, maxResultsValue: unknown): Promise<WebResearchResponse> {
  const query = String(queryValue ?? "").trim().slice(0, 400);
  if (query.length < 3) throw new Error("WEB_RESEARCH_QUERY_TOO_SHORT");

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      status: "provider_not_configured",
      provider: "Tavily",
      query,
      results: [],
      message: "Web search is not connected yet. Configure TAVILY_API_KEY on the server to enable source-backed research. No results have been fabricated.",
    };
  }

  const maxResults = Math.min(8, Math.max(1, Math.floor(Number(maxResultsValue) || 5)));
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      topic: "general",
      max_results: maxResults,
      include_answer: true,
      include_raw_content: "markdown",
      include_images: false,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("WEB_RESEARCH_PROVIDER_AUTH_FAILED");
    if (response.status === 429) throw new Error("WEB_RESEARCH_PROVIDER_RATE_LIMITED");
    throw new Error(`WEB_RESEARCH_PROVIDER_HTTP_${response.status}`);
  }

  const payload = await response.json() as { answer?: string | null; results?: TavilyResult[] };
  const results = (payload.results ?? []).flatMap(item => {
    const url = String(item.url ?? "");
    const sourceDomain = safeDomain(url);
    if (!sourceDomain) return [];
    const pageContent = String(item.raw_content ?? "").trim().slice(0, 12000) || null;
    const snippet = String(item.content ?? "").trim().slice(0, 1600);
    return [{
      title: String(item.title ?? sourceDomain).slice(0, 300),
      url,
      snippet,
      pageContent,
      score: Number.isFinite(item.score) ? Number(item.score) : null,
      publishedAt: item.published_date ?? null,
      sourceDomain,
    }];
  });

  return {
    status: results.length ? "results_found" : "no_results",
    provider: "Tavily",
    query,
    retrievedAt: new Date().toISOString(),
    results,
    limitations: [
      "Search ranking and extracted page content are supplied by the search provider, not independently verified by TripsForge.",
      "A result's publication date may be missing or may describe an updated page rather than the original publication.",
      "Search results do not prove real-time availability, operating status, or bookability. Recheck critical travel details with the original provider.",
      "Some websites block extraction or expose only partial page content.",
    ],
  };
}
