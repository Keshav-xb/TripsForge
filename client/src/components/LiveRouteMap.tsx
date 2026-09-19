import { Coffee, Crosshair, Landmark, Loader2, MapPinned, Search, ShoppingBag, Star, Trees, Utensils, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { MapView } from "@/components/Map";
import RouteMap from "@/components/RouteMap";
import type { Activity, Destination } from "@/lib/tripData";

type LiveRouteMapProps = {
  destination: Destination;
  activities: Activity[];
  selectedId?: string;
  onSelect: (activityId: string) => void;
  route?: { available: boolean; distanceKm?: number; duration?: string; mapImage?: string | null };
};

type DiscoveryCategory = "restaurant" | "cafe" | "shopping_mall" | "tourist_attraction" | "park";

type DiscoveryPlace = google.maps.places.PlaceResult & {
  place_id: string;
  name: string;
};

const categories: { id: DiscoveryCategory; label: string; icon: typeof Utensils }[] = [
  { id: "restaurant", label: "Eat", icon: Utensils },
  { id: "cafe", label: "Coffee", icon: Coffee },
  { id: "shopping_mall", label: "Shop", icon: ShoppingBag },
  { id: "tourist_attraction", label: "See", icon: Landmark },
  { id: "park", label: "Outdoors", icon: Trees },
];

function formatPlaceMeta(place: DiscoveryPlace) {
  const parts = [place.rating ? `${place.rating.toFixed(1)}★` : null, place.user_ratings_total ? `${place.user_ratings_total.toLocaleString()} reviews` : null, place.price_level ? "₹".repeat(place.price_level) : null].filter(Boolean);
  return parts.join(" · ");
}

export default function LiveRouteMap({ destination, activities, selectedId, onSelect, route }: LiveRouteMapProps) {
  const [mapError, setMapError] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<DiscoveryCategory>("restaurant");
  const [places, setPlaces] = useState<DiscoveryPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<DiscoveryPlace | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const placeMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const clearPlaceMarkers = () => {
    placeMarkersRef.current.forEach(marker => {
      marker.map = null;
    });
    placeMarkersRef.current = [];
  };

  const displayPlaces = (results: google.maps.places.PlaceResult[]) => {
    const validPlaces = results.filter((place): place is DiscoveryPlace => Boolean(place.place_id && place.name && place.geometry?.location));
    setPlaces(validPlaces.slice(0, 12));
    setSelectedPlace(null);
    clearPlaceMarkers();

    const googleMaps = window.google;
    const map = mapRef.current;
    if (!googleMaps?.maps.marker || !map) return;

    validPlaces.slice(0, 12).forEach((place, index) => {
      const marker = new googleMaps.maps.marker.AdvancedMarkerElement({ map, position: place.geometry!.location, title: place.name });
      marker.addListener("click", () => {
        setSelectedPlace(place);
        map.panTo(place.geometry!.location!);
        map.setZoom(Math.max(map.getZoom() ?? 13, 15));
      });
      placeMarkersRef.current.push(marker);
      if (index === 0) map.panTo(place.geometry!.location!);
    });
  };

  const searchPlaces = (nextQuery?: string, nextCategory: DiscoveryCategory = activeCategory) => {
    const service = placesServiceRef.current;
    const map = mapRef.current;
    if (!service || !map) return;

    setIsSearching(true);
    const trimmedQuery = (nextQuery ?? query).trim();
    const finish = (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
      setIsSearching(false);
      if (status === google.maps.places.PlacesServiceStatus.OK && results) displayPlaces(results);
      else displayPlaces([]);
    };

    if (trimmedQuery) {
      service.textSearch({ query: `${trimmedQuery} near ${destination.name}`, location: destination.location, radius: 8000 }, finish);
    } else {
      service.nearbySearch({ location: destination.location, radius: 5000, type: nextCategory }, finish);
    }
  };

  useEffect(() => {
    const selectedActivity = activities.find(activity => activity.id === selectedId);
    if (mapRef.current && selectedActivity?.location) mapRef.current.panTo(selectedActivity.location);
  }, [activities, selectedId]);

  if (mapError) {
    return <RouteMap destination={destination} activities={activities} selectedId={selectedId} onSelect={onSelect} isFallback />;
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    searchPlaces();
  };

  return (
    <section className="relative mt-0 overflow-hidden rounded-[1.5rem] border border-[#123a35]/10 bg-[#eaf1ed] shadow-[0_18px_35px_-30px_rgba(18,58,53,.45)]" aria-label={`Interactive route and place discovery map for ${destination.name}`}>
      <MapView
        key={destination.name}
        initialCenter={destination.location}
        initialZoom={destination.name === "Kerala" ? 9 : 12}
        onMapError={() => setMapError(true)}
        onMapReady={map => {
          mapRef.current = map;
          const googleMaps = window.google;
          if (!googleMaps?.maps.marker || !googleMaps.maps.places) return;
          placesServiceRef.current = new googleMaps.maps.places.PlacesService(map);

          const bounds = new googleMaps.maps.LatLngBounds();
          bounds.extend(destination.location);
          new googleMaps.maps.marker.AdvancedMarkerElement({ map, position: destination.location, title: `${destination.name}, ${destination.region}` });
          activities.forEach(activity => {
            if (!activity.location) return;
            bounds.extend(activity.location);
            const marker = new googleMaps.maps.marker.AdvancedMarkerElement({ map, position: activity.location, title: activity.title });
            marker.addListener("click", () => onSelect(activity.id));
          });
          if (activities.some(activity => activity.location)) map.fitBounds(bounds, 64);
          searchPlaces("", "restaurant");
        }}
        className="h-[560px] sm:h-[620px]"
      />

      <div className="absolute inset-x-3 top-3 grid gap-2 sm:left-4 sm:right-4 sm:top-4">
        <form onSubmit={submitSearch} className="flex items-center gap-2 rounded-2xl border border-[#123a35]/10 bg-[#fffdf8]/95 p-2 shadow-lg backdrop-blur">
          <Search className="ml-2 h-4 w-4 shrink-0 text-[#e6651b]" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Find places in ${destination.name}`} aria-label="Search places" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-semibold text-[#123a35] outline-none placeholder:text-[#7b918b]" />
          {query && <button type="button" onClick={() => { setQuery(""); searchPlaces("", activeCategory); }} className="rounded-full p-1.5 text-[#6d847d] hover:bg-[#eef4ef]" aria-label="Clear place search"><X className="h-4 w-4" /></button>}
          <button type="submit" className="rounded-xl bg-[#123a35] px-3 py-2 text-xs font-black text-white transition-transform active:scale-95">Search</button>
        </form>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {categories.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setActiveCategory(id); setQuery(""); searchPlaces("", id); }} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black shadow-sm transition-colors ${activeCategory === id && !query ? "border-[#123a35] bg-[#123a35] text-white" : "border-[#123a35]/10 bg-[#fffdf8]/95 text-[#315d56] hover:border-[#e6651b]"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
        </div>
      </div>

      <div className="pointer-events-none absolute left-4 top-[8.8rem] rounded-full bg-[#fffdf8]/95 px-3 py-2 text-xs font-bold text-[#123a35] shadow-sm"><span className="flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-[#e6651b]" />{route?.available && route.distanceKm ? `Live road route · ${route.distanceKm} km` : `${destination.name} route map`}</span></div>

      {isSearching && <div className="absolute right-4 top-[8.8rem] flex items-center gap-2 rounded-full bg-[#123a35]/95 px-3 py-2 text-xs font-bold text-white shadow-sm"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#ffb34b]" />Finding nearby places…</div>}

      {!isSearching && places.length > 0 && !selectedPlace && <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{places.slice(0, 5).map(place => <button key={place.place_id} type="button" onClick={() => { setSelectedPlace(place); if (place.geometry?.location) { mapRef.current?.panTo(place.geometry.location); mapRef.current?.setZoom(15); } }} className="min-w-[168px] rounded-2xl border border-[#123a35]/10 bg-[#fffdf8]/95 p-3 text-left shadow-lg backdrop-blur"><p className="truncate text-sm font-black text-[#123a35]">{place.name}</p><p className="mt-1 truncate text-[11px] font-semibold text-[#6a827b]">{formatPlaceMeta(place) || place.vicinity || "Nearby place"}</p></button>)}</div>}

      {selectedPlace && <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-[#123a35]/10 bg-[#fffdf8]/95 p-4 shadow-xl backdrop-blur sm:max-w-[360px]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-black text-[#123a35]">{selectedPlace.name}</p><p className="mt-1 text-xs font-semibold text-[#6a827b]">{formatPlaceMeta(selectedPlace) || "Place near your route"}</p></div><button type="button" onClick={() => setSelectedPlace(null)} className="rounded-full p-1.5 text-[#6d847d] hover:bg-[#eef4ef]" aria-label="Close place details"><X className="h-4 w-4" /></button></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#627b73]">{selectedPlace.vicinity || selectedPlace.formatted_address || "A nearby place worth adding to your plan."}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1 text-xs font-black text-[#e6651b]"><Star className="h-3.5 w-3.5 fill-current" />{selectedPlace.rating ? selectedPlace.rating.toFixed(1) : "New find"}</span><button type="button" onClick={() => setSelectedPlace(null)} className="inline-flex items-center gap-1 rounded-full bg-[#123a35] px-3 py-2 text-xs font-black text-white"><Crosshair className="h-3.5 w-3.5 text-[#ffb34b]" />Keep exploring</button></div></div>}

      <div className="pointer-events-none absolute bottom-4 right-4 hidden max-w-[220px] rounded-2xl bg-[#123a35]/95 p-4 text-white shadow-lg sm:block"><p className="atlas-label text-[#ffb34b]">Explore your way</p><p className="mt-2 text-sm leading-5 text-[#e0ebe4]">Search food, coffee, shopping, landmarks, and outdoor stops around your route.</p></div>
    </section>
  );
}
