-- TripsForge Migration 007: lock down server-owned travel intelligence data.
-- Provider observations can contain raw provider payloads and must never be
-- directly exposed through the public Supabase client. Location records are
-- maintained by trusted server-side ingestion and route services.

alter table public.travel_locations enable row level security;
alter table public.provider_observations enable row level security;

revoke all on table public.travel_locations from anon, authenticated;
revoke all on table public.provider_observations from anon, authenticated;

grant all on table public.travel_locations to service_role;
grant all on table public.provider_observations to service_role;

-- Intentionally no anon/authenticated policies. Access is server-only.
