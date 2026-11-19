# TripsForge Product and Engineering Audit

**Audit date:** 2026-11-19  
**Audited baseline:** `main` at the repository's latest visible commit during this review  
**Scope:** product architecture, primary user journey, data and persistence, API boundaries, route/transport intelligence, security posture, deployment, and open feature PRs.

This is a source-code audit, not a runtime QA report. The repository was inspected through GitHub. No local build, browser session, Supabase project, or Vercel deployment logs were available in this audit, so runtime behavior and migration state remain unverified.

## Executive assessment

TripsForge has a substantial UI foundation and useful travel-domain building blocks, but it is not yet an AI travel intelligence platform. The current product combines a polished destination-discovery experience, a manually configured Journey Studio, deterministic itinerary data, traveller-entered budget estimates, and Supabase saved-trip functionality. The public-web research, live transport inventory, and source-grounded itinerary synthesis capabilities are either absent from `main` or only proposed in unmerged PRs.

The highest priority is to make the core journey trustworthy and coherent before adding more provider integrations. Every displayed travel claim needs a clear provenance and status: traveller-entered, curated sample, community map data, provider-returned, or independently verified. A missing result must never be presented as proof that a service does not exist.

## What exists in the audited main branch

- React 19, TypeScript, Vite, Tailwind, Wouter routing, Supabase browser auth/data, and a Vercel serverless tRPC-style API.
- Public pages for Home, Explore, Destination Detail, Routes, and Route Detail; planning and trip pages for Journey Studio, Itinerary, My Trips, Shared Trip, and Simulator; plus Account and Guardian.
- Location search and resolution through Photon, nearby places through Overpass, and road-route previews through public OpenStreetMap routing services.
- A deterministic itinerary/domain model in `client/src/lib/tripData.ts`, budget calculations in `tripBudget.ts`, transport-leg structures in `transportLegs.ts`, and itinerary optimization helpers.
- Supabase migrations for saved trips, guardian, routes, travel-intelligence tables, trip workspace, and a global route catalogue.
- A collection of client/server tests, but no evidence in this audit that the current branch's full check/test/build commands pass.

## Priority findings

### P0 - Trust, correctness, and release blockers

1. **The itinerary generator is not yet an AI planner.** `TripContext.forgeTrip` calls the local `buildTrip` function and stores the result in React state. The source describes deterministic itinerary construction. The user-facing product language should not imply researched, personalized live planning until a real source-backed generation flow exists. Replace the current path with an explicit planning pipeline and label curated/demo content accurately.

2. **Trip state is not durable in the central planning context.** `TripContext` uses in-memory React state. A refresh or fresh browser session can lose an in-progress trip unless a separate save action has persisted it. Implement draft autosave/restore with clear conflict and ownership behavior, then test refresh, sign-in, sign-out, and cross-device restore.

3. **The Vercel API handler needs a security and input-validation pass.** `api/trpc/[trpc].ts` parses query input with raw `JSON.parse`, accepts wildcard CORS, sets cache headers broadly, and dispatches public procedures without a visible method allowlist, request-size cap, per-procedure schema validation, or application-level rate limiting. Add strict schemas, GET/POST policy, bounded payloads/timeouts, safe cache policy, origin policy where needed, and abuse controls before exposing costly or sensitive integrations.

4. **The route preview mode selection is incorrect.** In `route.preview`, the code selects different router hosts for walking and cycling, but constructs the request path with `/route/v1/driving/` for every mode. The selected mode therefore is not reliably represented in the provider request. Correct the endpoint path per provider and add tests for driving, walking, and cycling requests.

5. **The public API reports road-network routing, not real-world transport service.** OSRM/OSM can return a drivable network route and estimate; it cannot establish that a bus operates, a train runs, a road is open, or traffic conditions are current. Keep those as distinct evidence types and never infer commercial service availability from a road route.

6. **Migration state and database policies are not verified.** The repository contains migrations through `006_global_route_catalogue.sql`, but the code/docs alone do not prove that the connected Supabase project has applied them in order. Verify the deployed schema and RLS policies before relying on trip workspace or intelligence tables. In particular, review grants and RLS for every table introduced by migrations 002-006, including tables intended to be server-owned.

### P1 - Core product gaps

7. **Journey Studio asks travellers to do too much manual data entry.** The current page gathers trip dates, travellers, interests, transport legs, and budget line-item estimates. The transport and budget models are useful, but the core promise should be that the traveller states intent and TripsForge researches options. Move manual overrides into editable controls after a researched proposal is generated.

8. **The initial Journey Studio dates are overwritten on mount.** The draft initializer sets start/end dates to relative offsets rather than consistently restoring the user's existing plan dates. Preserve saved values when valid and only apply defaults when fields are empty or invalid. Date handling should use local calendar dates without accidental UTC day shifts.

9. **Flight search is not live on main.** The flight-search proposal in PR #32 explicitly returns fictional demo airlines, routes, schedules, and prices. That is acceptable only as a clearly labelled prototype; it must not be represented as inventory or used in a traveller's decision. The API also needs strict calendar-date validation, passenger validation, and a clear one-way/return contract before a live adapter is considered.

10. **Web research is not connected to the user journey.** The proposal in PR #33 adds a Tavily-backed search endpoint, but no research UI, travel-specific synthesis, conflict resolution, citation presentation, or freshness policy. It also requires a server-side key whose free quota/pricing must be checked before use. Do not configure paid usage by default.

