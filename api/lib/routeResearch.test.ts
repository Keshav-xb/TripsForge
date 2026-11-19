import { describe, expect, it } from "vitest";
import { buildRouteResearch } from "./routeResearch";

describe("buildRouteResearch", () => {
  it("does not treat mapped infrastructure as proof of a scheduled service", () => {
    const result = buildRouteResearch({
      origin: "Jammu, India",
      destination: "Paris, France",
      travelDate: "2026-12-10",
      road: { status: "unavailable", provider: "OSRM", reason: "long-distance route not available" },
      infrastructure: [
        { kind: "flight", originCount: 1, destinationCount: 1, originExamples: ["Jammu Airport"], destinationExamples: ["Charles de Gaulle Airport"], checked: true },
        { kind: "train", originCount: 2, destinationCount: 2, originExamples: ["Jammu Tawi"], destinationExamples: ["Gare du Nord"], checked: true },
      ],
      retrievedAt: "2026-11-19T12:00:00.000Z",
    });
    const flight = result.modes.find(mode => mode.mode === "flight")!;
    expect(flight.status).toBe("infrastructure_at_both_ends");
    expect(flight.serviceStatus).toBe("unverified");
    expect(flight.bookingStatus).toBe("not_connected");
  });

  it("does not infer unavailable service from missing map infrastructure", () => {
    const result = buildRouteResearch({
      origin: "A",
      destination: "B",
      travelDate: "2026-12-10",
      road: null,
      infrastructure: [{ kind: "bus", originCount: 0, destinationCount: 0, originExamples: [], destinationExamples: [], checked: true }],
      retrievedAt: "2026-11-19T12:00:00.000Z",
    });
    expect(result.modes.find(mode => mode.mode === "bus")?.status).toBe("no_infrastructure_found");
    expect(result.limitations.join(" ")).toContain("does not prove");
  });

  it("reports road-network route separately from scheduled transport service", () => {
    const result = buildRouteResearch({
      origin: "Jammu",
      destination: "Srinagar",
      travelDate: "2026-12-10",
      road: { status: "route_found", distanceKm: 270, durationMinutes: 360, provider: "OSRM" },
      infrastructure: [],
      retrievedAt: "2026-11-19T12:00:00.000Z",
    });
    const car = result.modes.find(mode => mode.mode === "car")!;
    expect(car.status).toBe("road_route_found");
    expect(car.serviceStatus).toBe("unverified");
  });
});
