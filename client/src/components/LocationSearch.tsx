import { MapPin, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type LocationValue = {
  label: string;
  lat: number;
  lng: number;
  placeId?: string;
};

type Props = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSelect: (value: LocationValue) => void;
};

export default function LocationSearch({
  label,
  value,
  placeholder,
  onChange,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [resolveError, setResolveError] = useState(false);
  const query = trpc.location.search.useQuery(
    { query: search },
    { enabled: search.trim().length >= 2, staleTime: 60_000, retry: false }
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(value.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [value]);

  const choose = (item: { description: string; placeId: string; name?: string; location?: { lat: number; lng: number } }) => {
    setResolveError(false);
    if (!item.location || !Number.isFinite(item.location.lat) || !Number.isFinite(item.location.lng)) {
      setResolveError(true);
      return;
    }
    onSelect({
      label: item.description || item.name || "Selected destination",
      lat: item.location.lat,
      lng: item.location.lng,
      placeId: item.placeId,
    });
    setOpen(false);
  };

  return (
    <div className="relative grid gap-2 text-sm font-bold">
      <span>{label}</span>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e6651b]" />
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={event => {
            onChange(event.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-2xl border border-[#123a35]/15 bg-[#fffdf8] py-4 pl-11 pr-10 text-base font-medium outline-none focus:ring-2 focus:ring-[#e6651b]"
        />
        {query.isFetching ? (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#e6651b]" />
        ) : (
          <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9badA8]" />
        )}
      </div>
      {open && value.trim().length >= 2 && search.trim() === value.trim() ? (
        <div className="absolute inset-x-0 top-[4.8rem] z-[1100] overflow-hidden rounded-2xl border border-[#123a35]/12 bg-[#fffdf8] shadow-[0_20px_40px_-24px_rgba(18,58,53,.6)]">
          {query.isFetching ? (
            <p className="p-4 text-xs font-semibold text-[#71857e]">Searching places…</p>
          ) : query.isError ? (
            <p className="p-4 text-xs font-semibold leading-5 text-[#8a6a51]">Location search is temporarily unavailable. Please try again.</p>
          ) : query.data?.results.length ? (
            (query.data.results as Array<{ placeId: string; description: string; name?: string; secondary?: string; location?: { lat: number; lng: number } }>).map(item => (
              <button
                type="button"
                key={item.placeId}
                onClick={() => void choose(item)}
                className="flex w-full items-start gap-3 border-b border-[#123a35]/8 px-4 py-3 text-left last:border-0 hover:bg-[#f2eddf]"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#e6651b]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#123a35]">
                    {item.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-[#6d847d]">
                    {item.secondary || item.description}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="p-4 text-xs font-semibold text-[#71857e]">No matching places found. Try a city and country name.</p>
          )}
        </div>
      ) : null}
      {resolveError && <p role="alert" className="text-xs font-semibold leading-5 text-[#8a4f3d]">We could not resolve that place. Select another result or try again.</p>}
    </div>
  );
}
