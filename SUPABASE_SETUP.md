# TripsForge Supabase setup

TripsForge now uses Supabase Auth and the RLS-protected `public.saved_trips` table. In the Supabase SQL Editor, run `supabase/migrations/001_saved_trips.sql` before testing saved trips.

In **Authentication → URL Configuration**, set the Site URL to the final production TripsForge URL. Add these Redirect URLs: your deployed `https://<project>.vercel.app/**`, any custom domain `https://<domain>/**`, and `http://localhost:3000/**` for local development. In **Authentication → Providers → Email**, keep email enabled and turn on **Confirm email**. TripsForge sends confirmation and recovery emails to `/account` using `VITE_APP_URL`, so links do not inherit an internal `localhost` origin.

In Vercel, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_APP_URL` for Production, Preview, and Development, then redeploy. Set `VITE_APP_URL` to the exact public production origin, such as `https://your-domain.com`; TripsForge uses it when generating Supabase confirmation and password-recovery links. Never add a Supabase service-role key to Vercel browser environment variables or this repository. `vercel.json` runs `pnpm build:vercel` and publishes the static `dist/public` directory, so Supabase handles authentication and private-trip data directly from the browser through RLS. The managed Google Maps route-preview endpoint is not available on this static Vercel target; the existing itinerary map therefore displays its route visual fallback until you later add a separately secured Google Maps serverless proxy.

## Development preview note

The managed development preview intentionally restarts after source edits, package changes, or environment-variable updates. A browser may briefly show a disconnected state while that restart occurs. This does not affect the deployed TripsForge domain. After the latest restart, repeated checks of the landing, account, itinerary, and trips routes all returned HTTP 200 without new application errors.

## Temporary immediate sign-up mode

For the requested no-confirmation setup, open **Authentication → Providers → Email** in Supabase and turn **Confirm Email** off. Supabase will then implicitly confirm newly registered email/password users and the existing TripsForge `signUp` flow will receive a session immediately, allowing the user to save private trips. This dashboard setting cannot be changed with the browser publishable key and must be updated by a project administrator. The RLS policies on `saved_trips` remain unchanged: every row is still tied to `auth.uid()`.

Turn **Confirm Email** back on before a public launch, then configure custom SMTP in **Authentication → SMTP Settings** so verification and password-recovery emails reach real users reliably. Supabase documents that disabling Confirm Email implicitly confirms users; its built-in mailer is development-only, can send only to authorized project-team addresses, and has a low email-sending limit. See the official [general configuration](https://supabase.com/docs/guides/auth/general-configuration), [SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp), and [Auth email troubleshooting guide](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw).
