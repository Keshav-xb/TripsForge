import { supabase } from "@/lib/supabase";

export type GuardianContact = { name: string; phone: string };
export type GuardianPreferences = {
  user_id: string;
  destination: string;
  trusted_contacts: GuardianContact[];
  checkin_minutes: number;
  location_sharing: boolean;
  alert_categories: string[];
  offline_kit: Record<string, string>;
  updated_at: string;
};
export type GuardianCheckin = {
  id: string;
  user_id: string;
  destination: string;
  expected_arrival: string;
  trusted_contact: string | null;
  status: "pending" | "safe" | "extended" | "cancelled";
  created_at: string;
};
export type GuardianScamReport = {
  id: string;
  user_id: string;
  destination: string;
  category: string;
  description: string;
  status: "community_report" | "reviewed" | "verified";
  created_at: string;
};

export async function getGuardianPreferences() {
  const { data, error } = await supabase.from("guardian_preferences").select("*").maybeSingle();
  if (error) throw error;
  return data as GuardianPreferences | null;
}

export async function saveGuardianPreferences(input: Omit<GuardianPreferences, "updated_at">) {
  const { data, error } = await supabase.from("guardian_preferences").upsert(input).select("*").single();
  if (error) throw error;
  return data as GuardianPreferences;
}

export async function listGuardianCheckins() {
  const { data, error } = await supabase.from("guardian_checkins").select("*").order("created_at", { ascending: false }).limit(10);
  if (error) throw error;
  return (data ?? []) as GuardianCheckin[];
}

export async function createGuardianCheckin(input: Pick<GuardianCheckin, "destination" | "expected_arrival" | "trusted_contact"> & { user_id: string }) {
  const { data, error } = await supabase.from("guardian_checkins").insert(input).select("*").single();
  if (error) throw error;
  return data as GuardianCheckin;
}

export async function updateGuardianCheckin(id: string, status: GuardianCheckin["status"]) {
  const { data, error } = await supabase.from("guardian_checkins").update({ status }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as GuardianCheckin;
}

export async function createGuardianScamReport(input: Pick<GuardianScamReport, "destination" | "category" | "description"> & { user_id: string }) {
  const { data, error } = await supabase.from("guardian_scam_reports").insert(input).select("*").single();
  if (error) throw error;
  return data as GuardianScamReport;
}
