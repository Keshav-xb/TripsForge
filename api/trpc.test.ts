import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "./[trpc]";

async function invoke(method: string, path: string, input?: unknown) {
  const query = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const req = { method, url: `/api/trpc/${path}${query}` } as IncomingMessage;
  const headers = new Map<string, string | number>();
  let body = "";
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number) { headers.set(name.toLowerCase(), value); return this; },
    end(value?: string) { body = value ?? ""; return this; },
  } as unknown as ServerResponse;
  await handler(req, res);
  return { status: res.statusCode, headers, body: body ? JSON.parse(body) : null };
}

describe("TripsForge API request guardrails", () => {
  it("rejects methods other than GET", async () => {
    const response = await invoke("POST", "location.search", { query: "Jammu" });
    expect(response.status).toBe(405);
    expect(response.body.error.json.message).toBe("METHOD_NOT_ALLOWED");
  });

  it("rejects unsupported nearby-place categories instead of silently searching hospitals", async () => {
    const response = await invoke("GET", "places.nearby", { lat: 32.7, lng: 74.8, category: "nightlife" });
    expect(response.status).toBe(400);
    expect(response.body.error.json.message).toBe("INVALID_PLACE_CATEGORY");
  });

  it("rejects unsupported route modes before calling a routing provider", async () => {
    const response = await invoke("GET", "route.preview", {
      mode: "flying",
      stops: [{ title: "Jammu", location: { lat: 32.7, lng: 74.8 } }, { title: "Delhi", location: { lat: 28.6, lng: 77.2 } }],
    });
    expect(response.status).toBe(400);
    expect(response.body.error.json.message).toBe("INVALID_ROUTE_MODE");
  });

  it("rejects route requests with too many stops", async () => {
    const stops = Array.from({ length: 21 }, (_, index) => ({ title: `Stop ${index}`, location: { lat: 32, lng: 74 } }));
    const response = await invoke("GET", "route.preview", { stops });
    expect(response.status).toBe(400);
    expect(response.body.error.json.message).toBe("ROUTE_TOO_MANY_STOPS");
  });

  it("marks dynamic API responses as non-cacheable by browsers and shared proxies", async () => {
    const response = await invoke("POST", "places.nearby", { lat: 32.7, lng: 74.8, category: "attraction" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
