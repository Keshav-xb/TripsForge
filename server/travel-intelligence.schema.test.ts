import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

describe("TripsForge travel-intelligence database boundaries", () => {
  it("keeps provider-owned location and raw observation records server-only", () => {
    const sql = migration("007_lock_down_provider_data.sql");

    for (const table of ["travel_locations", "provider_observations"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from anon, authenticated`);
      expect(sql).toContain(`grant all on table public.${table} to service_role`);
    }

    expect(sql.toLowerCase()).not.toContain("create policy");
  });

  it("scopes route requests to their owner and route results to the request owner", () => {
    const sql = migration("004_travel_intelligence_foundation.sql");

    expect(sql).toContain("alter table public.travel_route_requests enable row level security");
    expect(sql).toContain("alter table public.travel_route_results enable row level security");
    expect(sql).toContain("(select auth.uid()) = user_id");
    expect(sql).toContain("r.user_id = (select auth.uid())");
  });

  it("keeps invitation records unavailable to direct client roles", () => {
    const sql = migration("005_trip_workspace.sql");
    expect(sql).toContain("alter table public.trip_invitations enable row level security");
    expect(sql).toContain("grant all on public.trip_invitations to service_role");
    expect(sql).toContain("trip_invitations has RLS enabled and no client grants/policies by design");
  });
});
