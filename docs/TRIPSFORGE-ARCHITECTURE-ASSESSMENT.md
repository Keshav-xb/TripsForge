# TripsForge — Architecture Assessment and Implementation Roadmap

**Repository:** `Keshav-xb/TripsForge`  
**Production site:** <https://tripsforge.vercel.app/>  
**Assessment basis:** shallow clone of `main` at `d4b5ea3`, source inspection, production HTTP probes, TypeScript check, and Vitest baseline.

## Executive assessment

TripsForge has a usable product shell and a strong visual foundation, but it is not yet a real-world Travel Intelligence Platform. The project is a React 19 + Vite + Tailwind single-page application with a small Express/tRPC server, Supabase Auth/data persistence, and a Google Maps proxy adapter. The current itinerary engine is primarily deterministic client-side template generation. It uses real weather data in one Guardian procedure and a real route preview through the managed Google Maps proxy when server credentials are available, but the generated itinerary, destination catalog, budgets, route optimization, and most stop discovery are still based on local/sample data or heuristics.

The correct strategy is incremental: preserve the existing pages, branding, TripContext, Supabase Auth, saved-trip flows, and route visual language; introduce a server-side travel domain layer; then replace individual fabricated/heuristic outputs with provider-backed records and transparent estimates. The first product milestone should be **geographic search + real road routing + an interactive route map**, as requested.

## 1. Current architecture

### Frontend

- React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Framer Motion, Wouter routing.
- Existing routes: `/`, `/account`, `/planner`, `/itinerary`, `/simulator`, `/guardian`, `/explore`, `/routes`, `/routes/:slug`, `/trips`, `/trip/:shareCode`.
- `TripContext` owns the current in-session trip and generation state.
- `Itinerary.tsx` is the main experience: day cards, saving/sharing, budget summary, route map, local place discovery, and client-side optimization controls.
- Existing reusable map components include `LiveRouteMap`, `RouteMap`, `Map`, `SelectedLocationMap`, and `GuardianFacilitiesMap`.
- Supabase browser access is used for Auth, saved trips, Guardian data, and the explore-route catalog. Row-level security is expected to protect user-owned records.

### Backend

- Express server with tRPC.
- Current router groups:
  - `simulator.interpret`: LLM extraction of changes from a natural-language what-if request.
  - `guardian.weather`: Open-Meteo forecast retrieval for up to 16 forecast days.
  - `guardian.assist`: LLM safety guidance constrained by supplied destination/weather context.
  - `route.preview`: Google Directions proxy call for a driving route through multiple stops, plus optional static-map image generation.
- `server/_core/map.ts` defines a broad Google Maps adapter type surface (geocoding, directions, places, distance matrix, etc.), but only the directions preview is currently wired into the application router.
- `server/_core/env.ts` keeps the managed Forge API credentials server-side for the Express/tRPC path.

### Persistence

Current Supabase migrations:

- `001_saved_trips.sql`: authenticated saved itineraries, public share RPC, RLS.
- `002_travel_guardian.sql`: Guardian preferences/check-ins/scam reports.
- `003_travel_routes.sql`: published route catalog.

There is no travel-intelligence schema for geocoded locations, route results, external place records, weather snapshots, provider metadata, itinerary versions, feasibility reports, or admin telemetry.

### Deployment

- Vercel configuration builds the frontend-only static target.
- The repository also contains an Express/tRPC server path for the managed development/runtime environment.
- The README correctly notes that the managed Google Maps route-preview endpoint is not available on the static Vercel target; the deployed itinerary therefore falls back to a visual route representation unless a separately secured serverless/API proxy is added.

## 2. Current functionality versus requested scope

