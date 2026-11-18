import { ArrowRight, Compass, Globe2, MapPin, Search, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useLocation } from "wouter";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import LocationSearch from "@/components/LocationSearch";
import { MapView, type MapMarker } from "@/components/Map";
import { useTrip } from "@/contexts/TripContext";
import { defaultPlan } from "@/lib/tripData";

type SelectedPlace = {
  label: string;
  lat: number;
  lng: number;
  placeId?: string;
};

const WORLD_CENTER = { lat: 20, lng: 0 };

export default function Explore() {
  const [searchValue, setSearchValue] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [mapError, setMapError] = useState(false);
  const { forgeTrip } = useTrip();
  const [, setLocation] = useLocation();

  const markers = useMemo<MapMarker[]>(
    () =>
      selectedPlace
        ? [{
            id: selectedPlace.placeId ?? selectedPlace.label,
            label: selectedPlace.label,
            position: { lat: selectedPlace.lat, lng: selectedPlace.lng },
            description: "Selected destination",
          }]
        : [],
    [selectedPlace]
  );

  const handleMapError = useCallback(() => setMapError(true), []);

  const selectPlace = (place: SelectedPlace) => {
    setSelectedPlace(place);
    setSearchValue(place.label);
    setMapError(false);
  };

  const planDestination = () => {
    if (!selectedPlace) return;
    forgeTrip({
      ...defaultPlan,
      destination: selectedPlace.label,
      destinationLocation: { lat: selectedPlace.lat, lng: selectedPlace.lng },
    });
    setLocation(`/journey?name=${encodeURIComponent(selectedPlace.label)}&lat=${selectedPlace.lat}&lng=${selectedPlace.lng}`);
  };

  return (
    <div className="min-h-screen bg-[#fffdf8] text-[#123a35]">
      <SiteHeader />
      <main>
        <section className="border-b border-[#123a35]/10 bg-[#f2eddf] px-5 py-14 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1440px]">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#e6651b]">
              <Globe2 className="h-4 w-4" /> TripsForge · World Explorer
            </p>
            <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[.94] tracking-[-.07em] sm:text-7xl">
              The world is your <em>starting point.</em>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5d7771]">
              Search for a city, country, town or landmark. Select a real place to locate it on the map and start planning from there.
            </p>
            <div className="relative z-[1000] mt-8 max-w-2xl rounded-[1.5rem] border border-[#123a35]/10 bg-[#fffdf8] p-4 shadow-[0_18px_50px_-38px_rgba(18,58,53,.6)] sm:p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#123a35]">
                <Search className="h-4 w-4 text-[#e6651b]" /> Search anywhere
              </div>
              <LocationSearch
                label="Destination"
                value={searchValue}
                placeholder="Try Tokyo, Paris, Jammu or Bali"
                onChange={value => {
                  setSearchValue(value);
                  setSelectedPlace(null);
                }}
                onSelect={selectPlace}
              />
              <p className="mt-3 text-xs leading-5 text-[#71857e]">
                Search results and coordinates are provided by OpenStreetMap / Photon. Coverage and detail depend on provider data.
              </p>
            </div>
          </div>
        </section>

        <section className="relative z-0 px-5 py-8 lg:px-10 lg:py-12">
          <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
            <div className="overflow-hidden rounded-[1.7rem] border border-[#123a35]/10 bg-[#eaf1ed]">
              <div className="flex items-center justify-between gap-3 border-b border-[#123a35]/10 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-black text-[#123a35]">
                  <Compass className="h-4 w-4 text-[#e6651b]" /> Interactive world map
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#71857e]">OpenStreetMap</span>
              </div>
              {mapError ? (
                <div className="grid min-h-[420px] place-items-center px-6 text-center">
                  <div>
                    <MapPin className="mx-auto h-8 w-8 text-[#e6651b]" />
                    <p className="mt-3 font-bold">The map could not load.</p>
                    <p className="mt-1 text-sm text-[#71857e]">Check your connection and try refreshing this page.</p>
                  </div>
                </div>
              ) : (
                <MapView
                  initialCenter={selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng } : WORLD_CENTER}
                  initialZoom={selectedPlace ? 11 : 2}
                  markers={markers}
                  onMapError={handleMapError}
                  className="h-[420px] sm:h-[560px]"
                />
              )}
              <div className="border-t border-[#123a35]/10 bg-white px-4 py-3 text-xs leading-5 text-[#71857e]">
                Map data © OpenStreetMap contributors. The map starts at a global view and zooms to your selected destination.
              </div>
            </div>

            <aside className="rounded-[1.7rem] border border-[#123a35]/10 bg-white p-5 sm:p-6">
              {selectedPlace ? (
                <>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#e6651b]">
                    <Sparkles className="h-4 w-4" /> Destination selected
                  </p>
                  <h2 className="mt-4 break-words font-display text-3xl leading-tight tracking-[-.05em]">{selectedPlace.label}</h2>
                  <div className="mt-6 rounded-2xl bg-[#f2eddf] p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#355b53]">
                      <MapPin className="h-4 w-4 text-[#e6651b]" /> Resolved location
                    </div>
                    <p className="mt-3 text-xs text-[#71857e]">Latitude</p>
                    <p className="font-mono text-sm font-bold">{selectedPlace.lat.toFixed(5)}</p>
                    <p className="mt-2 text-xs text-[#71857e]">Longitude</p>
                    <p className="font-mono text-sm font-bold">{selectedPlace.lng.toFixed(5)}</p>
                  </div>
                  <p className="mt-5 text-sm leading-6 text-[#637e76]">
                    This place has been resolved to geographic coordinates. You can pass it into the trip planner as your destination.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLocation(`/destination?name=${encodeURIComponent(selectedPlace.label)}&lat=${selectedPlace.lat}&lng=${selectedPlace.lng}`)}
                    className="mt-6 inline-flex w-full items-center justify-between rounded-xl border border-[#123a35]/15 px-4 py-3.5 text-sm font-bold text-[#123a35] hover:border-[#e6651b]"
                  >
                    Explore destination <Compass className="h-4 w-4 text-[#e6651b]" />
                  </button>
                  <button
                    type="button"
                    onClick={planDestination}
                    className="mt-6 inline-flex w-full items-center justify-between rounded-xl bg-[#123a35] px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#1d514a]"
                  >
                    Plan this destination <ArrowRight className="h-4 w-4 text-[#ffb34b]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedPlace(null); setSearchValue(""); }}
                    className="mt-3 w-full rounded-xl border border-[#123a35]/15 px-4 py-3 text-sm font-bold text-[#56716a] hover:border-[#e6651b]"
                  >
                    Clear selection
                  </button>
                </>
              ) : (
                <div className="flex min-h-[340px] flex-col justify-center">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f2eddf]">
                    <Globe2 className="h-6 w-6 text-[#e6651b]" />
                  </div>
                  <h2 className="mt-5 font-display text-3xl tracking-[-.05em]">Choose a place to explore.</h2>
                  <p className="mt-3 text-sm leading-6 text-[#637e76]">
                    Search above and select a result. TripsForge will show its resolved location here and move the map to it.
                  </p>
                  <div className="mt-6 rounded-2xl bg-[#f2eddf] p-4 text-sm leading-6 text-[#496961]">
                    <strong>What works in this milestone</strong>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>Worldwide place search through the configured provider.</li>
                      <li>Map preview of the selected location.</li>
                      <li>Carry the selected destination into Journey Studio.</li>
                    </ul>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
