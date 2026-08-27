import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

describe("Supabase saved-trip access boundaries", () => {
  it("denies anonymous saved-trip reads while exposing only the public-share RPC", async () => {
    expect(supabaseUrl).toMatch(/^https:\/\//);
    expect(publishableKey).toBeTruthy();

    const headers = { apikey: publishableKey! };
    const [privateTrips, sharedTrip] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/saved_trips?select=id&limit=1`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/rpc/get_shared_trip?trip_share_code=verification-route-not-found`, { headers }),
    ]);

    expect(privateTrips.status).toBe(401);
    expect(sharedTrip.status).toBe(200);
  });
});
