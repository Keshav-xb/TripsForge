/** Monsoon Atlas map panel: a deterministic route visualization designed to swap for a live map provider later. */
import { Compass, LocateFixed, MapPinned, Minus, Plus } from "lucide-react";
import type { Activity, Destination } from "@/lib/tripData";

type Props = { destination: Destination; activities: Activity[]; selectedId?: string; onSelect?: (id: string) => void; compact?: boolean };
export default function RouteMap({ destination, activities, selectedId, onSelect, compact = false }: Props) {
  const points = [[18, 72], [45, 58], [60, 40], [72, 61], [82, 33], [52, 20]];
  return <section className={`relative overflow-hidden rounded-[2rem] border border-[#123a35]/10 bg-[#dceae1] ${compact ? "min-h-[290px]" : "min-h-[520px]"}`} aria-label={`Stylized map of ${destination.name}`}>
    <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(18,58,53,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(18,58,53,.08) 1px, transparent 1px)", backgroundSize: "38px 38px" }} />
    <div className="absolute -left-16 top-12 h-64 w-[120%] rotate-[-11deg] rounded-[50%] border-[20px] border-[#c8ddd2]" /><div className="absolute right-[-8%] top-[19%] h-44 w-[88%] rotate-[24deg] rounded-[50%] border-[22px] border-[#c8ddd2]" />
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none"><path d="M 18 72 C 31 77, 31 52, 45 58 S 55 49, 60 40 S 67 72, 72 61 S 73 39, 82 33 S 69 15, 52 20" fill="none" stroke="#e6651b" strokeWidth="1.15" strokeLinecap="round" strokeDasharray="2.2 2" /></svg>
    <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-[#123a35]/10 bg-[#fffdf8]/90 px-3 py-2 text-xs font-bold text-[#123a35] shadow-sm"><MapPinned className="h-3.5 w-3.5 text-[#e6651b]" /> {destination.mapLabel}</div>
    <div className="absolute right-5 top-5 grid gap-1 rounded-xl border border-[#123a35]/10 bg-[#fffdf8]/90 p-1 shadow-sm"><button className="grid h-7 w-7 place-items-center text-[#123a35]"><Plus className="h-4 w-4" /></button><button className="grid h-7 w-7 place-items-center text-[#123a35]"><Minus className="h-4 w-4" /></button></div>
    {activities.slice(0, 6).map((activity, index) => { const [left, top] = points[index] ?? points[0]; const isSelected = selectedId === activity.id; return <button key={activity.id} onClick={() => onSelect?.(activity.id)} style={{ left: `${left}%`, top: `${top}%` }} className={`absolute z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-xs font-black shadow-lg transition-all ${isSelected ? "scale-125 border-[#123a35] bg-[#123a35] text-[#ffb34b]" : "border-[#fffdf8] bg-[#e6651b] text-white hover:scale-110"}`} aria-label={`Show ${activity.title}`}>{index + 1}</button>; })}
    <div className="absolute bottom-5 left-5 max-w-[210px] rounded-2xl bg-[#123a35] p-4 text-white shadow-xl"><div className="flex items-center gap-2 text-[#ffb34b]"><Compass className="h-4 w-4" /><span className="atlas-label">route logic</span></div><p className="mt-2 text-sm font-semibold leading-5">A route shaped to reduce unnecessary backtracking.</p></div>
    <button className="absolute bottom-5 right-5 grid h-10 w-10 place-items-center rounded-full bg-[#fffdf8] text-[#123a35] shadow-sm" aria-label="Centre route"><LocateFixed className="h-4 w-4" /></button>
  </section>;
}
