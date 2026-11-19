import { describe, expect, it } from "vitest";

const appUrl = process.env.VITE_APP_URL;

describe("canonical application URL", () => {
  it.skipIf(!appUrl)("serves the TripsForge account page used by Supabase email redirects", async () => {
    expect(appUrl).toMatch(/^https:\/\//);
    const response = await fetch(`${appUrl}/account`);
    expect(response.ok).toBe(true);
  });
});
