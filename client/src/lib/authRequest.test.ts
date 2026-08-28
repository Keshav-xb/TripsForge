import { describe, expect, it } from "vitest";
import { withAuthRequestTimeout } from "./authRequest";

describe("withAuthRequestTimeout", () => {
  it("resolves a successful auth request", async () => {
    await expect(withAuthRequestTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("rejects a stalled auth request with a stable error", async () => {
    await expect(withAuthRequestTimeout(new Promise<never>(() => undefined), 5)).rejects.toThrow("AUTH_REQUEST_TIMEOUT");
  });
});
