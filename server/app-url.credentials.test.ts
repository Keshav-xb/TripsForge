import { describe, expect, it } from "vitest";

describe("canonical application URL", () => {
  it("serves the TripsForge account page used by Supabase email redirects", async () => {
    const appUrl = process.env.VITE_APP_URL;
    expect(appUrl).toMatch(/^https:\/\//);

    const response = await fetch(`${appUrl}/account`);
    expect(response.ok).toBe(true);
  });
});
