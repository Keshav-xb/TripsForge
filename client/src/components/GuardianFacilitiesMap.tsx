import { useEffect, useRef, useState } from "react";
import { Crosshair, Hospital, Loader2, MapPin, Phone, ShieldAlert } from "lucide-react";
import { MapView } from "@/components/Map";
import type { Destination } from "@/lib/tripData";

type Facility = google.maps.places.PlaceResult & { place_id: string; name: string };
type Props = { destination: Destination; userLocation?: google.maps.LatLngLiteral | null };
const facilityTypes = [
  { id: "hospital", label: "Hospitals", icon: Hospital },
  { id: "police", label: "Police", icon: ShieldAlert },
  { id: "pharmacy", label: "Pharmacies", icon: Crosshair },
] as const;

export default function GuardianFacilitiesMap({ destination, userLocation }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const serviceRef = useRef<google.maps.places.PlacesService | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [type, setType] = useState<(typeof facilityTypes)[number]["id"]>("hospital");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState(false);

  const clearMarkers = () => { markersRef.current.forEach(marker => { marker.map = null; }); markersRef.current = []; };
  const search = (nextType = type) => {
    const service = serviceRef.current;
    const map = mapRef.current;
    if (!service || !map) return;
    setLoading(true);
    const center = userLocation ?? destination.location;
    service.nearbySearch({ location: center, radius: 10000, type: nextType }, (results, status) => {
      setLoading(false);
      const next = status === google.maps.places.PlacesServiceStatus.OK ? (results ?? []).filter((place): place is Facility => Boolean(place.place_id && place.name && place.geometry?.location)).slice(0, 8) : [];
      setFacilities(next); clearMarkers();
      if (!window.google?.maps.marker) return;
      next.forEach(place => {
        const marker = new google.maps.marker.AdvancedMarkerElement({ map, position: place.geometry!.location, title: place.name });
        marker.addListener("click", () => { if (place.geometry?.location) { map.panTo(place.geometry.location); map.setZoom(15); } });
        markersRef.current.push(marker);
      });
    });
  };

  useEffect(() => { if (serviceRef.current) search(); }, [userLocation]);
  if (mapError) return <div className="grid min-h-[320px] place-items-center rounded-3xl bg-[#eef3ed] p-8 text-center"><div><MapPin className="mx-auto h-8 w-8 text-[#e6651b]" /><p className="mt-3 font-bold text-[#123a35]">The facilities map is unavailable right now.</p><p className="mt-1 text-sm text-[#698079]">Use the destination address or your local emergency directory instead.</p></div></div>;

  return <div className="relative overflow-hidden rounded-3xl border border-[#123a35]/10 bg-[#eaf1ed]">
    <MapView initialCenter={userLocation ?? destination.location} initialZoom={12} onMapError={() => setMapError(true)} onMapReady={map => { mapRef.current = map; serviceRef.current = new google.maps.places.PlacesService(map); new google.maps.marker.AdvancedMarkerElement({ map, position: destination.location, title: destination.name }); if (userLocation) new google.maps.marker.AdvancedMarkerElement({ map, position: userLocation, title: "Your shared location" }); search(); }} className="h-[380px] sm:h-[440px]" />
    <div className="absolute inset-x-3 top-3 flex gap-2 overflow-x-auto pb-1 sm:left-4 sm:right-4 sm:top-4">{facilityTypes.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setType(id); search(id); }} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black shadow-sm ${type === id ? "border-[#123a35] bg-[#123a35] text-white" : "border-[#123a35]/10 bg-[#fffdf8]/95 text-[#315d56]"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
    {loading && <div className="absolute right-4 top-16 flex items-center gap-2 rounded-full bg-[#123a35]/95 px-3 py-2 text-xs font-bold text-white"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#ffb34b]" />Searching nearby</div>}
    {facilities.length > 0 && <div className="absolute bottom-3 left-3 right-3 flex gap-2 overflow-x-auto pb-1 sm:bottom-4 sm:left-4 sm:right-4">{facilities.slice(0, 4).map(place => <div key={place.place_id} className="min-w-[190px] rounded-2xl border border-[#123a35]/10 bg-[#fffdf8]/95 p-3 shadow-lg backdrop-blur"><p className="truncate text-sm font-black text-[#123a35]">{place.name}</p><p className="mt-1 truncate text-[11px] text-[#698079]">{place.vicinity || place.formatted_address || "Address unavailable"}</p>{place.formatted_phone_number && <a href={`tel:${place.formatted_phone_number}`} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#e6651b]"><Phone className="h-3 w-3" />Call</a>}</div>)}</div>}
  </div>;
}
