# TripsForge Source Export

This archive contains the complete TripsForge React, TypeScript, and Tailwind CSS project, including local copies of the image assets needed for the public interface.

## Importing into GitHub

Create a new empty GitHub repository, then upload or push the **contents** of this folder to its root. The archive intentionally excludes `node_modules`, Git metadata, temporary development logs, and Manus-specific project configuration.

## Running locally

Install the locked dependencies and start the Vite development server:

```bash
pnpm install
pnpm dev
```

The application is available at the local address printed by Vite. To create a production build, run:

```bash
pnpm build
```

## Included assets

Website imagery and the TripsForge compass-route logo are located in `client/public/assets/`. Their references have been updated from managed storage paths to local `/assets/...` paths, so the exported project remains self-contained when run outside Manus.

## Deployment note

The project is a Vite React single-page application. A root-level `vercel.json` explicitly configures Vercel to build only the frontend with `pnpm run build:vercel`, serve `dist/public`, and rewrite client-side routes to `index.html`. After pushing the configuration, trigger a new Vercel deployment from the `main` branch.
