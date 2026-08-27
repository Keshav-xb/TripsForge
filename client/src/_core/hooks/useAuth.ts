import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type TripsForgeUser = { id: string; email: string; name: string };
const toTripsForgeUser = (user: User | null): TripsForgeUser | null => user ? { id: user.id, email: user.email ?? "", name: typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : (user.email?.split("@")[0] ?? "Traveller") } : null;

export function useAuth() {
  const [user, setUser] = useState<TripsForgeUser | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<Error | null>(null);
  useEffect(() => { let mounted = true; void supabase.auth.getSession().then(({ data, error: sessionError }) => { if (!mounted) return; setUser(toTripsForgeUser(data.session?.user ?? null)); setError(sessionError); setLoading(false); }); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setUser(toTripsForgeUser(session?.user ?? null)); setLoading(false); }); return () => { mounted = false; listener.subscription.unsubscribe(); }; }, []);
  const logout = useCallback(async () => { const { error: signOutError } = await supabase.auth.signOut(); if (signOutError) throw signOutError; }, []);
  return { user, loading, error, isAuthenticated: Boolean(user), refresh: () => supabase.auth.getSession(), logout };
}
