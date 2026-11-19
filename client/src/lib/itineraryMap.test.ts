import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(resolve(process.cwd(), "client/src/components/LiveRouteMap.tsx"), "utf8");
const sharedMapSource = readFileSync(resolve(process.cwd(), "client/src/components/Map.tsx"), "utf8");

describe("itinerary map", () => {
  it("uses the shared Leaflet/OpenStreetMap view for generated routes", () => {
    expect(mapSource).toContain('import { MapView, type MapMarker } from "@/components/Map"');
    expect(mapSource).toContain("<MapView");
    expect(sharedMapSource).toContain("tile.openstreetmap.org");
    expect(mapSource).not.toContain("google.maps");
    expect(mapSource).not.toContain("Maps JavaScript API");
  });
});