11. **Destination intelligence is incomplete.** Overpass nearby-place discovery is useful community map data, not a complete attraction catalogue or authoritative opening-hours/ticketing source. Build a destination evidence model with provider, retrieval time, source URL, freshness, confidence, and field-level status. Opening hours, fees, closures, and accessibility must be shown only when sourced.

12. **The product's route and navigation concepts are fragmented.** There are separate Explore, Routes, Destination Detail, Journey Studio, Itinerary, Simulator, Guardian, and My Trips experiences. Define one primary journey: discover/select destination → state intent → research/compare → editable itinerary → manage/save trip. Secondary tools should support that flow instead of competing with it.

### P2 - Experience and maintainability

13. **Establish one consistent design system.** The current visual direction uses parchment, deep green, orange accents, editorial typography, and rounded surfaces. Preserve that identity, but centralize tokens, spacing, typography, responsive breakpoints, focus states, and interaction patterns instead of scattering one-off styles.

14. **Audit mobile usability end-to-end.** Check the complete planning and itinerary flow at narrow widths, especially long forms, maps, tables, dialogs, date controls, and transport-leg editing. Ensure touch targets, keyboard access, visible focus, reduced motion, and useful loading/empty/error states.

15. **Make provenance visible wherever data appears.** Every estimate or result should show its source, retrieval/check time, and whether it is live, provider-returned, community-sourced, curated, or traveller-entered. Never display a synthetic price or schedule without a persistent demo label.

16. **Improve operational resilience.** Add bounded retries only where safe, caching with provider-aware TTLs, request deduplication, graceful provider-failure states, structured logs without personal data, and health/usage visibility. Public Photon/Overpass/OSRM services are suitable for low-volume prototyping, not guaranteed high-availability production infrastructure.

17. **Automate quality gates.** Require TypeScript check, unit tests, production build, and targeted API/security tests on every PR. Add browser smoke tests for sign-up, sign-in, destination selection, plan creation, itinerary editing, save/restore, and shared-trip access.

## Review of open PRs #30-#33

All four PRs are open and marked draft. They form a dependency stack: #30 → #31 → #32 → #33. A mergeable flag means GitHub sees no merge conflict at that moment; it does not mean the code has passed checks or is release-ready.

- **#30 Route feasibility engine:** useful separation of geography from provider evidence. Keep the principle that unknown stays unverified. Review same-city classification and country-code quality before production.
- **#31 Road-network verification:** useful narrow OSRM evidence for a drivable route. Keep its wording explicitly limited to road-network connectivity. It does not prove a road is open or that a car service is available.
- **#32 Flight demo:** clearly labels fictional data, which is honest. Do not treat this as flight search. Fix strict date parsing and ensure the return-date/passenger contract is accurate before any provider integration.
- **#33 Web Intelligence foundation:** useful backend seam and honest unconfigured state. It is not yet an agent or a user-facing research experience. The URL filter is not a complete SSRF defense (for example, it does not comprehensively handle IPv6/private-address and DNS-rebinding cases), and the endpoint needs the broader API controls described above. Verify Tavily terms and costs before enabling it.

**Recommendation:** do not merge the stack as a unit. First validate the baseline, repair shared API issues, and then rebase/retarget only the changes that survive review. Keep demo flight data out of production-facing decision flows.

## Proposed delivery sequence

### Phase 0 - Stabilize the baseline
- Run and record `pnpm check`, `pnpm test`, and `pnpm build:vercel`.
- Confirm Vercel build/deployment status and verify the deployed environment variables without exposing secrets.
- Confirm Supabase migrations and RLS policies on the actual project.
- Fix API method/input/cache/CORS boundaries and the route-preview mode bug.
- Add regression tests for the above.

### Phase 1 - Make Journey Studio the product's centre
- Retain the current visual identity but simplify the journey into one coherent, mobile-first workspace.
- Restore trip drafts reliably and preserve existing values.
- Make destination selection and origin/destination context explicit.
- Separate verified evidence, unverified options, estimates, and user-entered overrides.
- Generate an editable itinerary from actual destination data, not a fixed demo itinerary.

### Phase 2 - Build travel intelligence without paid dependencies
- Add a provider-independent research interface with a provider adapter that can remain disabled when no genuinely free quota is available.
- Compare multiple sources, retain source URLs and retrieval timestamps, and detect conflicting claims.
- Start with destination/attraction research and static/public schedule information; add flight/rail/bus adapters only when terms, coverage, and access are confirmed.
- Never infer no service from no search result; distinguish not checked, no result, provider error, and confirmed unavailable.

### Phase 3 - Trip management and launch quality
- Autosave and restore trips, bookings, expenses, documents, and traveller preferences with strict ownership/RLS.
- Add itinerary collaboration/share controls with privacy defaults.
- Complete mobile accessibility, performance, observability, and end-to-end regression testing.
- Publish a clear data-source and limitations page.

## Definition of done

TripsForge is ready to call an AI travel intelligence product only when a traveller can enter an origin, destination, dates, party, interests, and budget; receive a genuinely researched proposal with traceable sources and freshness; understand what is verified versus estimated or unknown; edit a practical day-by-day plan; save and restore it; and manage the resulting trip on mobile without being shown fabricated transport inventory, prices, or opening hours.

## Budget guardrail

Keep development at ₹0 in external provider spend until a specific free tier, quota, terms of use, and production suitability are verified. Do not add a paid key as a prerequisite for local development or silently enable metered usage.
