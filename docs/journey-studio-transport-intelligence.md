# Journey Studio Transport Intelligence

## Product contract

Journey Studio accepts an origin, destination, travel date, passenger count and traveller constraints. It returns complete end-to-end journey candidates, not isolated transport cards. Every displayed claim must be traceable to a provider observation or explicitly labelled as an estimate. Missing data is unknown, never zero, free, unavailable, or proof that a service does not exist.

## Target architecture

### 1. Request and place resolution
- Persist the selected place's coordinates, country, stable provider/place identifier and timezone when available.
- Resolve traveller-facing city/region labels separately from transport terminals.
- Reject ambiguous place matches instead of silently selecting a similarly named city.
- Normalize the travel date in the origin/destination timezone relevant to each service query.

### 2. Transport network catalogue
Canonical node types: city/region, airport, rail station, bus terminal/stop, ferry terminal and road access point.
Each node carries a stable source identifier, coordinates, country, timezone, aliases, mode capabilities, source, retrievedAt and freshness policy.
OSM/Overpass and public registries discover infrastructure only. They do not establish that a scheduled service operates.

### 3. Provider adapters
Each adapter returns the same normalized contract:
- provider and provider request ID;
- source evidence class: live offer, published schedule, static network data or route estimate;
- canonical origin/destination node IDs;
- departure/arrival timestamps with explicit timezone;
- duration, price and currency only when supplied;
- retrievedAt, validUntil/freshness and raw source reference;
- typed outcomes: results, confirmed empty response, unsupported query, not configured, rate limited, timeout, provider error.
Adapters must never convert provider errors into an empty result.

### 4. Candidate network construction
Build a directed, time-aware graph from normalized provider legs and access edges. Candidate discovery is staged:
1. Direct services between resolved terminals.
2. Regional gateway candidates inside a configurable travel-time/radius budget.
3. Provider searches between gateway pairs, including provider-supported connecting itineraries.
4. Multi-hop surface services where schedules and canonical stop identities exist.
5. First/last-mile road transfers to the actual traveller endpoints.
Search breadth is controlled by explicit budgets, not an arbitrary fixed count of two gateways. Candidate expansion is prioritized by geographic reachability, provider coverage and destination proximity. Record which candidates were not searched because of budget limits.

### 5. Feasibility and connection validation
A path is not feasible merely because its legs connect by city name. Validate:
- exact canonical terminal identity for same-terminal transfers;
- explicit timezone-aware arrival/departure timestamps;
- minimum transfer time by mode, terminal and operator rules when available;
- maximum layover and date rollover;
- airport/station changes using a separately routed ground transfer;
- first/last-mile access route availability;
- stale or expired schedules/offers.
Classify each path: verified feasible, candidate requiring confirmation, incomplete access, timing unknown, stale evidence, or rejected. Never label an unverified candidate as confirmed.

### 6. Ranking and explanation
Support cheapest, fastest, fewest transfers and balanced priorities. Rank only on comparable known values. Unknown fare/time must sort behind known values for that priority and must lower confidence. Show score inputs and reasons; do not invent a single opaque intelligence score.

### 7. Journey Studio presentation
Keep results within Journey Studio:
- one complete itinerary card per end-to-end candidate;
- timeline of every leg and transfer;
- separate mode filters, not disconnected mode cards presented as complete journeys;
- visible evidence source, last checked time and confidence/status;
- explicit explanation when a provider is unavailable or a search scope was limited;
- progressive loading that never displays previous-route data;
- only allow adding an itinerary to the trip after the traveller selects it.

## Reliability and observability

Every research run receives a request ID and route fingerprint. Log adapter start/end, provider, latency, result state, candidate counts, rejected path reasons and freshness. Redact credentials and sensitive traveller data. Cache infrastructure separately from dated offers; never cache a live offer beyond its provider validity.

## Evaluation gates

A release is not accepted because TypeScript or CI passes. It must pass:
1. Unit tests for normalization, timestamps, currency comparability, graph cycles, duplicate legs and transfer rules.
2. Adapter contract tests with fixtures for success, empty, unsupported, timeout, rate limit and malformed responses.
3. Integration tests with mocked providers proving direct and multi-hop complete paths.
4. Route benchmark across dense and sparse networks, domestic and international trips, and different transport modes.
5. Production-like latency, partial-provider-failure and stale-data tests.
6. Manual traveller review of complete itinerary cards and evidence disclosures.

## Initial benchmark set

- Jammu → Manali: road baseline plus airport/rail gateway and onward surface candidates.
- Delhi → Manali: dense gateway coverage with multiple onward surface options.
- London → Paris: international air/rail/ferry/road alternatives.
- New York → Boston: rail/bus/road comparison.
- A remote/rural route with intentionally sparse provider coverage.

For each route, record expected reachable gateways and provider coverage before judging result recall. A provider returning no data is not automatically a negative ground-truth label.

## Delivery sequence

1. Normalize provider outcomes and canonical transport nodes.
2. Implement adapter contracts and contract fixtures.
3. Expand gateway discovery and route candidate budgets.
4. Construct complete candidate itineraries from real service legs.
5. Add strict temporal and terminal transfer validation.
6. Integrate the graph into Journey Studio and remove misleading isolated-result fallback.
7. Add benchmark evaluation, telemetry and production gates.

## Current known blockers

- Flight city resolution still contains a manually curated alias table.
- Gateway flight search currently limits exploration and can exclude connecting itineraries.
- Rail search resolves city labels to one station rather than enumerating validated regional station candidates.
- Public GTFS coverage is not comprehensive for private/intercity services.
- Gateway pair results currently lack sufficient timezone-aware schedule normalization for end-to-end feasibility.
- The existing client journey builder intentionally limits graph paths to one leg.


## Provider adapter normalization implementation

The first adapter pass now maps existing provider responses into the shared contract:

- SerpApi flight offers use IATA airport node IDs and preserve provider fare/currency. SerpApi local wall-clock strings are not converted into UTC or assigned guessed offsets, so these flight legs remain ineligible for time-based transfer validation until the source supplies timezone-aware timestamps.
- RailCore results use the provider's resolved station codes as canonical rail node IDs. Timetable departure/arrival clock strings are not promoted to absolute timestamps without a station timezone and service-date rollover handling.
- Reclaim GTFS bus results use feed-scoped stop IDs (feed ID + stop ID) so identical stop IDs from different feeds cannot collide. GTFS clock strings and fares are not invented into absolute times or prices.
- Provider errors, timeouts, unconfigured credentials, unsupported identity data and confirmed empty results remain distinct in the normalized outcome.

This adapter pass is additive. The existing route cards remain unchanged, and the normalized outcomes are attached to gateway research results for inspection and subsequent graph integration. It does not yet authorize multi-hop connections. A leg with missing absolute timestamps can be displayed as provider evidence, but cannot pass schedule-based connection validation.
