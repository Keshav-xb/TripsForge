import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export function getSupabaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email before signing in.";
  if (/user already registered/i.test(message)) return "An account already exists for this email. Try signing in instead.";
  if (/password should be at least/i.test(message)) return "Choose a password with at least 8 characters.";
  if (/rate limit/i.test(message)) return "Too many attempts. Please wait a moment and try again.";
  return message;
}
