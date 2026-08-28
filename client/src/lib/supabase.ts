import { createClient } from "@supabase/supabase-js";

type SupabaseConfigurationInput = {
  url?: string;
  publishableKey?: string;
};

export function getSupabaseConfiguration({ url, publishableKey }: SupabaseConfigurationInput) {
  const normalizedUrl = url?.trim();
  const normalizedPublishableKey = publishableKey?.trim();

  return {
    url: normalizedUrl,
    publishableKey: normalizedPublishableKey,
    isConfigured: Boolean(normalizedUrl && normalizedPublishableKey),
  };
}

const configuration = getSupabaseConfiguration({
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
});

export const isSupabaseConfigured = configuration.isConfigured;

// The app displays an explicit setup notice before any protected view mounts.
// These inert placeholders prevent a missing Vercel variable from throwing during module import.
export const supabase = createClient(
  configuration.url ?? "https://tripsforge-supabase-unconfigured.invalid",
  configuration.publishableKey ?? "sb_publishable_unconfigured",
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }
);

export function getSupabaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email before signing in.";
  if (/user already registered/i.test(message)) return "An account already exists for this email. Try signing in instead.";
  if (/password should be at least/i.test(message)) return "Choose a password with at least 8 characters.";
  if (/rate limit/i.test(message)) return "Too many attempts. Please wait a moment and try again.";
  if (message === "AUTH_REQUEST_TIMEOUT") return "Supabase is taking too long to respond. Check your connection and try again.";
  return message;
}
