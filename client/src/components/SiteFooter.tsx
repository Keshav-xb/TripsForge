/** Monsoon Atlas footer: a confident final waypoint with only essential product navigation. */
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "./SiteHeader";
import { Link } from "wouter";

export default function SiteFooter() {
  return <footer className="bg-[#0d2c28] px-5 pb-8 pt-14 text-[#e9efe7] lg:px-10 lg:pt-20">
    <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[1.4fr_.6fr_.6fr]">
      <div><div className="flex items-center gap-2"><BrandMark /><span className="font-display text-2xl tracking-[-.06em]">TripsForge</span></div><p className="mt-5 max-w-sm text-base leading-7 text-[#bfd1c8]">A more considered way to shape the days you’ll remember. Build your perfect trip.</p><Link href="/planner" className="mt-6 inline-flex items-center gap-2 font-bold text-[#ffb34b] transition-transform hover:translate-x-1">Forge a route <ArrowUpRight className="h-4 w-4" /></Link></div>
      <div><p className="atlas-label text-[#89a89e]">Explore</p><div className="mt-4 grid gap-3 text-sm font-semibold"><Link href="/explore">Destinations</Link><Link href="/planner">Trip planner</Link><Link href="/itinerary">My itinerary</Link></div></div>
      <div><p className="atlas-label text-[#89a89e]">The dispatch</p><p className="mt-4 text-sm leading-6 text-[#bfd1c8]">Thoughtful route notes, delivered occasionally. No inbox clutter.</p><button onClick={() => alert("The dispatch is coming soon.")} className="mt-5 rounded-full border border-[#8ba89f]/40 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10">Notify me</button></div>
    </div>
    <div className="mx-auto mt-14 flex max-w-[1440px] flex-col justify-between gap-3 border-t border-white/10 pt-5 text-xs text-[#89a89e] sm:flex-row"><span>© 2026 TripsForge. Routes, crafted with intent.</span><span>Demo experience · India routes</span></div>
  </footer>;
}
