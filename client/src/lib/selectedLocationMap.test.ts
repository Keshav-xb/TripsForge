import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INDIAN_DESTINATIONS } from "@/lib/tripData";

describe("selected destination map", () => {
  it("provides coordinates for every destination option", () => {
    expect(INDIAN_DESTINATIONS).toHaveLength(7);
    for (const destination of INDIAN_DESTINATIONS) {
      expect(destination.location.lat).toBeGreaterThan(-90);
      expect(destination.location.lat).toBeLessThan(90);
      expect(destination.location.lng).toBeGreaterThan(-180);
      expect(destination.location.lng).toBeLessThan(180);
    }
  });

  it("renders the selected destination with OpenStreetMap without an API key", () => {
    const planner = readFileSync(resolve(process.cwd(), "client/src/pages/Planner.tsx"), "utf8");
    const map = readFileSync(resolve(process.cwd(), "client/src/components/SelectedLocationMap.tsx"), "utf8");
    const loader = readFileSync(resolve(process.cwd(), "client/src/components/Map.tsx"), "utf8");

    expect(planner).toContain("<SelectedLocationMap key={selectedDestination.name} destination={selectedDestination} />");
    expect(map).toContain("<MapView");
    expect(map).toContain("initialCenter={destination.location}");
    expect(loader).toContain("www.openstreetmap.org/export/embed.html");
    expect(loader).not.toContain("GOOGLE_MAPS_API_KEY");
  });
});
