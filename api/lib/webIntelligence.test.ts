import { afterEach, describe, expect, it, vi } from "vitest";
import { searchWeb } from "./webIntelligence";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TAVILY_API_KEY;
});

describe("web intelligence search", () => {
  it("returns an honest unconfigured state when no provider key exists", async () => {
    const result = await searchWeb("Jammu to Delhi flights", 5);
    expect(result.status).toBe("provider_not_configured");
    expect(result.results).toEqual([]);
    expect(result.message).toContain("No results have been fabricated");
  });

  it("rejects queries that are too short", async () => {
    await expect(searchWeb("  ", 5)).rejects.toThrow("WEB_RESEARCH_QUERY_TOO_SHORT");
  });

  it("normalizes provider results and excludes unsafe URL schemes", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      answer: "Plan a stopover and check road conditions.",
      results: [
        { title: "Airline timetable", url: "https://www.example.com/flights", content: "Published timetable", raw_content: "# Timetable", score: 0.91, published_date: "2026-11-18" },
        { title: "Unsafe", url: "javascript:alert(1)", content: "Ignore this" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchWeb("Jammu to Delhi flights", 5);
    expect(result.status).toBe("results_found");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].sourceDomain).toBe("example.com");
    expect(result.results[0].pageContent).toContain("Timetable");
    expect(result.answer).toContain("check road conditions");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ include_answer: true });
  });

  it("surfaces provider rate limiting instead of returning empty results", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    await expect(searchWeb("Jammu to Delhi flights", 5)).rejects.toThrow("WEB_RESEARCH_PROVIDER_RATE_LIMITED");
  });
});
