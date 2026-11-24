import { describe, expect, it } from "vitest";
import { distanceKm, normalizeGateways } from "./gatewayDiscovery";

describe("transport gateway discovery", () => {
  it("calculates geographic distance in kilometres", () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.2, 0);
  });

  it("normalizes airport, rail, bus and ferry gateways without assuming services", () => {
    const results = normalizeGateways([
      { type: "node", id: 1, lat: 0.1, lon: 0.1, tags: { name: "Regional Airport", aeroway: "aerodrome", iata: "ABC" } },
      { type: "node", id: 2, lat: 0.2, lon: 0.1, tags: { name: "Central Station", railway: "station", ref: "XYZ" } },
      { type: "node", id: 3, lat: 0.3, lon: 0.1, tags: { name: "Bus Terminal", amenity: "bus_station" } },
      { type: "node", id: 4, lat: 0.4, lon: 0.1, tags: { name: "Ferry Pier", amenity: "ferry_terminal" } },
    ], { lat: 0, lng: 0 }, 100);
    expect(results.map(item => item.mode)).toEqual(["flight", "train", "bus", "ferry"]);
    expect(results[0].iataCode).toBe("ABC");
    expect(results[1].stationCode).toBe("XYZ");
  });

  it("filters unnamed, unclassified and out-of-radius map objects", () => {
    const results = normalizeGateways([
      { type: "node", id: 1, lat: 0.1, lon: 0.1, tags: { aeroway: "aerodrome" } },
      { type: "node", id: 2, lat: 10, lon: 10, tags: { name: "Far Airport", aeroway: "aerodrome" } },
      { type: "node", id: 3, lat: 0.1, lon: 0.1, tags: { name: "Cafe", amenity: "cafe" } },
    ], { lat: 0, lng: 0 }, 20);
    expect(results).toHaveLength(0);
  });

  it("deduplicates repeated OSM objects and sorts by distance", () => {
    const element = { type: "node", id: 9, lat: 0.1, lon: 0.1, tags: { name: "Airport", aeroway: "aerodrome" } };
    const results = normalizeGateways([element, element], { lat: 0, lng: 0 }, 100);
    expect(results).toHaveLength(1);
  });
});
