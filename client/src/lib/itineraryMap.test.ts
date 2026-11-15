import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(resolve(process.cwd(), "client/src/components/LiveRouteMap.tsx"), "utf8");

describe("itinerary map", () => {
  it("uses the shared OpenStreetMap view for generated routes", () => {
    expect(mapSource).toContain('import { MapView } from "@/components/Map"');
    expect(mapSource).toContain("<MapView");
    expect(mapSource).toContain("OpenStreetMap");
    expect(mapSource).not.toContain("google.maps");
    expect(mapSource).not.toContain("Maps JavaScript API");
  });
});
