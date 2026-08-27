import { supabase } from "@/lib/supabase";
import type { ForgedTrip } from "@/lib/tripData";

export type SavedTrip = { id: string; title: string; destination: string; start_date: string; end_date: string; traveler_count: number; budget: number; itinerary_json: ForgedTrip; share_code: string; is_public: boolean; created_at: string; updated_at: string; };
export type SavedTripInput = { title: string; destination: string; startDate: string; endDate: string; travelerCount: number; budget: number; itineraryJson: ForgedTrip; };

function ensureData<T>(data: T | null, error: { message: string } | null): T { if (error) throw error; if (!data) throw new Error("That route is no longer available."); return data; }
const newShareCode = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export async function listSavedTrips() { const { data, error } = await supabase.from("saved_trips").select("*").order("updated_at", { ascending: false }); if (error) throw error; return (data ?? []) as SavedTrip[]; }
export async function getSavedTrip(id: string) { const { data, error } = await supabase.from("saved_trips").select("*").eq("id", id).maybeSingle(); return ensureData(data as SavedTrip | null, error); }
export async function saveNewTrip(input: SavedTripInput, userId: string) { const { data, error } = await supabase.from("saved_trips").insert({ user_id: userId, title: input.title, destination: input.destination, start_date: input.startDate, end_date: input.endDate, traveler_count: input.travelerCount, budget: input.budget, itinerary_json: input.itineraryJson, share_code: newShareCode() }).select("*").single(); return ensureData(data as SavedTrip | null, error); }
export async function updateSavedTrip(id: string, input: SavedTripInput) { const { data, error } = await supabase.from("saved_trips").update({ title: input.title, destination: input.destination, start_date: input.startDate, end_date: input.endDate, traveler_count: input.travelerCount, budget: input.budget, itinerary_json: input.itineraryJson }).eq("id", id).select("*").single(); return ensureData(data as SavedTrip | null, error); }
export async function deleteSavedTrip(id: string) { const { error } = await supabase.from("saved_trips").delete().eq("id", id); if (error) throw error; }
export async function enableTripSharing(id: string) { const { data, error } = await supabase.from("saved_trips").update({ is_public: true }).eq("id", id).select("share_code").single(); return ensureData(data as { share_code: string } | null, error); }
export async function getSharedTrip(shareCode: string) { const { data, error } = await supabase.rpc("get_shared_trip", { trip_share_code: shareCode }).maybeSingle(); return ensureData(data as SavedTrip | null, error); }
export const toSavedTripInput = (trip: ForgedTrip): SavedTripInput => ({ title: `${trip.destination.name} route`, destination: trip.destination.name, startDate: trip.plan.startDate, endDate: trip.plan.endDate, travelerCount: trip.plan.adults + trip.plan.children, budget: trip.budget.total, itineraryJson: trip });
