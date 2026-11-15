# Free map providers for TripsForge

The Vercel travel API now uses:

- **OpenStreetMap** for map data and map embeds.
- **Photon** for place search and geocoding.
- **OSRM** for road-route estimates.

No Google Maps API keys, Google Cloud project, or paid billing setup is required for this MVP configuration.

## Usage limitations

The public Photon and OSRM endpoints are community/demo services. They have no uptime guarantee, may impose fair-use limits, and should not be treated as unlimited production infrastructure. Add caching and request throttling before inviting substantial traffic. For scale, evaluate a paid provider with a free tier or self-host the relevant services.

OpenStreetMap data is © OpenStreetMap contributors. Keep attribution visible when displaying OSM data.

## Other integrations

The map migration does not remove Manus-backed integrations for LLM, storage, notifications, voice transcription, or Data API calls. Those are separate migration projects and may still require their existing credentials.
