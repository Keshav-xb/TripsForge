# TripsForge Source Export

This repository contains the TripsForge React, TypeScript, and Tailwind CSS application.

## Running locally

```bash
pnpm install
pnpm dev
```

Create a production frontend build with `pnpm build:vercel`.

## Maps, search, and routing

TripsForge's interactive maps use Leaflet with OpenStreetMap tiles. Location search and geocoding use the public Photon service, route estimates use public OSRM routers, and nearby hospitals, police stations, pharmacies, and attractions are discovered through the Overpass API. No Google Maps API key or billing account is required.

These public services are suitable for an MVP and low-volume testing, not guaranteed high-availability production infrastructure. Respect provider usage policies, cache repeated searches, and move to a contracted provider or self-hosted services before significant traffic. OpenStreetMap map data is © OpenStreetMap contributors.

## Deployment

The project is a Vite React single-page application. Vercel builds the frontend with `pnpm run build:vercel` and serves `dist/public`. Existing Supabase environment variables remain unchanged.
