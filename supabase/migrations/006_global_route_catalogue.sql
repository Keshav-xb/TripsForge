-- TripsForge Migration 006: global route catalogue and transport modes.
-- Run after 003_travel_routes.sql. This migration is additive and safe to re-run.

alter table public.travel_routes
  add column if not exists route_kind text not null default 'multi_city',
  add column if not exists primary_transport text not null default 'mixed',
  add column if not exists recommended_transports text[] not null default '{}';

alter table public.travel_routes
  drop constraint if exists travel_routes_route_kind_check;
alter table public.travel_routes
  add constraint travel_routes_route_kind_check
  check (route_kind in ('road_trip','multi_city'));

alter table public.travel_routes
  drop constraint if exists travel_routes_primary_transport_check;
alter table public.travel_routes
  add constraint travel_routes_primary_transport_check
  check (primary_transport in ('car','train','flight','bus','ferry','mixed'));

update public.travel_routes
set route_kind = case
  when slug in ('portugal-coast-and-villages','new-zealand-south-island') then 'road_trip'
  else 'multi_city'
end,
primary_transport = case
  when slug in ('portugal-coast-and-villages','new-zealand-south-island') then 'car'
  when slug = 'japan-city-and-temple-loop' then 'train'
  else 'mixed'
end,
recommended_transports = case
  when slug = 'japan-city-and-temple-loop' then array['train','metro','walking']
  when slug in ('portugal-coast-and-villages','new-zealand-south-island') then array['car']
  when slug = 'kerala-coast-and-backwaters' then array['car','train','ferry']
  else array['car','train','bus']
end;

