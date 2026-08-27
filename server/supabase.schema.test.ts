import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/001_saved_trips.sql"), "utf8");

describe("TripsForge Supabase saved-trip policy", () => {
  it("enables RLS and scopes every private-trip operation to the authenticated user", () => {
    expect(migration).toContain("alter table public.saved_trips enable row level security");
    expect(migration).toContain("revoke all on table public.saved_trips from anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table public.saved_trips to authenticated");
    expect(migration.match(/\(select auth\.uid\(\)\) = user_id/g)).toHaveLength(5);
  });

  it("exposes shared routes only through an explicit public-share function", () => {
    expect(migration).toContain("create or replace function public.get_shared_trip");
    expect(migration).toContain("st.share_code = trip_share_code and st.is_public = true");
    expect(migration).toContain("grant execute on function public.get_shared_trip(text) to anon, authenticated");
  });
});
