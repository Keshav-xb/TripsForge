import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Point = { lat: number; lng: number };
const EMPTY_MARKERS: MapMarker[] = [];
export type MapMarker = { id: string; label: string; position: Point; description?: string };

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  fitBounds: (bounds: unknown, options?: { padding?: [number, number] }) => LeafletMap;
  remove: () => void;
};
type LeafletLayer = { addTo: (map: LeafletMap) => LeafletLayer; bindPopup: (content: string) => LeafletLayer; on: (event: string, callback: () => void) => LeafletLayer };
type LeafletApi = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => LeafletLayer;
  circleMarker: (point: [number, number], options: Record<string, unknown>) => LeafletLayer;
  polyline: (points: [number, number][], options: Record<string, unknown>) => LeafletLayer;
  latLngBounds: (points: [number, number][]) => unknown;
};
declare global { interface Window { L?: LeafletApi } }

interface MapViewProps {
  className?: string;
  initialCenter?: Point;
  initialZoom?: number;
  markers?: MapMarker[];
  routeGeometry?: string | null;
  selectedMarkerId?: string;
  onMarkerClick?: (id: string) => void;
  onMapError?: () => void;
}

let leafletLoader: Promise<void> | null = null;
function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("Map requires a browser"));
  if (window.L) return Promise.resolve();
  if (!leafletLoader) {
    leafletLoader = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.leafletCss = "true";
        document.head.appendChild(link);
      }
      const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet-js]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Leaflet failed to load")), { once: true });
        if (window.L) resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.dataset.leafletJs = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Leaflet failed to load"));
      document.body.appendChild(script);
    }).catch(error => { leafletLoader = null; throw error; });
  }
  return leafletLoader;
}

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let result = 0, shift = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** Interactive Leaflet map using OpenStreetMap tiles. No Google key or billing account required. */
export function MapView({
  className,
  initialCenter = { lat: 20, lng: 0 },
  initialZoom = 3,
  markers = EMPTY_MARKERS,
  routeGeometry,
  selectedMarkerId,
  onMarkerClick,
  onMapError,
}: MapViewProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    loadLeaflet().then(() => {
      if (cancelled || !elementRef.current || !window.L) return;
      const L = window.L;
      map = L.map(elementRef.current, { scrollWheelZoom: false, zoomControl: true }).setView([initialCenter.lat, initialCenter.lng], initialZoom);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const bounds: [number, number][] = [];
      if (routeGeometry) {
        const routePoints = decodePolyline(routeGeometry);
        if (routePoints.length > 1) {
          L.polyline(routePoints, { color: "#e6651b", weight: 5, opacity: 0.85, lineJoin: "round" }).addTo(map);
          bounds.push(...routePoints);
        }
      }
      markers.forEach((marker, index) => {
        const point: [number, number] = [marker.position.lat, marker.position.lng];
        bounds.push(point);
        const selected = marker.id === selectedMarkerId;
        const pin = L.circleMarker(point, {
          radius: selected ? 10 : 8,
          color: "#fffdf8",
          weight: 3,
          fillColor: selected ? "#123a35" : "#e6651b",
          fillOpacity: 1,
        }).addTo(map);
        pin.bindPopup(`<strong>${index + 1}. ${marker.label.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char))}</strong>${marker.description ? `<br/>${marker.description.replace(/[&<>"]/g, "")}` : ""}`);
        pin.on("click", () => onMarkerClick?.(marker.id));
      });
      if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32] });
    }).catch(() => { if (!cancelled) onMapError?.(); });
    return () => { cancelled = true; map?.remove(); mapRef.current = null; };
  }, [initialCenter.lat, initialCenter.lng, initialZoom, markers, routeGeometry, selectedMarkerId, onMarkerClick, onMapError]);

  return <div ref={elementRef} role="application" aria-label="Interactive OpenStreetMap map" className={cn("h-[500px] w-full bg-[#eaf1ed]", className)} />;
}
