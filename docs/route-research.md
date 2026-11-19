# Route research

Journey Studio's **Research route** action is an evidence summary, not a timetable or booking engine.

## Current sources

- OpenStreetMap / Overpass: searches for mapped aerodromes, railway stations and halts, bus stations and stops, and ferry terminals within 20 km of each selected endpoint.
- OSRM / OpenStreetMap: checks whether a drivable road-network route is returned and, when available, reports its distance and estimated routing duration.

## Status meanings

- `infrastructure_at_both_ends`: matching infrastructure is mapped near both endpoints. It does not prove a scheduled connection exists.
- `infrastructure_partial`: matching infrastructure is mapped near only one endpoint.
- `no_infrastructure_found`: the completed OpenStreetMap query returned no matching objects in the search radius. This is not proof of non-existence.
- `not_checked`: the lookup failed or was not completed.
- `road_route_found`: OSRM returned a drivable road-network path. This is not a bus timetable, live traffic result, road-opening status, or safety assessment.

Every mode currently reports scheduled service as `unverified` and booking as `not_connected`. Traveller-selected modes remain planning assumptions.

## Not yet connected

This feature does not query airline, railway, intercity bus or ferry schedules; it does not return live fares, seat availability, operator confirmation or bookable offers. Connecting those requires suitable timetable/booking sources and, in some cases, provider onboarding or credentials.

## Operational notes

The endpoint makes two Overpass requests, one per endpoint, plus one OSRM request. Public community endpoints have usage limits and may be temporarily unavailable. Results are timestamped and not cached. No paid API key is required.
