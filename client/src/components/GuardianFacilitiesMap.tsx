import { useEffect, useMemo, useState } from "react";
import { Crosshair, Hospital, Loader2, MapPin, ShieldAlert, Sparkles } from "lucide-react";
import { MapView, type MapMarker } from "@/components/Map";
import type { Destination } from "@/lib/tripData";

type Props = { destination: Destination; userLocation?: { lat: number; lng: number } | null };
type FacilityType = "hospital" | "police" | "pharmacy" | "attraction";
type NearbyPlace = {
  id: string;
  name: string;
  address?: string;
  category: string;
  location: { lat: number; lng: number };
  source: string;
};
const facilityTypes: { id: FacilityType; label: string; icon: typeof Hospital }[] = [
  { id: "hospital", label: "Hospitals", icon: Hospital },
  { id: "police", label: "Police", icon: ShieldAlert },
  { id: "pharmacy", label: "Pharmacies", icon: Crosshair },
  { id: "attraction", label: "Attractions", icon: Sparkles },
];

export default function GuardianFacilitiesMap({ destination, userLocation }: Props) {
  const [type, setType] = useState<FacilityType>("hospital");
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const center = userLocation ?? destination.location;

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const input = encodeURIComponent(JSON.stringify({ json: {
          lat: center.lat, lng: center.lng, category: type, radius: 5000,
        } }));
        const response = await fetch(`/api/trpc/places.nearby?input=${input}`, { signal: controller.signal });
        const payload = await response.json() as {
          result?: { data?: { json?: { places?: NearbyPlace[] } } };
          error?: { json?: { message?: string } };
        };
        if (!response.ok) throw new Error(payload.error?.json?.message ?? "PLACE_SEARCH_FAILED");
        setPlaces(payload.result?.data?.json?.places ?? []);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setPlaces([]);
          setError(cause instanceof Error ? cause.message : "PLACE_SEARCH_FAILED");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [center.lat, center.lng, type]);

  const markers = useMemo<MapMarker[]>(() => [
    ...places.map(place => ({
      id: place.id,
      label: place.name,
      position: place.location,
      description: place.address || "Mapped from OpenStreetMap data",
    })),
  ], [places]);

  return (
    <div className="overflow-hidden rounded-3xl border border-[#123a35]/10 bg-[#fffdf8]">
      <div className="relative bg-[#eaf1ed]">
        <MapView initialCenter={center} initialZoom={14} markers={markers} className="h-[380px] sm:h-[440px]" />
        <div className="absolute inset-x-3 top-3 flex gap-2 overflow-x-auto pb-1 sm:left-4 sm:right-4 sm:top-4">
          {facilityTypes.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setType(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black shadow-sm ${type === id ? "border-[#123a35] bg-[#123a35] text-white" : "border-[#123a35]/10 bg-[#fffdf8]/95 text-[#315d56]"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
        </div>
        <div className="absolute bottom-3 left-3 rounded-xl bg-[#123a35]/95 px-3 py-2 text-xs font-bold text-white shadow-sm">
          {loading ? "Finding nearby places…" : `${places.length} places found · within 5 km`}
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-[#123a35]">Nearby {facilityTypes.find(item => item.id === type)?.label.toLowerCase()}</h3>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#e6651b]" /> : <span className="text-[11px] font-semibold text-[#6d847d]">OpenStreetMap data</span>}
        </div>
        {error ? (
          <p className="rounded-xl bg-[#fff3e9] p-3 text-xs font-semibold text-[#8a4d2b]">Nearby search is temporarily unavailable. Please try again shortly.</p>
        ) : places.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {places.slice(0, 8).map(place => (
              <div key={place.id} className="flex min-w-0 items-start gap-2 rounded-xl border border-[#123a35]/10 p-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#e6651b]" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#123a35]">{place.name}</p>
                  <p className="mt-1 truncate text-[11px] text-[#6d847d]">{place.address || "Location available on map"}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-[#f3f5f1] p-3 text-xs font-medium text-[#6d847d]">{loading ? "Searching OpenStreetMap…" : "No named places found in this area. Try another category or location."}</p>
        )}
        <p className="mt-3 text-[10px] leading-4 text-[#82938d]">Community-maintained OpenStreetMap data. Results may be incomplete and are not an emergency dispatch service.</p>
      </div>
    </div>
  );
}
