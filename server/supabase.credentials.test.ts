import { describe, expect, it } from "vitest";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

describe("Supabase project configuration", () => {
  it.skipIf(!url || !key)("accepts the configured publishable key at the Auth settings endpoint", async () => {
    expect(url).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(key).toMatch(/^sb_publishable_/);
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } });
    expect(response.ok).toBe(true);
  });
});
