-- Explore Routes catalog. Run after 001_saved_trips.sql in the TripsForge Supabase project.
create table if not exists public.travel_routes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 160),
  continent text not null,
  country text not null,
  region text not null,
  start_destination text not null,
  end_destination text not null,
  intermediate_stops jsonb not null default '[]'::jsonb,
  duration_days integer not null check (duration_days between 1 and 60),
  travel_category text not null,
  budget_min integer not null check (budget_min >= 0),
  budget_max integer not null check (budget_max >= budget_min),
  travel_styles jsonb not null default '[]'::jsonb,
  photo_url text not null,
  overview text not null,
  highlights jsonb not null default '[]'::jsonb,
  is_sample boolean not null default true,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists travel_routes_filters_idx on public.travel_routes (continent, country, region, duration_days, budget_min, sort_order);
alter table public.travel_routes enable row level security;
revoke all on table public.travel_routes from anon, authenticated;
grant select on table public.travel_routes to anon, authenticated;
drop policy if exists "Published routes are publicly readable" on public.travel_routes;
create policy "Published routes are publicly readable" on public.travel_routes for select to anon, authenticated using (published = true);

insert into public.travel_routes (slug, name, continent, country, region, start_destination, end_destination, intermediate_stops, duration_days, travel_category, budget_min, budget_max, travel_styles, photo_url, overview, highlights, is_sample, published, sort_order)
values
('golden-triangle', 'The Golden Triangle', 'Asia', 'India', 'North India', 'Delhi', 'Jaipur', '["Agra", "Fatehpur Sikri"]', 6, 'Culture & heritage', 22000, 48000, '["Cultural", "Food", "First-timer"]', 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1400&q=85', 'A first, unforgettable passage through grand forts, Mughal courtyards, old-city markets and the colour of Rajasthan.', '["Sunrise at the Taj Mahal", "Amber Fort at golden hour", "Old Delhi food walk"]', true, true, 1),
('kerala-coast-and-backwaters', 'Kerala Coast & Backwaters', 'Asia', 'India', 'South India', 'Kochi', 'Alappuzha', '["Munnar", "Thekkady", "Kumarakom"]', 8, 'Nature & wellness', 28000, 62000, '["Relaxed", "Nature", "Romantic"]', 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1400&q=85', 'Move from spice-scented highlands to palm-lined waterways on a slow route designed for breathing room.', '["Tea-country sunrise", "Wildlife in Thekkady", "Private backwater sunset"]', true, true, 2),
('japan-city-and-temple-loop', 'Japan: City & Temple Loop', 'Asia', 'Japan', 'Honshu', 'Tokyo', 'Osaka', '["Hakone", "Kyoto", "Nara"]', 10, 'City & culture', 115000, 235000, '["Cultural", "Food", "Packed"]', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=85', 'A high-contrast rail journey from neon neighbourhoods to quiet temple lanes, built around memorable food stops.', '["Fuji views from Hakone", "Dawn in Fushimi Inari", "Osaka street-food night"]', true, true, 3),
('portugal-coast-and-villages', 'Portugal Coast & Villages', 'Europe', 'Portugal', 'Atlantic Coast', 'Lisbon', 'Porto', '["Sintra", "Nazaré", "Coimbra", "Douro Valley"]', 9, 'Coastal road trip', 98000, 190000, '["Road trip", "Food", "Romantic"]', 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1400&q=85', 'An Atlantic road line through tiled cities, cliffside beaches, village cafés and the vineyards of the Douro.', '["Sintra palace morning", "Atlantic seafood lunch", "Douro Valley vineyard stay"]', true, true, 4),
('patagonia-wild-frontier', 'Patagonia: The Wild Frontier', 'South America', 'Chile & Argentina', 'Patagonia', 'Santiago', 'El Calafate', '["Puerto Natales", "Torres del Paine", "El Chaltén"]', 12, 'Adventure & outdoors', 210000, 390000, '["Adventure", "Nature", "Active"]', 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1400&q=85', 'A dramatic southern traverse for glacier light, granite peaks and long days outside the usual map.', '["Torres del Paine trails", "Perito Moreno Glacier", "Laguna de los Tres"]', true, true, 5),
('new-zealand-south-island', 'New Zealand South Island', 'Oceania', 'New Zealand', 'South Island', 'Christchurch', 'Queenstown', '["Lake Tekapo", "Aoraki / Mount Cook", "Wanaka"]', 11, 'Scenic drive', 165000, 320000, '["Road trip", "Adventure", "Nature"]', 'https://images.unsplash.com/photo-1469521669194-babb45599def?auto=format&fit=crop&w=1400&q=85', 'A cinematic mountain-and-lake drive with clear route logic, flexible nights and a strong finish in Queenstown.', '["Aoraki night sky", "Milford Sound day trip", "Wanaka lakeshore loop"]', true, true, 6)
on conflict (slug) do update set name = excluded.name, published = excluded.published, sort_order = excluded.sort_order, updated_at = timezone('utc', now());
