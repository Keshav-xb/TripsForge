import { describe, expect, it } from "vitest";
import { selectGateways } from "./gatewayJourneys";
import type { TransportGateway } from "./gatewayDiscovery";

const gateway = (id: string, mode: TransportGateway["mode"], distanceKm: number): TransportGateway => ({
  id, mode, distanceKm, name: id, lat: 0, lng: 0, source: "OpenStreetMap",
});

describe("gateway journey candidate selection", () => {
  it("selects only the two nearest gateways for the requested mode", () => {
    const items = [
      gateway("airport-far", "flight", 90),
      gateway("station-near", "train", 4),
      gateway("airport-near", "flight", 12),
      gateway("airport-mid", "flight", 30),
    ];
    expect(selectGateways(items, "flight").map(item => item.id)).toEqual(["airport-near", "airport-mid"]);
  });

  it("returns fewer than two when only one matching gateway exists", () => {
    expect(selectGateways([gateway("one", "train", 3)], "train").map(item => item.id)).toEqual(["one"]);
  });

  it("returns an empty list when no gateway of that mode exists", () => {
    expect(selectGateways([gateway("airport", "flight", 3)], "train")).toEqual([]);
  });
});
