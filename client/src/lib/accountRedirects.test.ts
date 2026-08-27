import { describe, expect, it } from "vitest";
import { accountRedirectUrl } from "./accountRedirects";

describe("accountRedirectUrl", () => {
  it("uses the configured public origin for email confirmation redirects", () => {
    const redirect = new URL(accountRedirectUrl({ next: "/trips" }));
    const configured = new URL(import.meta.env.VITE_APP_URL);

    expect(redirect.origin).toBe(configured.origin);
    expect(redirect.pathname).toBe("/account");
    expect(redirect.searchParams.get("next")).toBe("/trips");
  });

  it("preserves the recovery mode in the redirect URL", () => {
    const redirect = new URL(accountRedirectUrl({ mode: "reset" }));

    expect(redirect.pathname).toBe("/account");
    expect(redirect.searchParams.get("mode")).toBe("reset");
  });
});
