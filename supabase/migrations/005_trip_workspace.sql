-- TripsForge: collaborative trip workspace foundation.
-- Additive migration. Existing saved_trips and its public-share RPC remain unchanged.
-- Run after 004_travel_intelligence_foundation.sql.

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  legacy_saved_trip_id uuid unique references public.saved_trips(id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  destination_name text not null check (char_length(destination_name) between 2 and 160),
  destination_location_id uuid references public.travel_locations(id) on delete set null,
  start_date date,
  end_date date,
  status text not null default 'planning' check (status in ('planning','booked','in_progress','completed','cancelled')),
  currency char(3) not null default 'INR',
  budget_amount numeric(14,2) check (budget_amount is null or budget_amount >= 0),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('editor','viewer')),
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table if not exists public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  role text not null default 'viewer' check (role in ('editor','viewer')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 366),
  trip_date date,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, day_number)
);

create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_id uuid references public.trip_days(id) on delete set null,
  location_id uuid references public.travel_locations(id) on delete set null,
  item_type text not null default 'activity' check (item_type in ('activity','attraction','restaurant','accommodation','transport','note','other')),
  title text not null check (char_length(title) between 1 and 200),
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  estimated_cost numeric(14,2) check (estimated_cost is null or estimated_cost >= 0),
  currency char(3) not null default 'INR',
  verification_status text not null default 'unverified' check (verification_status in ('provider_verified','user_selected','estimated','unverified','stale')),
  source_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.trip_bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  item_id uuid references public.trip_items(id) on delete set null,
  booking_type text not null check (booking_type in ('flight','hotel','transport','activity','restaurant','other')),
  provider text,
  provider_reference text,
  status text not null default 'researching' check (status in ('researching','pending_approval','booked','cancelled','failed')),
  confirmation_reference text,
  amount numeric(14,2) check (amount is null or amount >= 0),
  currency char(3) not null default 'INR',
  start_at timestamptz,
  end_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  booking_id uuid references public.trip_bookings(id) on delete set null,
  category text not null check (category in ('transport','accommodation','food','activities','shopping','insurance','other')),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null default 'INR',
  spent_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  document_type text not null check (document_type in ('ticket','hotel_confirmation','identity','visa','insurance','itinerary','other')),
  title text not null,
  storage_path text not null,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_travel_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_currency char(3) not null default 'INR',
  preferred_transport text[] not null default '{}',
  interests text[] not null default '{}',
  travel_pace text check (travel_pace is null or travel_pace in ('relaxed','balanced','packed')),
  budget_level text check (budget_level is null or budget_level in ('budget','balanced','premium')),
  accessibility_needs text[] not null default '{}',
  dietary_preferences text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.travel_locations(id) on delete cascade,
  collection_name text not null default 'Want to visit',
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, location_id, collection_name)
);

-- Keep all child references inside the same trip. A client cannot attach
-- another trip's day, itinerary item or booking by guessing its UUID.
alter table public.trip_days add constraint trip_days_id_trip_unique unique (id, trip_id);
alter table public.trip_items add constraint trip_items_id_trip_unique unique (id, trip_id);
alter table public.trip_bookings add constraint trip_bookings_id_trip_unique unique (id, trip_id);

alter table public.trip_items drop constraint if exists trip_items_day_id_fkey;
alter table public.trip_items add constraint trip_items_day_trip_fkey
  foreign key (day_id, trip_id) references public.trip_days(id, trip_id)
  on delete set null (day_id);

alter table public.trip_bookings drop constraint if exists trip_bookings_item_id_fkey;
alter table public.trip_bookings add constraint trip_bookings_item_trip_fkey
  foreign key (item_id, trip_id) references public.trip_items(id, trip_id)
  on delete set null (item_id);

alter table public.trip_expenses drop constraint if exists trip_expenses_booking_id_fkey;
alter table public.trip_expenses add constraint trip_expenses_booking_trip_fkey
  foreign key (booking_id, trip_id) references public.trip_bookings(id, trip_id)
  on delete set null (booking_id);

create index if not exists trips_owner_updated_idx on public.trips(owner_id, updated_at desc);
create index if not exists trip_members_user_idx on public.trip_members(user_id, trip_id);
create index if not exists trip_days_trip_date_idx on public.trip_days(trip_id, trip_date);
create index if not exists trip_items_trip_day_order_idx on public.trip_items(trip_id, day_id, sort_order);
create index if not exists trip_bookings_trip_status_idx on public.trip_bookings(trip_id, status);
create index if not exists trip_expenses_trip_date_idx on public.trip_expenses(trip_id, spent_at desc);
create index if not exists trip_documents_trip_idx on public.trip_documents(trip_id);
create index if not exists saved_destinations_user_idx on public.saved_destinations(user_id, created_at desc);

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = target_trip_id and t.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.trip_members m
    where m.trip_id = target_trip_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit_trip(target_trip_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = target_trip_id and t.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.trip_members m
    where m.trip_id = target_trip_id
      and m.user_id = (select auth.uid())
      and m.role = 'editor'
  );
