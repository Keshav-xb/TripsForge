import { MapPin, Navigation } from "lucide-react";
import { MapView } from "@/components/Map";
import type { Destination } from "@/lib/tripData";

type Props = { destination: Destination };

export default function SelectedLocationMap({ destination }: Props) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[#123a35]/10 bg-[#eaf1ed] shadow-[0_18px_35px_-30px_rgba(18,58,53,.45)]" aria-label={`Map centered on ${destination.name}`}>
      <MapView key={destination.name} initialCenter={destination.location} initialZoom={destination.name === "Kerala" ? 9 : 12} className="h-[330px] sm:h-[390px]" />
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-[#fffdf8]/95 px-3 py-2 text-xs font-bold text-[#123a35] shadow-sm"><Navigation className="h-3.5 w-3.5 text-[#e6651b]" /> {destination.name}, {destination.region}</div>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-[#123a35]/95 p-3 text-xs font-bold text-white shadow-lg"><MapPin className="h-4 w-4 text-[#ffb34b]" /> OpenStreetMap</div>
    </section>
  );
}
