import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiSource = readFileSync(resolve(process.cwd(), "api/trpc/[trpc].ts"), "utf8");
const mapSource = readFileSync(resolve(process.cwd(), "client/src/components/LiveRouteMap.tsx"), "utf8");

describe("automatic itinerary geocoding and routing", () => {
  it("geocodes stops without coordinates using destination context", () => {
    expect(apiSource).toContain('url.searchParams.set("q", query)');
    expect(apiSource).toContain('const query = [stop.title, destination].filter(Boolean).join(", ")');
    expect(apiSource).toContain("resolvedStops: stops");
    expect(apiSource).toContain("UNRESOLVED_STOPS");
  });

  it("uses resolved coordinates for itinerary markers and route geometry", () => {
    expect(mapSource).toContain("route?.resolvedStops");
    expect(mapSource).toContain("const position = resolved?.location ?? activity.location");
    expect(mapSource).toContain("routeGeometry={route?.available ? route.geometry : null}");
  });
});
