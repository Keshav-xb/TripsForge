import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(resolve(process.cwd(), "client/src/components/LiveRouteMap.tsx"), "utf8");

describe("map place discovery", () => {
  it("loads nearby Places results with search and category filters", () => {
    expect(mapSource).toContain("PlacesService");
    expect(mapSource).toContain("nearbySearch");
    expect(mapSource).toContain("textSearch");
    expect(mapSource).toContain("Find places in");
    expect(mapSource).toContain("restaurant");
    expect(mapSource).toContain("shopping_mall");
    expect(mapSource).toContain("tourist_attraction");
  });

  it("keeps place results connected to map markers and focused details", () => {
    expect(mapSource).toContain("AdvancedMarkerElement");
    expect(mapSource).toContain("setSelectedPlace(place)");
    expect(mapSource).toContain("map.panTo(place.geometry!.location!)");
    expect(mapSource).toContain("aria-label=\"Search places\"");
    expect(mapSource).toContain("aria-label=\"Close place details\"");
  });
});
