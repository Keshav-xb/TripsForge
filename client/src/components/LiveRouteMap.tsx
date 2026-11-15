import { useCallback, useMemo } from "react";
import { MapPinned } from "lucide-react";
import { MapView, type MapMarker } from "@/components/Map";
import type { Activity, Destination, DiscoveredPlace } from "@/lib/tripData";

type LiveRouteMapProps = {
  destination: Destination;
  activities: Activity[];
  selectedId?: string;
  onSelect: (activityId: string) => void;
  onPlacesDiscovered?: (places: DiscoveredPlace[]) => void;
  route?: { available: boolean; distanceKm?: number; duration?: string; geometry?: string | null; mode?: "driving" | "walking" | "bicycling"; resolvedStops?: Array<{ id?: string; title: string; location?: { lat: number; lng: number }; geocoded?: boolean; formattedAddress?: string }> };
  mode?: "driving" | "walking" | "bicycling";
  onModeChange?: (mode: "driving" | "walking" | "bicycling") => void;
};

export default function LiveRouteMap({ destination, activities, selectedId, onSelect, route, mode = "driving", onModeChange }: LiveRouteMapProps) {
  const markers = useMemo<MapMarker[]>(() => activities.flatMap(activity => {
    const resolved = route?.resolvedStops?.find(stop => stop.id === activity.id || (!stop.id && stop.title === activity.title));
    const position = resolved?.location ?? activity.location;
    return position ? [{
      id: activity.id,
      label: activity.title,
      position,
      description: [activity.time, activity.description, resolved?.formattedAddress].filter(Boolean).join(" · "),
    }] : [];
  }), [activities, route?.resolvedStops]);
  const handleMarkerClick = useCallback((id: string) => onSelect(id), [onSelect]);

  return (
    <section className="relative mt-0 overflow-hidden rounded-[1.5rem] border border-[#123a35]/10 bg-[#eaf1ed] shadow-[0_18px_35px_-30px_rgba(18,58,53,.45)]" aria-label={`Map for ${destination.name}`}>
      <MapView
        key={destination.name}
        initialCenter={destination.location}
        initialZoom={destination.name === "Kerala" ? 9 : 12}
        markers={markers}
        routeGeometry={route?.available ? route.geometry : null}
        selectedMarkerId={selectedId}
        onMarkerClick={handleMarkerClick}
        className="h-[560px] sm:h-[620px]"
      />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-[#fffdf8]/95 px-3 py-2 text-xs font-bold text-[#123a35] shadow-sm">
        <MapPinned className="h-3.5 w-3.5 text-[#e6651b]" /> Interactive map · {destination.name}
      </div>
      <div className="absolute right-3 top-3 flex gap-1 rounded-full bg-[#fffdf8]/95 p-1 shadow-sm">
        {(["driving", "walking", "bicycling"] as const).map(item => (
          <button key={item} type="button" onClick={() => onModeChange?.(item)} className={`rounded-full px-3 py-1.5 text-[11px] font-black capitalize ${mode === item ? "bg-[#123a35] text-white" : "text-[#55736b]"}`}>{item}</button>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 rounded-xl bg-[#123a35]/95 px-3 py-2 text-xs font-bold text-white shadow-sm">
        {route?.available && route.distanceKm ? `${route.distanceKm} km · ${route.duration ?? "route estimate"}` : route?.resolvedStops?.length ? `${markers.length} of ${activities.length} itinerary stops mapped` : markers.length ? `${markers.length} itinerary stops · select a pin for details` : "Map view · resolving itinerary stops"}
      </div>
    </section>
  );
}
