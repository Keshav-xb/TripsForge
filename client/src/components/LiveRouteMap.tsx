import { MapPinned } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MapView } from "@/components/Map";
import RouteMap from "@/components/RouteMap";
import type { Activity, Destination } from "@/lib/tripData";

type LiveRouteMapProps = {
  destination: Destination;
  activities: Activity[];
  selectedId?: string;
  onSelect: (activityId: string) => void;
  route?: { available: boolean; distanceKm?: number; duration?: string; mapImage?: string | null };
};

export default function LiveRouteMap({ destination, activities, selectedId, onSelect, route }: LiveRouteMapProps) {
  const [mapError, setMapError] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const selectedActivity = activities.find(activity => activity.id === selectedId);
    if (mapRef.current && selectedActivity?.location) {
      mapRef.current.panTo(selectedActivity.location);
    }
  }, [activities, selectedId]);

  if (mapError) {
    return <RouteMap destination={destination} activities={activities} selectedId={selectedId} onSelect={onSelect} isFallback />;
  }

  return (
    <section className="relative mt-0 overflow-hidden rounded-[1.5rem] border border-[#123a35]/10 bg-[#eaf1ed] shadow-[0_18px_35px_-30px_rgba(18,58,53,.45)]" aria-label={`Interactive route map for ${destination.name}`}>
      <MapView
        key={destination.name}
        initialCenter={destination.location}
        initialZoom={destination.name === "Kerala" ? 9 : 12}
        onMapError={() => setMapError(true)}
        onMapReady={map => {
          mapRef.current = map;
          const googleMaps = window.google;
          if (!googleMaps?.maps.marker) return;

          const bounds = new googleMaps.maps.LatLngBounds();
          bounds.extend(destination.location);
          new googleMaps.maps.marker.AdvancedMarkerElement({
            map,
            position: destination.location,
            title: `${destination.name}, ${destination.region}`,
          });

          activities.forEach(activity => {
            if (!activity.location) return;
            bounds.extend(activity.location);
            const marker = new googleMaps.maps.marker.AdvancedMarkerElement({ map, position: activity.location, title: activity.title });
            marker.addListener("click", () => onSelect(activity.id));
          });

          if (activities.some(activity => activity.location)) map.fitBounds(bounds, 64);
        }}
        className="h-[410px]"
      />
      <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-[#fffdf8]/95 px-3 py-2 text-xs font-bold text-[#123a35] shadow-sm"><span className="flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-[#e6651b]" />{route?.available && route.distanceKm ? `Live road route · ${route.distanceKm} km` : `${destination.name} route map`}</span></div>
      <div className="pointer-events-none absolute bottom-4 left-4 max-w-[250px] rounded-2xl bg-[#123a35]/95 p-4 text-white shadow-lg"><p className="atlas-label text-[#ffb34b]">Interactive route</p><p className="mt-2 text-sm leading-5 text-[#e0ebe4]">Zoom, pan, or open Street View to explore {destination.name}. Select a route stop to focus it in the itinerary.</p></div>
    </section>
  );
}
