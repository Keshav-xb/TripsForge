import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "./trpc/[trpc]";

async function invoke(method: string, url: string) {
  const req = { method, url } as IncomingMessage;
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

const encoded = (value: unknown) => encodeURIComponent(JSON.stringify({ json: value }));

describe("TripsForge API request guardrails", () => {
  it("rejects non-GET methods", async () => {
    const response = await invoke("POST", "/api/trpc/location.search");
    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers OPTIONS preflight without invoking a provider", async () => {
    const response = await invoke("OPTIONS", "/api/trpc/location.search");
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
  });

  it("returns a client error for malformed JSON", async () => {
    const response = await invoke("GET", "/api/trpc/location.search?input=%7B");
    expect(response.status).toBe(400);
    expect(response.body.error.json.message).toBe("INVALID_REQUEST_JSON");
  });

  it("rejects oversized input before parsing", async () => {
    const response = await invoke("GET", `/api/trpc/location.search?input=${"x".repeat(16001)}`);
    expect(response.status).toBe(400);
    expect(response.body.error.json.message).toBe("REQUEST_INPUT_TOO_LARGE");
  });

  it("rejects unknown nearby-place categories instead of silently changing them", async () => {
    const input = encoded({ lat: 32.7, lng: 74.8, category: "hotel" });
    const response = await invoke("GET", `/api/trpc/places.nearby?input=${input}`);
    expect(response.status).toBe(400);
    expect(response.body.error.json.message).toBe("INVALID_PLACE_CATEGORY");
  });

  it("rejects invalid route preview modes before calling a routing provider", async () => {
    const input = encoded({ stops: [{ title: "A" }, { title: "B" }], mode: "teleport" });
    const response = await invoke("GET", `/api/trpc/route.preview?input=${input}`);
    expect(response.status).toBe(400);
    expect(response.body.error.json.message).toBe("INVALID_ROUTE_MODE");
  });
});
