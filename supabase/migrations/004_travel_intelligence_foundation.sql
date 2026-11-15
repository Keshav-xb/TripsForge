-- TripsForge travel-intelligence foundation. Run after 003_travel_routes.sql.
-- Provider payloads stay server-owned; user route requests/results are scoped by auth.uid().

create table if not exists public.travel_locations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_reference text not null,
  name text not null,
  formatted_address text not null,
  city text,
  country text,
  country_code text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  types jsonb not null default '[]'::jsonb,
  verification_status text not null default 'provider_verified' check (verification_status in ('provider_verified', 'user_selected', 'stale', 'unverified')),
  retrieved_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  unique (provider, provider_reference)
);

create table if not exists public.travel_route_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin_location_id uuid references public.travel_locations(id),
  destination_location_id uuid references public.travel_locations(id),
  stops jsonb not null default '[]'::jsonb,
  mode text not null check (mode in ('driving', 'walking', 'bicycling')),
  alternatives boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.travel_route_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.travel_route_requests(id) on delete cascade,
  provider text not null,
  provider_status text not null,
  distance_meters integer check (distance_meters >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  geometry jsonb,
  legs jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  retrieved_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  error_code text,
  error_message text
);

create table if not exists public.provider_observations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  endpoint text not null,
  request_hash text not null,
  response_status integer,
  payload jsonb,
  error_code text,
  latency_ms integer,
  retrieved_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz
);

create index if not exists travel_locations_lookup_idx on public.travel_locations (provider, provider_reference);
create index if not exists travel_route_requests_user_idx on public.travel_route_requests (user_id, updated_at desc);
create index if not exists travel_route_results_request_idx on public.travel_route_results (request_id, retrieved_at desc);
create index if not exists provider_observations_lookup_idx on public.provider_observations (provider, endpoint, request_hash, retrieved_at desc);

alter table public.travel_route_requests enable row level security;
alter table public.travel_route_results enable row level security;
revoke all on table public.travel_route_requests from anon, authenticated;
revoke all on table public.travel_route_results from anon, authenticated;
grant select, insert, update, delete on table public.travel_route_requests to authenticated;
grant select, insert, update, delete on table public.travel_route_results to authenticated;

drop policy if exists "Users can manage their route requests" on public.travel_route_requests;
create policy "Users can manage their route requests" on public.travel_route_requests for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their route results" on public.travel_route_results;
create policy "Users can read their route results" on public.travel_route_results for select to authenticated using (exists (select 1 from public.travel_route_requests r where r.id = request_id and r.user_id = (select auth.uid())));
