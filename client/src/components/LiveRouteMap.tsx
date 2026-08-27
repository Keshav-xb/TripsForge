import { MapPinned } from "lucide-react";
import RouteMap from "@/components/RouteMap";
import type { Activity, Destination } from "@/lib/tripData";

type LiveRouteMapProps = {
  destination: Destination;
  activities: Activity[];
  selectedId?: string;
  onSelect: (activityId: string) => void;
  route?: { available: boolean; distanceKm?: number; duration?: string; mapImage?: string | null };
};

export default function LiveRouteMap({ destination, activities, selectedId, onSelect, route }: LiveRouteMapProps) {
  if (!route?.available || !route.mapImage) return <RouteMap destination={destination} activities={activities} selectedId={selectedId} onSelect={onSelect} isFallback />;
  return <section className="relative mt-0 overflow-hidden rounded-[1.5rem] border border-[#123a35]/10 bg-[#eaf1ed] shadow-[0_18px_35px_-30px_rgba(18,58,53,.45)]"><img src={route.mapImage} alt={`Live road route through ${destination.name}`} className="h-[410px] w-full object-cover" /><div className="absolute left-4 top-4 rounded-full bg-[#fffdf8]/95 px-3 py-2 text-xs font-bold text-[#123a35] shadow-sm"><span className="flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-[#e6651b]" /> Live road route · {route.distanceKm} km</span></div><div className="absolute bottom-4 left-4 max-w-[230px] rounded-2xl bg-[#123a35]/95 p-4 text-white shadow-lg"><p className="atlas-label text-[#ffb34b]">Route guidance</p><p className="mt-2 text-sm leading-5 text-[#e0ebe4]">{route.duration} by road. Timing can shift with local conditions and traffic.</p></div><div className="sr-only">{activities.map(activity => <button key={activity.id} onClick={() => onSelect(activity.id)} aria-pressed={selectedId === activity.id}>{activity.title}</button>)}</div></section>;
}
