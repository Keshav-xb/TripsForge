import { supabase } from "@/lib/supabase";
import { routeFromRow, SAMPLE_ROUTES, type RouteRecord } from "@/lib/routeData";

export async function listExploreRoutes(): Promise<{ routes: RouteRecord[]; source: "supabase" | "sample" }> {
  const { data, error } = await supabase
    .from("travel_routes")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) return { routes: SAMPLE_ROUTES, source: "sample" };
  return { routes: data.map((row) => routeFromRow(row as Record<string, unknown>)), source: "supabase" };
}

export async function getExploreRoute(slug: string): Promise<{ route: RouteRecord | null; source: "supabase" | "sample" }> {
  const { data, error } = await supabase.from("travel_routes").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  if (!error && data) return { route: routeFromRow(data as Record<string, unknown>), source: "supabase" };
  return { route: SAMPLE_ROUTES.find((item) => item.slug === slug) ?? null, source: "sample" };
}
