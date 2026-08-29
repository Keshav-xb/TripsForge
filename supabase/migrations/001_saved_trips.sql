create table if not exists public.saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  destination text not null check (char_length(destination) between 2 and 120),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  traveler_count integer not null check (traveler_count between 1 and 20),
  budget integer not null check (budget >= 0),
  itinerary_json jsonb not null,
  share_code text not null unique,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists saved_trips_user_id_updated_at_idx on public.saved_trips (user_id, updated_at desc);
create index if not exists saved_trips_share_code_idx on public.saved_trips (share_code);

create or replace function public.set_saved_trips_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = timezone('utc', now()); return new; end; $$;
drop trigger if exists saved_trips_updated_at on public.saved_trips;
create trigger saved_trips_updated_at before update on public.saved_trips for each row execute procedure public.set_saved_trips_updated_at();

alter table public.saved_trips enable row level security;
revoke all on table public.saved_trips from anon, authenticated;
grant select, insert, update, delete on table public.saved_trips to authenticated;

create policy "TripsForge users can read their own trips" on public.saved_trips for select to authenticated using ((select auth.uid()) = user_id);
create policy "TripsForge users can save their own trips" on public.saved_trips for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "TripsForge users can update their own trips" on public.saved_trips for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "TripsForge users can delete their own trips" on public.saved_trips for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.get_shared_trip(trip_share_code text)
returns table (id uuid, title text, destination text, start_date date, end_date date, traveler_count integer, budget integer, itinerary_json jsonb, share_code text, is_public boolean, created_at timestamptz, updated_at timestamptz) language sql security definer set search_path = public as $$
  select st.id, st.title, st.destination, st.start_date, st.end_date, st.traveler_count, st.budget, st.itinerary_json, st.share_code, st.is_public, st.created_at, st.updated_at from public.saved_trips as st where st.share_code = trip_share_code and st.is_public = true limit 1;
$$;
revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
