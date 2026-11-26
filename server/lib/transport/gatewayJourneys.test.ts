import { describe, expect, it } from "vitest";
import { filterGatewaysToCountry, isCrossCountryRoute, isFlightDepartureOnDate, selectGateways } from "./gatewayJourneys";
import type { TransportGateway } from "./gatewayDiscovery";

const gateway = (id: string, mode: TransportGateway["mode"], distanceKm: number): TransportGateway => ({
  id, mode, distanceKm, name: id, lat: 0, lng: 0, source: "OpenStreetMap",
});

describe("gateway journey candidate selection", () => {
  it("returns matching gateways ordered by proximity for the requested mode", () => {
    const items = [
      gateway("airport-far", "flight", 90),
      gateway("station-near", "train", 4),
      gateway("airport-near", "flight", 12),
      gateway("airport-mid", "flight", 30),
    ];
    expect(selectGateways(items, "flight").map(item => item.id)).toEqual(["airport-near", "airport-mid", "airport-far"]);
  });

  it("caps gateway selection at the four nearest matching gateways", () => {
    const items = [
      gateway("g5", "flight", 50),
      gateway("g3", "flight", 30),
      gateway("g1", "flight", 10),
      gateway("g4", "flight", 40),
      gateway("g2", "flight", 20),
    ];
    expect(selectGateways(items, "flight").map(item => item.id)).toEqual(["g1", "g2", "g3", "g4"]);
  });

  it("returns fewer than two when only one matching gateway exists", () => {
    expect(selectGateways([gateway("one", "train", 3)], "train").map(item => item.id)).toEqual(["one"]);
  });

  it("returns an empty list when no gateway of that mode exists", () => {
    expect(selectGateways([gateway("airport", "flight", 3)], "train")).toEqual([]);
  });
});


describe("gateway flight departure date guard", () => {
  it("accepts provider departures on the selected local date", () => {
    expect(isFlightDepartureOnDate("2026-11-27 17:35", "2026-11-27")).toBe(true);
    expect(isFlightDepartureOnDate("2026-11-27T17:35:00", "2026-11-27")).toBe(true);
  });

  it("rejects stale or next-day flight offers outside the selected date", () => {
    expect(isFlightDepartureOnDate("2026-12-25 17:35", "2026-11-27")).toBe(false);
    expect(isFlightDepartureOnDate("2026-11-28 00:15", "2026-11-27")).toBe(false);
    expect(isFlightDepartureOnDate(undefined, "2026-11-27")).toBe(false);
  });
});


describe("gateway mode feasibility by country", () => {
  it("identifies international routes from resolved location labels", () => {
    expect(isCrossCountryRoute("Jammu, Jammu and Kashmir, India", "Miami, Florida, United States")).toBe(true);
  });

  it("keeps local transport eligible for domestic routes", () => {
    expect(isCrossCountryRoute("Jammu, Jammu and Kashmir, India", "Delhi, India")).toBe(false);
  });

  it("does not infer a country when labels are incomplete", () => {
    expect(isCrossCountryRoute("Jammu", "Delhi")).toBe(false);
  });
});


describe("gateway country filtering", () => {
  it("rejects cross-border and unknown-country gateways when endpoint country is known", () => {
    const items = [
      { ...gateway("jammu", "flight", 5), countryCode: "IN" },
      { ...gateway("sialkot", "flight", 18), countryCode: "PK" },
      gateway("unknown-country", "flight", 2),
    ];
    expect(filterGatewaysToCountry(items, "IN").map(item => item.id)).toEqual(["jammu"]);
  });

  it("does not apply a country filter when the endpoint country is unknown", () => {
    const items = [gateway("unknown", "flight", 1)];
    expect(filterGatewaysToCountry(items).map(item => item.id)).toEqual(["unknown"]);
  });
});