$$;

create or replace function public.is_trip_owner(target_trip_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = target_trip_id and t.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.is_trip_member(uuid) from public;
revoke all on function public.can_edit_trip(uuid) from public;
revoke all on function public.is_trip_owner(uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.can_edit_trip(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;

create or replace function public.set_trip_workspace_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['trips','trip_days','trip_items','trip_bookings'] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute procedure public.set_trip_workspace_updated_at()', table_name || '_updated_at', table_name);
  end loop;
end;
$$;

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.trip_days enable row level security;
alter table public.trip_items enable row level security;
alter table public.trip_bookings enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_documents enable row level security;
alter table public.user_travel_preferences enable row level security;
alter table public.saved_destinations enable row level security;

revoke all on public.trips, public.trip_members, public.trip_invitations,
  public.trip_days, public.trip_items, public.trip_bookings, public.trip_expenses,
  public.trip_documents, public.user_travel_preferences, public.saved_destinations
from anon, authenticated;

grant select, insert, update, delete on public.trips, public.trip_members,
  public.trip_days, public.trip_items, public.trip_bookings, public.trip_expenses,
  public.trip_documents, public.user_travel_preferences, public.saved_destinations
to authenticated;
-- Invitations are deliberately server-only: raw invite tokens must never be readable by clients.
grant all on public.trip_invitations to service_role;

create policy "Trip owners and members can read trips" on public.trips
for select to authenticated using (public.is_trip_member(id));
create policy "Users can create trips they own" on public.trips
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners and editors can update trips" on public.trips
for update to authenticated using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));
create policy "Only owners can delete trips" on public.trips
for delete to authenticated using (public.is_trip_owner(id));

create policy "Members can read trip membership" on public.trip_members
for select to authenticated using (public.is_trip_member(trip_id));
create policy "Owners can add trip members" on public.trip_members
for insert to authenticated with check (public.is_trip_owner(trip_id));
create policy "Owners can change trip members" on public.trip_members
for update to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy "Owners can remove trip members" on public.trip_members
for delete to authenticated using (public.is_trip_owner(trip_id));

create policy "Trip members can read trip days" on public.trip_days
for select to authenticated using (public.is_trip_member(trip_id));
create policy "Editors can create trip days" on public.trip_days
for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "Editors can update trip days" on public.trip_days
for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "Editors can delete trip days" on public.trip_days
for delete to authenticated using (public.can_edit_trip(trip_id));

create policy "Trip members can read trip items" on public.trip_items
for select to authenticated using (public.is_trip_member(trip_id));
create policy "Editors can create trip items" on public.trip_items
for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "Editors can update trip items" on public.trip_items
for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "Editors can delete trip items" on public.trip_items
for delete to authenticated using (public.can_edit_trip(trip_id));

create policy "Trip members can read bookings" on public.trip_bookings
for select to authenticated using (public.is_trip_member(trip_id));
create policy "Editors can create bookings" on public.trip_bookings
for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "Editors can update bookings" on public.trip_bookings
for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "Editors can delete bookings" on public.trip_bookings
for delete to authenticated using (public.can_edit_trip(trip_id));

create policy "Trip members can read expenses" on public.trip_expenses
for select to authenticated using (public.is_trip_member(trip_id));
create policy "Editors can create expenses" on public.trip_expenses
for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "Editors can update expenses" on public.trip_expenses
for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "Editors can delete expenses" on public.trip_expenses
for delete to authenticated using (public.can_edit_trip(trip_id));

create policy "Trip members can read documents" on public.trip_documents
for select to authenticated using (public.is_trip_member(trip_id));
create policy "Editors can add documents" on public.trip_documents
for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "Editors can update documents" on public.trip_documents
for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "Editors can delete documents" on public.trip_documents
for delete to authenticated using (public.can_edit_trip(trip_id));

create policy "Users manage their own travel preferences" on public.user_travel_preferences
for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage their saved destinations" on public.saved_destinations
for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- trip_invitations has RLS enabled and no client grants/policies by design.
-- A trusted server function must create, revoke and accept invitations after
-- validating email, expiry, token hash and the invitee's authenticated identity.
