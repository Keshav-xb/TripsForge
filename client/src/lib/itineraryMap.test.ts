import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(resolve(process.cwd(), "client/src/components/LiveRouteMap.tsx"), "utf8");

describe("itinerary map interactivity", () => {
  it("uses the shared interactive MapView for generated routes", () => {
    expect(mapSource).toContain('import { MapView } from "@/components/Map"');
    expect(mapSource).toContain("<MapView");
    expect(mapSource).toContain("onMapReady");
    expect(mapSource).toContain("onMapError");
    expect(mapSource).toContain("pointer-events-none");
    expect(mapSource).not.toContain("<img src={route.mapImage}");
  });

  it("keeps route-stop selection connected to map markers", () => {
    expect(mapSource).toContain('marker.addListener("click", () => onSelect(activity.id))');
    expect(mapSource).toContain("mapRef.current.panTo(selectedActivity.location)");
  });
});
