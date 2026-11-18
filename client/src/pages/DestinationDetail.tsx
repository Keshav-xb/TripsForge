import { ArrowLeft, Compass, ExternalLink, MapPin, Navigation, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { MapView, type MapMarker } from "@/components/Map";
import { useTrip } from "@/contexts/TripContext";
import { defaultPlan } from "@/lib/tripData";

type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  location: { lat: number; lng: number };
  source: string;
};
type NearbyResponse = {
  result?: { data?: { json?: { provider?: string; retrievedAt?: string; places?: Place[] } } };
  error?: { json?: { message?: string } };
};

export default function DestinationDetail() {
  const [, setLocation] = useLocation();
  const { forgeTrip } = useTrip();
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name") ?? "Selected destination";
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retrievedAt, setRetrievedAt] = useState("");

  const loadNearby = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const input = encodeURIComponent(JSON.stringify({ json: { lat, lng, category: "attraction", radius: 5000 } }));
      const response = await fetch(`/api/trpc/places.nearby?input=${input}`);
      if (!response.ok) throw new Error(`Nearby places request failed (${response.status})`);
      const payload = await response.json() as NearbyResponse;
      if (payload.error) throw new Error(payload.error.json?.message ?? "Nearby places are unavailable");
      const data = payload.result?.data?.json;
      setPlaces(data?.places ?? []);
      setRetrievedAt(data?.retrievedAt ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nearby places are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [valid, lat, lng]);

  useEffect(() => { void loadNearby(); }, [loadNearby]);

  const markers = useMemo<MapMarker[]>(() => [
    { id: "destination", label: name, position: { lat, lng }, description: "Selected destination" },
    ...places.map(place => ({ id: place.id, label: place.name, position: place.location, description: place.category })),
  ], [name, lat, lng, places]);

  if (!valid) {
    return <div className="min-h-screen bg-[#fffdf8] text-[#123a35]"><SiteHeader /><main className="mx-auto max-w-3xl px-5 py-20"><h1 className="font-display text-4xl">Destination coordinates missing</h1><p className="mt-4 text-[#637e76]">Return to Explore and select a destination again.</p><button onClick={() => setLocation("/explore")} className="mt-6 rounded-xl bg-[#123a35] px-5 py-3 font-bold text-white">Back to Explore</button></main><SiteFooter /></div>;
  }

  return (
    <div className="min-h-screen bg-[#fffdf8] text-[#123a35]">
      <SiteHeader />
      <main>
        <section className="bg-[#f2eddf] px-5 py-10 lg:px-10 lg:py-16">
          <div className="mx-auto max-w-[1440px]">
            <button onClick={() => setLocation("/explore")} className="inline-flex items-center gap-2 text-sm font-bold text-[#56716a] hover:text-[#e6651b]"><ArrowLeft className="h-4 w-4" /> Back to World Explorer</button>
            <p className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#e6651b]"><Compass className="h-4 w-4" /> Destination intelligence</p>
            <h1 className="mt-4 max-w-4xl break-words font-display text-5xl leading-[.95] tracking-[-.06em] sm:text-7xl">{name}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#5d7771]">Explore the location, inspect nearby mapped attractions and start planning a trip around this destination.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-[#496961]">
              <span className="rounded-full bg-white/75 px-3 py-2">Latitude {lat.toFixed(4)}</span>
              <span className="rounded-full bg-white/75 px-3 py-2">Longitude {lng.toFixed(4)}</span>
              <span className="rounded-full bg-white/75 px-3 py-2">Map data: OpenStreetMap</span>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-[1440px] gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)] lg:px-10 lg:py-12">
          <div className="overflow-hidden rounded-[1.7rem] border border-[#123a35]/10 bg-white">
            <div className="flex items-center justify-between border-b border-[#123a35]/10 px-4 py-4"><h2 className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-[#e6651b]" /> Destination map</h2><span className="text-[10px] font-bold uppercase tracking-wider text-[#71857e]">OpenStreetMap</span></div>
            <MapView initialCenter={{ lat, lng }} initialZoom={13} markers={markers} className="h-[420px] sm:h-[580px]" />
            <p className="border-t border-[#123a35]/10 px-4 py-3 text-xs text-[#71857e]">Map data © OpenStreetMap contributors.</p>
          </div>
          <aside className="space-y-5">
            <div className="rounded-[1.7rem] border border-[#123a35]/10 bg-white p-5 sm:p-6">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#e6651b]"><Sparkles className="h-4 w-4" /> Explore nearby</p>
              <h2 className="mt-3 font-display text-3xl tracking-[-.05em]">Places around here</h2>
              <p className="mt-2 text-sm leading-6 text-[#637e76]">Mapped attractions and points of interest within approximately 5 km. Coverage depends on OpenStreetMap contributions.</p>
              <button onClick={() => void loadNearby()} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#123a35]/15 px-4 py-2.5 text-sm font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh nearby places</button>
              {loading && <p className="mt-4 text-sm text-[#71857e]">Finding mapped attractions…</p>}
              {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff2e9] p-3 text-sm text-[#8a4f3d]">{error}</p>}
              {!loading && !error && places.length === 0 && <p className="mt-4 rounded-xl bg-[#f2eddf] p-3 text-sm leading-6 text-[#637e76]">No mapped attractions were returned for this area. Try refreshing or explore the map.</p>}
              <div className="mt-4 divide-y divide-[#123a35]/10">
                {places.map(place => <div key={place.id} className="py-3 first:pt-0">
                  <p className="font-bold">{place.name}</p>
                  <p className="mt-1 text-xs text-[#71857e]">{place.address || place.category}</p>
                  <a className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#c65a1d]" href={`https://www.openstreetmap.org/?mlat=${place.location.lat}&mlon=${place.location.lng}#map=17/${place.location.lat}/${place.location.lng}`} target="_blank" rel="noreferrer">View on OpenStreetMap <ExternalLink className="h-3 w-3" /></a>
                </div>)}
              </div>
              {retrievedAt && <p className="mt-3 text-[10px] text-[#8a9a94]">Data retrieved {new Date(retrievedAt).toLocaleString()}</p>}
            </div>
            <div className="rounded-[1.7rem] bg-[#123a35] p-5 text-white sm:p-6">
              <p className="text-xs font-black uppercase tracking-[.16em] text-[#ffbd70]">Ready when you are</p>
              <h2 className="mt-3 font-display text-3xl">Make this your next journey.</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">Build an itinerary around this destination and tailor it to your dates and travel style.</p>
              <button onClick={() => { forgeTrip({ ...defaultPlan, destination: name, destinationLocation: { lat, lng } }); setLocation("/planner"); }} className="mt-5 inline-flex w-full items-center justify-between rounded-xl bg-[#ffbd70] px-4 py-3 font-bold text-[#123a35]">Plan a trip here <Navigation className="h-4 w-4" /></button>
            </div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
