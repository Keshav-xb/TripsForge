import { MapPinned } from "lucide-react";
import { MapView } from "@/components/Map";
import RouteMap from "@/components/RouteMap";
import type { Activity, Destination, DiscoveredPlace } from "@/lib/tripData";

type LiveRouteMapProps = {
  destination: Destination;
  activities: Activity[];
  selectedId?: string;
  onSelect: (activityId: string) => void;
  onPlacesDiscovered?: (places: DiscoveredPlace[]) => void;
  route?: { available: boolean; distanceKm?: number; duration?: string; geometry?: string | null; mode?: "driving" | "walking" | "bicycling" };
  mode?: "driving" | "walking" | "bicycling";
  onModeChange?: (mode: "driving" | "walking" | "bicycling") => void;
};

export default function LiveRouteMap({ destination, activities, selectedId, onSelect, route, mode = "driving", onModeChange }: LiveRouteMapProps) {
  return (
    <section className="relative mt-0 overflow-hidden rounded-[1.5rem] border border-[#123a35]/10 bg-[#eaf1ed] shadow-[0_18px_35px_-30px_rgba(18,58,53,.45)]" aria-label={`Map for ${destination.name}`}>
      <MapView key={destination.name} initialCenter={destination.location} initialZoom={destination.name === "Kerala" ? 9 : 12} className="h-[560px] sm:h-[620px]" />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-[#fffdf8]/95 px-3 py-2 text-xs font-bold text-[#123a35] shadow-sm">
        <MapPinned className="h-3.5 w-3.5 text-[#e6651b]" /> OpenStreetMap · {destination.name}
      </div>
      <div className="absolute right-3 top-3 flex gap-1 rounded-full bg-[#fffdf8]/95 p-1 shadow-sm">
        {(["driving", "walking", "bicycling"] as const).map(item => (
          <button key={item} type="button" onClick={() => onModeChange?.(item)} className={`rounded-full px-3 py-1.5 text-[11px] font-black capitalize ${mode === item ? "bg-[#123a35] text-white" : "text-[#55736b]"}`}>{item}</button>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 rounded-xl bg-[#123a35]/95 px-3 py-2 text-xs font-bold text-white shadow-sm">
        {route?.available && route.distanceKm ? `${route.distanceKm} km · ${route.duration ?? "route estimate"}` : "Map view · route details shown in your itinerary"}
      </div>
      <div className="sr-only"><RouteMap destination={destination} activities={activities} selectedId={selectedId} onSelect={onSelect} /></div>
    </section>
  );
}