| Requested capability | Current state | Gap / consequence |
|---|---|---|
| Global geocoding and reverse geocoding | Adapter types/comments exist; no user-facing procedure | Planner still works from local destination data; no canonical place IDs or confidence handling |
| Country/city/coordinate identification | Partial data embedded in local destination records | No provider-backed normalization or provenance |
| Genuine routing | Driving multi-stop Google Directions preview exists server-side | Walking/cycling/alternatives/recalculation are not exposed; static deployment cannot use the current proxy |
| Interactive map | Existing map components and route visualizations | Route geometry is not a durable domain object; provider/runtime fallback is opaque |
| Places/destination intelligence | Local/sample activities plus limited discovery helpers | No complete provider-backed POI search/details/photos/opening-hours pipeline |
| Smart stops along route | Existing client discovery/diversification behavior | Must be replaced with corridor/route-distance filtering against real POIs |
| Transportation intelligence | Client estimates and simulator labels | No provider-backed mode contract or explicit unsupported-mode handling |
| Budget intelligence | Heuristic local calculations | No assumptions ledger, verified/live distinction, currency/exchange-rate strategy, or provider evidence |
| Weather | Real Open-Meteo daily forecast procedure | No current conditions, warnings, forecast-horizon guard in UX, source record, or itinerary integration |
| AI itinerary generation | LLM used for simulator text extraction and Guardian advice | Itinerary is not generated from a structured bundle of retrieved facts |
| Feasibility engine | Trip score and client heuristics | No explicit constraint evaluation, evidence, or explainable score model |
| Optimization | Client-side nearest-neighbor heuristic | Not based on road-network travel time, opening hours, budget, or optimization objective comparison |
| Personalization | Saved trips/Auth exist | No profile/preferences/saved destinations/saved routes model |
| Progress/streaming | Timed UI stages in `Itinerary.tsx` | Stages can appear complete without underlying operations succeeding |
| Reliability/provenance | Basic fetch error handling | No provider metadata, cache policy, retries, rate limiting, request log, or stale-data semantics |
| Admin dashboard | Not present | No protected admin role/model or operations telemetry UI |

## 3. Important reliability findings

1. `Itinerary.tsx` advances through four generation stages on a timer and calls `finishGeneration` after the timer completes. This is presentation-only progress, not operation-backed progress.
2. `client/src/lib/tripData.ts` supplies destination/activity templates and fallback activities. The optimizer estimates movement from coordinate geometry or text distances; it does not optimize actual road travel.
3. `server/routers.ts` catches all route-preview failures and returns `{ available: false }`, which prevents a fabricated result but loses structured error reason, retryability, provider status, and diagnostics.
4. The current `route.preview` hard-codes `mode: "driving"`, an India-oriented address fallback, and does not request alternatives.
5. The frontend directly reads most Supabase data using the publishable key. That is acceptable for RLS-protected user data, but external API keys and administrative operations must remain behind the server/API layer.
6. Production probes returned HTTP 200 for `/`, `/planner`, `/itinerary`, and `/trips`, confirming SPA fallback and the deployed shell. This does not prove that Supabase or server-side map credentials are configured in the deployed environment.
7. Baseline `pnpm check` passes. `pnpm test` reports 31 passing tests and 5 failures caused by missing test environment variables and a Node test environment without `window`; these should be fixed before feature work is declared stable.

## 4. API and provider requirements

### Minimum provider set for milestone 1

**Geocoding/search and routing:** use one primary provider consistently for canonical IDs, coordinates, route geometry, and travel modes. The existing Google Maps proxy is the lowest-friction option because the adapter and server credentials already exist. If provider cost or license policy favors open data, use a documented combination such as Nominatim/Photon for search and OSRM/GraphHopper for routing, but do not mix sources without recording provider and attribution per result.

Required server contracts:

- `location.search(query, bias?, limit?)`
- `location.reverseGeocode(lat, lng)`
- `location.resolve(placeId | freeText)`
- `route.calculate({ points, mode, alternatives, departureTime? })`
- `route.recalculate({ routeId, points, mode, objective? })`
- `route.discoverStops({ routeId, categories, corridorKm, limit })`

Each response should include normalized data plus `source`, `sourceReference`, `retrievedAt`, `verificationStatus`, and `expiresAt` where applicable.

### Destination intelligence

Use the same provider's Places/POI APIs when possible so place IDs and coordinates remain consistent with geocoding and routes. If a second provider is introduced for photos or attraction content, keep the canonical place record separate from enrichment records and preserve attribution. Never show a fallback local/sample place as if it came from a live provider.

