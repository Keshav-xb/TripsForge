import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Point = { lat: number; lng: number };
interface MapViewProps {
  className?: string;
  initialCenter?: Point;
  initialZoom?: number;
  onMapReady?: (map: never) => void;
  onMapError?: () => void;
}

/** Lightweight, keyless OpenStreetMap view. The iframe uses OSM's public map embed. */
export function MapView({
  className,
  initialCenter = { lat: 20, lng: 0 },
  initialZoom = 3,
}: MapViewProps) {
  const src = useMemo(() => {
    const span = 360 / Math.pow(2, Math.max(1, Math.min(18, initialZoom))) * 3;
    const left = Math.max(-180, initialCenter.lng - span);
    const right = Math.min(180, initialCenter.lng + span);
    const bottom = Math.max(-85, initialCenter.lat - span / 2);
    const top = Math.min(85, initialCenter.lat + span / 2);
    const params = new URLSearchParams({
      bbox: `${left},${bottom},${right},${top}`,
      layer: "mapnik",
      marker: `${initialCenter.lat},${initialCenter.lng}`,
    });
    return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
  }, [initialCenter.lat, initialCenter.lng, initialZoom]);

  return (
    <iframe
      title="OpenStreetMap"
      src={src}
      className={cn("h-[500px] w-full border-0", className)}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
