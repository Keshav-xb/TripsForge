/** Monsoon Atlas navigation: compact atlas-like bar that anchors visitors across TripsForge routes. */
import { Menu, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

const links = [{ label: "How it works", href: "/#how-it-works" }, { label: "Explore", href: "/explore" }, { label: "My itinerary", href: "/itinerary" }];

export function BrandMark() {
  return <img src="/assets/tripsforge-mark.png" alt="TripsForge compass mark" className="h-10 w-10 object-contain" />;
}

export default function SiteHeader() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-40 border-b border-[#173e3a]/10 bg-[#fffdf8]/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3.5 lg:px-10">
      <Link href="/" className="flex items-center gap-2.5"><BrandMark /><span className="font-display text-[1.45rem] tracking-[-0.06em] text-[#123a35]">TripsForge</span></Link>
      <nav className="hidden items-center gap-7 md:flex">{links.map((link) => <Link key={link.label} href={link.href} className={`text-sm font-semibold transition-colors hover:text-[#e65d16] ${location === link.href ? "text-[#e65d16]" : "text-[#355752]"}`}>{link.label}</Link>)}</nav>
      <Link href="/planner" className="hidden items-center gap-2 rounded-full bg-[#123a35] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#1d514a] active:scale-[.97] sm:flex"><Sparkles className="h-4 w-4 text-[#ffb34b]" /> Plan a trip</Link>
      <button onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center rounded-full border border-[#173e3a]/15 text-[#123a35] md:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
    </div>
    {open && <div className="border-t border-[#173e3a]/10 bg-[#fffdf8] px-5 py-4 md:hidden"><nav className="grid gap-3">{links.map((link) => <Link onClick={() => setOpen(false)} key={link.label} href={link.href} className="py-2 text-sm font-bold text-[#123a35]">{link.label}</Link>)}<Link onClick={() => setOpen(false)} href="/planner" className="mt-1 rounded-xl bg-[#123a35] px-4 py-3 text-center text-sm font-bold text-white">Plan a trip</Link></nav></div>}
  </header>;
}
