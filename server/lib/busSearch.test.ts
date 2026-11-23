import { describe, expect, it } from "vitest";
import {
  discoverBusSearchProviders,
  listBusSearchProviders,
  registerBusSearchProvider,
  runBusSearchProvider,
} from "./busSearch";

const input = {
  origin: "Stop A",
  destination: "Stop B",
  travelDate: "2026-12-01",
};

describe("bus search provider registry", () => {
  it("registers and runs a provider through the shared input contract", async () => {
    const id = "test-provider-contract";
    registerBusSearchProvider({
      id,
      search: async received => ({ provider: id, received }),
    });

    await expect(runBusSearchProvider(id, input)).resolves.toEqual({
      provider: id,
      received: input,
    });
    expect(listBusSearchProviders()).toContain(id);
  });

  it("discovers only compatible providers in priority order", () => {
    const lowPriorityId = "test-provider-discovery-low";
    const highPriorityId = "test-provider-discovery-high";
    const unsupportedId = "test-provider-discovery-unsupported";

    registerBusSearchProvider({
      id: lowPriorityId,
      priority: 1,
      supports: () => true,
      search: async () => "low",
    });
    registerBusSearchProvider({
      id: highPriorityId,
      priority: 10,
      supports: received => received.origin === input.origin,
      search: async () => "high",
    });
    registerBusSearchProvider({
      id: unsupportedId,
      priority: 100,
      supports: () => false,
      search: async () => "unsupported",
    });

    const discovered = discoverBusSearchProviders(input);
    expect(discovered.indexOf(highPriorityId)).toBeLessThan(discovered.indexOf(lowPriorityId));
    expect(discovered).not.toContain(unsupportedId);
  });

  it("rejects running a provider that does not support the request", async () => {
    const id = "test-provider-unsupported-run";
    registerBusSearchProvider({
      id,
      supports: () => false,
      search: async () => "should not run",
    });

    await expect(runBusSearchProvider(id, input)).rejects.toThrow(
      `BUS_PROVIDER_UNSUPPORTED_SEARCH:${id}`
    );
  });

  it("rejects duplicate provider identifiers", () => {
    const id = "test-provider-duplicate";
    registerBusSearchProvider({ id, search: async () => "first" });
    expect(() =>
      registerBusSearchProvider({ id, search: async () => "second" })
    ).toThrow(`BUS_PROVIDER_ALREADY_REGISTERED:${id}`);
  });

  it("fails clearly when a provider is not configured", async () => {
    await expect(
      runBusSearchProvider("missing-provider", input)
    ).rejects.toThrow("BUS_PROVIDER_NOT_REGISTERED:missing-provider");
  });
});
