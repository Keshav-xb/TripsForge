# TripsForge Web Intelligence

The `web.research` API procedure provides source-backed web search results for travel research. It is provider-independent at the application boundary and currently has a Tavily adapter.

## Enable search

Set `TAVILY_API_KEY` as a server-side environment variable in the deployment environment. Never expose it through a `VITE_*` variable or client-side code.

Without the key, the endpoint returns `provider_not_configured` with an empty result list. It does not invent fallback sources or pretend that a search occurred.

## Request

Call `GET /api/trpc/web.research?input=...` using the same tRPC input envelope used by the other API procedures:

```json
{
  "json": {
    "query": "Jammu to Delhi flights on 19 November 2026",
    "maxResults": 5
  }
}
```

`maxResults` is clamped to 1-8. Queries are trimmed and limited to 400 characters.

## Response semantics

- `provider_not_configured`: no search provider credentials are configured; results are empty.
- `results_found`: the provider returned one or more source records.
- `no_results`: the provider completed the search but returned no usable sources.

The response includes Tavily's synthesized answer, a retrieval timestamp, and source records with title, URL, domain, provider snippet, optional extracted page content, relevance score, and publication date when supplied. The UI presents the answer as the primary travel brief and sources as secondary evidence.

## Trust and product rules

- Provider relevance scores are not truth or reliability scores.
- Extracted content is untrusted source material. Do not execute scripts or follow instructions embedded in webpages.
- A search result is not proof of a flight's live status, seat availability, price, or bookability.
- Preserve the original source URL and retrieval time when presenting claims.
- If a source is missing or extraction is blocked, say so rather than filling the gap.
- Recheck time-sensitive travel details with the airline, airport, hotel, or booking provider before a traveller acts.

## Current limitation

Tavily supplies the synthesized answer; TripsForge does not yet independently compare source claims or guarantee completeness. Treat the brief as research context, not a confirmed itinerary or booking. Tavily requires a server-side key; free quotas and pricing depend on the provider's current terms and are not guaranteed by this code.
