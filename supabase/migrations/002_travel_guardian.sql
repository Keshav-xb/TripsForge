-- Travel Guardian data model. Run this migration in the Supabase SQL editor.
create table if not exists public.guardian_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  destination text not null default '',
  trusted_contacts jsonb not null default '[]'::jsonb,
  checkin_minutes integer not null default 120 check (checkin_minutes between 15 and 1440),
  location_sharing boolean not null default false,
  alert_categories text[] not null default array['weather','road','transport']::text[],
  offline_kit jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.guardian_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null check (char_length(destination) between 2 and 160),
  expected_arrival timestamptz not null,
  trusted_contact text,
  status text not null default 'pending' check (status in ('pending','safe','extended','cancelled')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.guardian_scam_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null check (char_length(destination) between 2 and 160),
  category text not null check (char_length(category) between 2 and 80),
  description text not null check (char_length(description) between 10 and 2000),
  status text not null default 'community_report' check (status in ('community_report','reviewed','verified')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.guardian_preferences enable row level security;
alter table public.guardian_checkins enable row level security;
alter table public.guardian_scam_reports enable row level security;

revoke all on table public.guardian_preferences, public.guardian_checkins, public.guardian_scam_reports from anon;
grant select, insert, update, delete on table public.guardian_preferences, public.guardian_checkins, public.guardian_scam_reports to authenticated;

create policy "Guardian users own preferences" on public.guardian_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Guardian users own checkins" on public.guardian_checkins for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Guardian users own reports" on public.guardian_scam_reports for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists guardian_checkins_user_created_idx on public.guardian_checkins (user_id, created_at desc);
create index if not exists guardian_reports_destination_created_idx on public.guardian_scam_reports (destination, created_at desc);
