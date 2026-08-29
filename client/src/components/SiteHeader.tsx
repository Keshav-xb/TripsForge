/** Monsoon Atlas navigation: compact atlas-like bar that anchors visitors across TripsForge routes. */
import { LogOut, Menu, Sparkles, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

const links = [{ label: "How it works", href: "/#how-it-works" }, { label: "Explore", href: "/explore" }, { label: "My itinerary", href: "/itinerary" }];

export function BrandMark() {
  return <img src="https://raw.githubusercontent.com/Keshav-xb/TripsForge/main/brand-assets/tripforge-mark-hightech-premium-768.png" alt="TripsForge compass mark" className="h-10 w-10 object-contain drop-shadow-[0_4px_6px_rgba(18,58,53,.2)]" decoding="async" />;
}

export default function SiteHeader() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated, loading, logout } = useAuth();
  return <header className="sticky top-0 z-40 border-b border-[#173e3a]/10 bg-[#fffdf8]/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3.5 lg:px-10">
      <Link href="/" aria-label="TripsForge home" className="group flex items-center gap-2.5"><BrandMark /><span className="brand-wordmark text-[#123a35]">TripsForge</span></Link>
      <nav className="hidden items-center gap-7 md:flex">{links.map((link) => <Link key={link.label} href={link.href} className={`text-sm font-semibold transition-colors hover:text-[#e65d16] ${location === link.href ? "text-[#e65d16]" : "text-[#355752]"}`}>{link.label}</Link>)}</nav>
      <div className="hidden items-center gap-3 sm:flex">{!loading && (isAuthenticated ? <><Link href="/trips" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#355752] transition-colors hover:text-[#e6651b]"><UserRound className="h-4 w-4" /> {user?.name?.split(" ")[0] || "My trips"}</Link><button onClick={() => void logout()} className="grid h-9 w-9 place-items-center rounded-full border border-[#173e3a]/15 text-[#52716a] transition-colors hover:border-[#e6651b] hover:text-[#e6651b]" aria-label="Sign out"><LogOut className="h-4 w-4" /></button></> : <Link href="/account" className="text-sm font-bold text-[#355752] transition-colors hover:text-[#e6651b]">Sign in</Link>)}<Link href="/planner" className="inline-flex items-center gap-2 rounded-full bg-[#123a35] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#1d514a] active:scale-[.97]"><Sparkles className="h-4 w-4 text-[#ffb34b]" /> Plan a trip</Link></div>
      <button onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center rounded-full border border-[#173e3a]/15 text-[#123a35] md:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
    </div>
    {open && <div className="border-t border-[#173e3a]/10 bg-[#fffdf8] px-5 py-4 md:hidden"><nav className="grid gap-3">{links.map((link) => <Link onClick={() => setOpen(false)} key={link.label} href={link.href} className="py-2 text-sm font-bold text-[#123a35]">{link.label}</Link>)}{isAuthenticated ? <><Link onClick={() => setOpen(false)} href="/trips" className="py-2 text-sm font-bold text-[#123a35]">My saved trips</Link><button onClick={() => { setOpen(false); void logout(); }} className="py-2 text-left text-sm font-bold text-[#5b756e]">Sign out</button></> : <Link onClick={() => setOpen(false)} href="/account" className="py-2 text-sm font-bold text-[#123a35]">Sign in</Link>}<Link onClick={() => setOpen(false)} href="/planner" className="mt-1 rounded-xl bg-[#123a35] px-4 py-3 text-center text-sm font-bold text-white">Plan a trip</Link></nav></div>}
  </header>;
}
