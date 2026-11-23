import { describe, expect, it } from "vitest";
import {
  listBusSearchProviders,
  registerBusSearchProvider,
  runBusSearchProvider,
} from "./busSearch";

describe("bus search provider registry", () => {
  it("registers and runs a provider through the shared input contract", async () => {
    const id = "test-provider-contract";
    const input = {
      origin: "Stop A",
      destination: "Stop B",
      travelDate: "2026-12-01",
    };
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

  it("rejects duplicate provider identifiers", () => {
    const id = "test-provider-duplicate";
    registerBusSearchProvider({ id, search: async () => "first" });
    expect(() =>
      registerBusSearchProvider({ id, search: async () => "second" })
    ).toThrow(`BUS_PROVIDER_ALREADY_REGISTERED:${id}`);
  });

  it("fails clearly when a provider is not configured", async () => {
    await expect(
      runBusSearchProvider("missing-provider", {
        origin: "A",
        destination: "B",
        travelDate: "2026-12-01",
      })
    ).rejects.toThrow("BUS_PROVIDER_NOT_REGISTERED:missing-provider");
  });
});
