import { LocateFixed, MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import { MapView } from "@/components/Map";
import type { Destination } from "@/lib/tripData";

type Props = { destination: Destination };

export default function SelectedLocationMap({ destination }: Props) {
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  if (mapError) {
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] border border-[#123a35]/10 bg-[#dceae1] p-5 shadow-[0_18px_35px_-30px_rgba(18,58,53,.45)]" aria-label={`Selected location for ${destination.name}`}>
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(18,58,53,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(18,58,53,.08) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
        <div className="relative flex min-h-[280px] flex-col justify-between rounded-2xl border border-[#123a35]/10 bg-[#fffdf8]/75 p-5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-[#e6651b]"><MapPin className="h-4 w-4" /> Selected location</div>
          <div>
            <h3 className="font-display text-3xl tracking-[-.05em] text-[#123a35]">{destination.name}, {destination.region}</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#5d7771]">Map preview is unavailable right now, but your selected destination is still saved for the itinerary.</p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#123a35] px-3 py-2 text-xs font-bold text-white"><LocateFixed className="h-3.5 w-3.5 text-[#ffb34b]" /> {destination.location.lat.toFixed(4)}, {destination.location.lng.toFixed(4)}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[#123a35]/10 bg-[#eaf1ed] shadow-[0_18px_35px_-30px_rgba(18,58,53,.45)]" aria-label={`Map centered on ${destination.name}`}>
      <MapView
        key={destination.name}
        initialCenter={destination.location}
        initialZoom={destination.name === "Kerala" ? 9 : 12}
        onMapReady={(map) => {
          setReady(true);
          map.setCenter(destination.location);
          const googleMaps = window.google;
          if (!googleMaps) return;
          const marker = new googleMaps.maps.marker.AdvancedMarkerElement({
            map,
            position: destination.location,
            title: `${destination.name}, ${destination.region}`,
          });
          void marker;
        }}
        onMapError={() => setMapError(true)}
        className="h-[330px] sm:h-[390px]"
      />
      {!ready && <div className="absolute inset-0 grid place-items-center bg-[#eaf1ed]/85"><div className="rounded-full bg-[#fffdf8]/95 px-4 py-2 text-xs font-bold text-[#315d56] shadow-sm">Locating {destination.name}…</div></div>}
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-[#fffdf8]/95 px-3 py-2 text-xs font-bold text-[#123a35] shadow-sm"><Navigation className="h-3.5 w-3.5 text-[#e6651b]" /> {destination.name}, {destination.region}</div>
      <div className="absolute bottom-4 left-4 max-w-[250px] rounded-2xl bg-[#123a35]/95 p-4 text-white shadow-lg"><p className="atlas-label text-[#ffb34b]">Selected location</p><p className="mt-2 text-sm leading-5 text-[#e0ebe4]">The map is centered on your chosen destination. Zoom, pan or open Street View to explore it.</p></div>
    </section>
  );
}
