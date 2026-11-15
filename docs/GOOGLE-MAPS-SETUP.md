# Google Maps setup for TripsForge

TripsForge map loading, place search, geocoding, route preview, and static route images no longer use the Manus Forge maps proxy.

## Required environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | Vercel project environment | Loads Google Maps JavaScript in the browser |
| `GOOGLE_MAPS_API_KEY` | Vercel project environment | Server-side Places Autocomplete, Geocoding, Directions, and Static Maps |

Set both variables for Preview and Production deployments as needed. The server key must not use the `VITE_` prefix.

## Google Cloud setup

1. Create or select a Google Cloud project.
2. Enable billing for that project.
3. Enable Maps JavaScript API, Places API, Geocoding API, Directions API, and Maps Static API.
4. Create a browser key for `VITE_GOOGLE_MAPS_API_KEY`. Restrict it by HTTP referrer to your deployed TripsForge domains and localhost development domain.
5. Create a separate server key for `GOOGLE_MAPS_API_KEY`. Restrict it to the APIs required by server requests and use server-side application restrictions when your deployment environment supports them.
6. Add both values to Vercel under Project Settings → Environment Variables.
7. Redeploy the Vercel project after saving the variables.

Google Maps Platform is usage-billed. Set API quotas and billing alerts in Google Cloud before public launch.

## Remaining Manus integrations

This change removes Manus Forge from the map and route provider path only. The repository still uses Forge-backed integrations for some non-map features such as LLM, storage, notifications, voice transcription, and Data API calls. Those require separate migrations and should not be assumed to work without their existing credentials.