### Weather

Keep Open-Meteo as the initial provider unless product requirements require alerts or commercial forecast guarantees. Add a provider adapter with explicit forecast horizon handling. The UI should distinguish “forecast available for these dates” from “forecast not yet available.” Store retrieval time and provider payload hash for reproducibility.

### AI

The itinerary generator should receive a structured, server-created evidence bundle: resolved locations, selected route legs, route geometry summary, verified POIs, opening-hour evidence, forecast rows, budget assumptions, user preferences, and hard constraints. The model should return strict JSON validated by Zod. It must be prohibited from inventing places, distances, opening hours, prices, or forecasts; any unsupported statement should be represented as an estimate or omitted.

## 5. Database migration plan

Create migrations in independently deployable phases. Keep the existing tables and RLS policies intact.

### Phase A — normalized locations and provider observations

- `travel_locations`: canonical place/location ID, provider, provider reference, name, formatted address, country code, region, city, latitude, longitude, geometry, raw types, verification status, timestamps.
- `provider_observations`: provider, endpoint/category, source reference, request hash, retrieved timestamp, expiry timestamp, response status, payload JSON, error metadata.
- `user_travel_preferences`: one row per user for pace, modes, budget defaults, interests, dietary/accessibility preferences, and units.
- `saved_destinations`: user-owned references to canonical locations.

### Phase B — route and itinerary domain

- `travel_routes`: user-owned route request and normalized points.
- `route_results`: provider, mode, alternatives, distance, duration, encoded geometry/GeoJSON, legs, warnings, waypoint order, source metadata, status.
- `route_stops`: route-result stop sequence and stop role.
- `itinerary_versions`: immutable generation inputs/output, evidence bundle reference, model/provider metadata, feasibility score, and status.
- `itinerary_items`: normalized day/activity rows with coordinates, time windows, source place IDs, cost estimate, assumption IDs, and verification status.

### Phase C — estimates, feasibility, and operations

- `budget_assumptions`: category, value, currency, unit, quantity, estimate/live flag, source, confidence, explanation.
- `feasibility_reports`: score, rule results, severity, explanation, evidence references, evaluated timestamp.
- `optimization_runs`: objective, input itinerary version, candidate output, metrics, and chosen result.
- `api_request_logs`: provider, route, latency, status, retry count, rate-limit data, redacted error, request hash.
- `admin_roles` or a Supabase custom-claims role mapping for protected operations.

### RLS principles

- User-owned routes, preferences, saved destinations, itinerary versions, budgets, and optimization runs are accessible only to `auth.uid()`.
- Provider observations and request logs are server-owned; the client receives only necessary normalized data.
- Public sharing must use a narrow RPC or view that exposes only intentionally public itinerary fields.
- Admin procedures require a server-side role check; never trust a client-provided `isAdmin` flag.
- Do not expose Supabase service-role keys in browser variables.

## 6. Target service architecture

Add a server-side `travel` domain rather than expanding one monolithic router file:

```text
server/travel/
  contracts.ts          # Zod input/output schemas
  providers/
    geocoding.ts
    routing.ts
    places.ts
    weather.ts
  cache.ts              # provider-policy-aware caching
  provenance.ts         # source/verification/expiry metadata
  resilience.ts         # timeout, retry, rate-limit handling
  locationService.ts
  routeService.ts
  placesService.ts
  weatherService.ts
  budgetService.ts
  feasibilityService.ts
  itineraryService.ts
  optimizationService.ts
  telemetryService.ts
server/routers/
  travel.ts
  admin.ts
```

The tRPC procedures should orchestrate services, not contain provider-specific parsing. Provider adapters should be replaceable and tested with recorded fixtures. Route/POI/weather results should be cached only within each provider's policy; cache keys must include provider, normalized request, and relevant date/mode parameters.

## 7. Implementation roadmap

### Milestone 0 — foundation and safety

- Fix the five baseline test failures by loading a test `.env` contract and using a DOM-capable test environment only where needed.
- Add request timeouts, structured error types, retry policy, correlation IDs, redacted logging, and provider provenance types.
- Add server-side feature flags so the existing planner remains usable while travel intelligence is introduced.
- Replace timer-only generation stages with operation-backed stage events/results.

