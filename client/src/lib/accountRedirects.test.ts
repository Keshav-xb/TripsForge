import { describe, expect, it } from "vitest";
import { accountRedirectUrl } from "./accountRedirects";

describe("accountRedirectUrl", () => {
  it("uses the safe server-side fallback when no public app URL is configured", () => {
    const redirect = new URL(accountRedirectUrl({ next: "/trips" }));
    expect(redirect.origin).toBe("http://localhost:3000");
    expect(redirect.pathname).toBe("/account");
    expect(redirect.searchParams.get("next")).toBe("/trips");
  });

  it("preserves the recovery mode in the redirect URL", () => {
    const redirect = new URL(accountRedirectUrl({ mode: "reset" }));
    expect(redirect.pathname).toBe("/account");
    expect(redirect.searchParams.get("mode")).toBe("reset");
  });
});
