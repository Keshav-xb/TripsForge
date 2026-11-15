/// <reference types="@types/google.maps" />

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function loadMapScript() {
  return new Promise<boolean>(resolve => {
    if (!API_KEY) {
      console.error("VITE_GOOGLE_MAPS_API_KEY is not configured.");
      resolve(false);
      return;
    }

    if (window.google?.maps) {
      resolve(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-tripsforge-google-maps="true"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.tripsforgeGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  onMapError?: () => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  onMapError,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);

  const init = usePersistFn(async () => {
    const loaded = await loadMapScript();
    if (!loaded || !window.google) {
      onMapError?.();
      return;
    }
    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }
    map.current = new window.google.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: true,
      mapId: "DEMO_MAP_ID",
    });
    onMapReady?.(map.current);
  });

  useEffect(() => {
    void init();
  }, [init]);

  return <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />;
}