### Milestone 1 — geographic search, real routing, interactive map

- Add location autocomplete and location resolution to the planner.
- Persist canonical points with provider IDs and coordinates.
- Add route modes: driving, walking, cycling; expose alternatives only when the provider returns them.
- Support multiple intermediate stops with add/remove/reorder controls.
- Return route geometry, legs, actual distance, duration, waypoint order, and warnings.
- Render the returned geometry in one interactive map component with start/destination/intermediate markers, fit-bounds, route selection, and route comparison.
- Add tests for real journeys, invalid locations, multi-stop requests, route recalculation, and provider errors.

### Milestone 2 — destination intelligence and smart stop discovery

- Add provider-backed POI search/details, photos, opening hours, categories, and attribution.
- Build route-corridor discovery using route geometry or sampled points and a bounded corridor distance; do not use a broad destination search.
- Let users add/remove discovered places and trigger real route recalculation.
- Show source and freshness labels for each external record.

### Milestone 3 — transportation, budget, and weather

- Define supported modes explicitly and show unsupported live-data claims as unavailable.
- Add budget assumptions for fuel, fares, stays, food, activities, and miscellaneous spend.
- Separate estimates from verified/live values and show the assumptions ledger in the UI.
- Integrate forecast rows for travel dates, current weather where supported, warnings where supported, and seasonal context without extending beyond provider horizon.

### Milestone 4 — evidence-grounded itinerary generation and feasibility

- Generate day plans from a structured evidence bundle using strict JSON schema validation.
- Add activity time windows and opening-hour checks.
- Build feasibility rules for drive intensity, schedule conflicts, budget mismatch, repeats, opening hours, and known seasonal restrictions.
- Show a transparent score with rule-level explanations and evidence links.

### Milestone 5 — optimization and personalization

- Add route objectives: shortest travel time, lowest estimated expense, sightseeing priority, relaxed, intensive.
- Compare candidate itineraries using actual route durations and constraints.
- Add profile preferences, saved destinations, preferred transport, budget defaults, and saved routes.
- Reuse existing Auth and RLS; do not duplicate identity or create a second auth system.

### Milestone 6 — operations/admin

- Add protected admin pages for provider health/configuration, route and destination records, source verification, request failures, usage, and user/support views.
- Add audit logs for admin mutations.
- Add provider health checks and dashboards before enabling aggressive fallbacks.

## 8. Testing and acceptance strategy

Do not mark a module complete from UI appearance alone. Each provider-backed module needs:

- Unit tests for normalization, validation, provenance, cache keys, and failure classification.
- Contract tests using recorded provider fixtures for success, empty results, rate limits, timeouts, malformed payloads, and provider outages.
- Integration tests for real journeys such as Jammu → Srinagar and a multi-stop city route, using configured credentials in a protected environment.
- Route recalculation tests after adding/removing/reordering stops.
- Feasibility tests for long drives, impossible schedules, repeated destinations, budget mismatches, and forecast horizon.
- RLS tests for anonymous, owner, other-user, and public-share access.
- Mobile layout checks for planner, map, itinerary, and admin surfaces.
- Build/deployment checks for both the managed server runtime and the static Vercel target; the static target must not imply server-only functionality is available.

## 9. Immediate next implementation batch

The recommended next code batch is limited to Milestone 0 and the first vertical slice of Milestone 1:

1. Add travel contracts, provider metadata, timeout/retry helpers, and structured route errors.
2. Add server procedures for geocoding/autocomplete, reverse geocoding, and route calculation with mode/alternatives.
3. Add the first travel migrations for canonical locations, route requests/results, and provider observations.
4. Replace planner free-text destination handling with resolved location selection while preserving the existing form styling.
5. Replace the current static/fallback route visualization with returned route geometry and marker data, retaining the existing TripsForge visual language.
6. Add operation-backed generation stages and focused tests.

This sequence keeps the existing homepage, auth, planner, itinerary, branding, and Supabase project intact while establishing the real-data foundation required by the rest of the platform.
