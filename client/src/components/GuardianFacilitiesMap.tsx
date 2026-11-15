import { useState } from "react";
import { Crosshair, Hospital, MapPin, ShieldAlert } from "lucide-react";
import { MapView } from "@/components/Map";
import type { Destination } from "@/lib/tripData";

type Props = { destination: Destination; userLocation?: { lat: number; lng: number } | null };
const facilityTypes = [
  { id: "hospital", label: "Hospitals", icon: Hospital },
  { id: "police", label: "Police", icon: ShieldAlert },
  { id: "pharmacy", label: "Pharmacies", icon: Crosshair },
] as const;

export default function GuardianFacilitiesMap({ destination, userLocation }: Props) {
  const [type, setType] = useState<(typeof facilityTypes)[number]["id"]>("hospital");
  const center = userLocation ?? destination.location;
  const searchUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(type + " near " + destination.name)}`;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#123a35]/10 bg-[#eaf1ed]">
      <MapView initialCenter={center} initialZoom={13} className="h-[380px] sm:h-[440px]" />
      <div className="absolute inset-x-3 top-3 flex gap-2 overflow-x-auto pb-1 sm:left-4 sm:right-4 sm:top-4">
        {facilityTypes.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setType(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black shadow-sm ${type === id ? "border-[#123a35] bg-[#123a35] text-white" : "border-[#123a35]/10 bg-[#fffdf8]/95 text-[#315d56]"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
      </div>
      <a href={searchUrl} target="_blank" rel="noreferrer" className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-xl bg-[#123a35]/95 px-3 py-2 text-xs font-bold text-white shadow-sm"><MapPin className="h-4 w-4 text-[#ffb34b]" /> Find {type} in OpenStreetMap</a>
    </div>
  );
}