insert into public.travel_routes (
  slug, name, continent, country, region, start_destination, end_destination,
  intermediate_stops, duration_days, travel_category, budget_min, budget_max,
  travel_styles, photo_url, overview, highlights, is_sample, published, sort_order,
  route_kind, primary_transport, recommended_transports
)
values
('thailand-north-to-south','Thailand: Bangkok to the Andaman Coast','Asia','Thailand','Central & Southern Thailand','Bangkok','Phuket','["Ayutthaya","Chiang Mai","Krabi"]',12,'Culture & beaches',65000,135000,'["Culture","Food","Beaches"]','https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1400&q=85','A multi-region journey linking temple cities, northern food culture and the southern coast.','["Bangkok old town","Chiang Mai temples","Andaman beaches"]',true,true,10,'multi_city','mixed',array['train','flight','bus','ferry']),
('vietnam-north-south','Vietnam: Hanoi to Ho Chi Minh City','Asia','Vietnam','North & South Vietnam','Hanoi','Ho Chi Minh City','["Ninh Binh","Hue","Hoi An","Da Nang"]',13,'Culture & food',70000,145000,'["Food","Culture","Scenic"]','https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1400&q=85','A north-to-south journey through limestone landscapes, historic cities and lively food districts.','["Ha Long Bay region","Hoi An old town","Mekong Delta"]',true,true,11,'multi_city','train',array['train','flight','bus']),
('bali-island-loop','Bali Island Loop','Asia','Indonesia','Bali','Denpasar','Denpasar','["Ubud","Sidemen","Amed","Uluwatu"]',8,'Island road trip',45000,100000,'["Nature","Wellness","Beaches"]','https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=85','An island loop through rice terraces, inland villages, volcanic coastlines and surf beaches.','["Ubud rice terraces","Amed coast","Uluwatu cliffs"]',true,true,12,'road_trip','car',array['car','scooter','ferry']),
('south-korea-city-rail','South Korea: Seoul to Busan by Rail','Asia','South Korea','Korean Peninsula','Seoul','Busan','["Jeonju","Gyeongju"]',7,'City & culture',80000,155000,'["Culture","Food","City"]','https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=1400&q=85','A rail-led journey from Seoul through heritage towns to the coastal energy of Busan.','["Seoul neighbourhoods","Gyeongju heritage","Busan coast"]',true,true,13,'multi_city','train',array['train','metro','walking']),
('japan-alpine-route','Japan Alps & Historic Towns','Asia','Japan','Central Honshu','Tokyo','Kanazawa','["Matsumoto","Kamikochi","Takayama","Shirakawa-go"]',8,'Mountain & heritage',120000,240000,'["Nature","Culture","Scenic"]','https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=85','A mixed rail and bus journey through alpine valleys, castle towns and traditional villages.','["Matsumoto Castle","Kamikochi valley","Shirakawa-go village"]',true,true,14,'multi_city','mixed',array['train','bus','walking']),
('italy-grand-rail-tour','Italy: Rome to Venice','Europe','Italy','Central & Northern Italy','Rome','Venice','["Florence","Bologna"]',9,'Art & food',125000,250000,'["Art","Food","Culture"]','https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1400&q=85','A high-speed rail itinerary through Italy’s major art cities and celebrated regional food destinations.','["Rome ancient sites","Florence galleries","Venice canals"]',true,true,15,'multi_city','train',array['train','walking']),
('swiss-alpine-rail','Swiss Alps Scenic Rail Journey','Europe','Switzerland','Swiss Alps','Zurich','Zermatt','["Lucerne","Interlaken","Jungfrau Region"]',8,'Scenic rail',160000,310000,'["Mountains","Scenic","Photography"]','https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1400&q=85','A rail-focused route linking lakeside cities, alpine valleys and high mountain viewpoints.','["Lake Lucerne","Jungfrau Region","Matterhorn views"]',true,true,16,'multi_city','train',array['train','cable car','walking']),
('france-north-south','France: Paris to the Riviera','Europe','France','North & Southeast France','Paris','Nice','["Lyon","Avignon","Aix-en-Provence"]',10,'City & coast',145000,290000,'["Food","Culture","Coast"]','https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1400&q=85','A rail journey from Paris through gastronomic and historic cities to the Mediterranean coast.','["Paris landmarks","Lyon food scene","French Riviera"]',true,true,17,'multi_city','train',array['train','tram','walking']),
('andalusia-road-trip','Southern Spain: Andalusia Road Trip','Europe','Spain','Andalusia','Seville','Granada','["Ronda","Málaga","Córdoba"]',8,'Culture road trip',95000,185000,'["Road trip","Culture","Food"]','https://images.unsplash.com/photo-1509840841025-9088ba78a826?auto=format&fit=crop&w=1400&q=85','A flexible driving loop through white villages, Moorish architecture and Mediterranean coast.','["Seville old town","Ronda gorge","Alhambra in Granada"]',true,true,18,'road_trip','car',array['car','bus','train']),
('norway-fjord-drive','Norway: Fjords & Atlantic Road','Europe','Norway','Western Norway','Bergen','Trondheim','["Flåm","Geiranger","Ålesund","Atlantic Ocean Road"]',9,'Fjord road trip',180000,350000,'["Road trip","Nature","Photography"]','https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1400&q=85','A scenic driving route combining fjord ferries, mountain roads and dramatic coastal viewpoints.','["Nærøyfjord","Geirangerfjord","Atlantic Ocean Road"]',true,true,19,'road_trip','car',array['car','ferry']),
('usa-california-coast','USA: Pacific Coast Highway','North America','United States','California Coast','San Francisco','Los Angeles','["Monterey","Big Sur","Santa Barbara"]',7,'Coastal road trip',150000,320000,'["Road trip","Coast","Photography"]','https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1400&q=85','A classic coastal drive with ocean cliffs, small towns and flexible stops along California Highway 1.','["Monterey Bay","Big Sur coastline","Santa Barbara"]',true,true,20,'road_trip','car',array['car']),
('canada-rockies-loop','Canada: Canadian Rockies Loop','North America','Canada','Alberta & British Columbia','Calgary','Calgary','["Banff","Lake Louise","Jasper","Icefields Parkway"]',9,'Mountain road trip',170000,340000,'["Road trip","Mountains","Nature"]','https://images.unsplash.com/photo-1503614472-8c93d56cd938?auto=format&fit=crop&w=1400&q=85','A mountain driving loop through national parks, turquoise lakes and glacier viewpoints.','["Lake Louise","Icefields Parkway","Jasper National Park"]',true,true,21,'road_trip','car',array['car']),
('mexico-yucatan-loop','Mexico: Yucatán Peninsula Loop','North America','Mexico','Yucatán Peninsula','Cancún','Cancún','["Valladolid","Chichén Itzá","Mérida","Bacalar"]',8,'Culture & coast',85000,175000,'["Culture","Beaches","Food"]','https://images.unsplash.com/photo-1518638150340-f706e86654de?auto=format&fit=crop&w=1400&q=85','A loop connecting Maya archaeological sites, colonial cities and Caribbean and lagoon coastlines.','["Chichén Itzá","Mérida historic centre","Bacalar lagoon"]',true,true,22,'road_trip','car',array['car','bus']),
('peru-andean-route','Peru: Lima to Cusco & Sacred Valley','South America','Peru','Andes','Lima','Cusco','["Arequipa","Puno","Sacred Valley","Machu Picchu"]',12,'Andean culture',150000,300000,'["Culture","Adventure","History"]','https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1400&q=85','A multi-modal route from the Pacific capital into the Andes, with rail access to Machu Picchu.','["Arequipa historic centre","Lake Titicaca","Machu Picchu"]',true,true,23,'multi_city','mixed',array['flight','bus','train']),
('brazil-rio-iguazu','Brazil: Rio to Iguazu Falls','South America','Brazil','Southeast & South Brazil','Rio de Janeiro','Foz do Iguaçu','["São Paulo","Curitiba"]',9,'City & nature',145000,290000,'["City","Nature","Culture"]','https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1400&q=85','A flight-and-ground journey linking Brazil’s iconic coast and cities with the immense Iguazu Falls.','["Rio viewpoints","São Paulo food scene","Iguazu Falls"]',true,true,24,'multi_city','mixed',array['flight','bus']),
('south-africa-garden-route','South Africa: Cape Town to the Garden Route','Africa','South Africa','Western & Eastern Cape','Cape Town','Gqeberha','["Hermanus","Mossel Bay","Knysna","Tsitsikamma"]',9,'Coastal road trip',135000,275000,'["Road trip","Wildlife","Coast"]','https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1400&q=85','A self-drive journey through coastal reserves, forest towns, marine wildlife areas and dramatic beaches.','["Cape Peninsula","Knysna lagoon","Tsitsikamma coast"]',true,true,25,'road_trip','car',array['car']),
('morocco-imperial-cities','Morocco: Imperial Cities & Atlas','Africa','Morocco','Northern & Central Morocco','Marrakesh','Fes','["Aït Benhaddou","Ouarzazate","Merzouga","Meknes"]',10,'Culture & desert',105000,220000,'["Culture","Desert","Photography"]','https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?auto=format&fit=crop&w=1400&q=85','A guided and overland route across kasbahs, mountain passes, desert landscapes and historic medinas.','["Atlas Mountains","Sahara desert camp","Fes medina"]',true,true,26,'multi_city','mixed',array['car','bus','train']),
('kenya-safari-circuit','Kenya: Nairobi Safari Circuit','Africa','Kenya','Rift Valley & Maasai Mara','Nairobi','Nairobi','["Lake Naivasha","Lake Nakuru","Maasai Mara"]',7,'Safari circuit',190000,380000,'["Wildlife","Nature","Photography"]','https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1400&q=85','A guided safari circuit combining Rift Valley lakes and the wildlife-rich Maasai Mara ecosystem.','["Lake Naivasha","Nakuru wildlife","Maasai Mara"]',true,true,27,'multi_city','car',array['car','small aircraft']),
('australia-east-coast','Australia: Sydney to Cairns','Oceania','Australia','Queensland & New South Wales','Sydney','Cairns','["Byron Bay","Brisbane","K’gari","Whitsundays"]',14,'Coastal journey',210000,420000,'["Coast","Nature","Adventure"]','https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1400&q=85','A long coastal journey combining rail, flights and road transfers between beaches, islands and rainforest.','["Sydney harbour","Whitsunday Islands","Great Barrier Reef"]',true,true,28,'multi_city','mixed',array['train','flight','car','ferry']),
('new-zealand-north-south','New Zealand: North & South Island','Oceania','New Zealand','North & South Islands','Auckland','Queenstown','["Rotorua","Wellington","Picton","Christchurch","Wanaka"]',16,'Island-hopping road trip',230000,460000,'["Road trip","Nature","Adventure"]','https://images.unsplash.com/photo-1469521669194-babb45599def?auto=format&fit=crop&w=1400&q=85','A cross-island itinerary using domestic connections and the Cook Strait ferry, with scenic self-drive sections.','["Rotorua geothermal areas","Cook Strait ferry","Southern Alps"]',true,true,29,'road_trip','mixed',array['car','ferry','flight']),
('uae-desert-city-loop','UAE: Dubai, Abu Dhabi & Desert','Asia','United Arab Emirates','Dubai & Abu Dhabi','Dubai','Dubai','["Abu Dhabi","Al Ain","Liwa Oasis"]',6,'City & desert road trip',90000,190000,'["City","Desert","Architecture"]','https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1400&q=85','A compact self-drive loop balancing modern architecture, cultural sites and desert landscapes.','["Dubai old town","Sheikh Zayed Grand Mosque","Liwa dunes"]',true,true,30,'road_trip','car',array['car','bus'])
on conflict (slug) do update set
  name = excluded.name,
  country = excluded.country,
  region = excluded.region,
  start_destination = excluded.start_destination,
  end_destination = excluded.end_destination,
  intermediate_stops = excluded.intermediate_stops,
  duration_days = excluded.duration_days,
  travel_category = excluded.travel_category,
  budget_min = excluded.budget_min,
  budget_max = excluded.budget_max,
  travel_styles = excluded.travel_styles,
  overview = excluded.overview,
  highlights = excluded.highlights,
  published = excluded.published,
  sort_order = excluded.sort_order,
  route_kind = excluded.route_kind,
  primary_transport = excluded.primary_transport,
  recommended_transports = excluded.recommended_transports,
  updated_at = timezone('utc', now());
