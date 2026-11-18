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

Vercel serves the Vite React single-page application from `dist/public` and deploys the serverless tRPC handler in `api/trpc/[trpc].ts` at `/api/trpc/*`. The Express application in `server/_core/index.ts` is used for local development and the standalone Node deployment; it is not the Vercel production entry point.

The Vercel frontend build is `pnpm build:vercel`. Keep provider secrets on the server side; never expose private credentials through `VITE_*` variables. Existing Supabase browser configuration remains public-key based and must be protected by database Row Level Security.

The Vercel API handler currently provides Photon location search/resolution, Overpass nearby places, and OSRM route previews. These are community services with variable coverage, rate limits and availability. Do not treat their results as guaranteed live commercial inventory or confirmed prices.
