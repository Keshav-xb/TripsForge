/** Monsoon Atlas app shell: light parchment ground, client-only trip state, and deliberate route navigation. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TripProvider } from "./contexts/TripContext";
import Explore from "./pages/Explore";
import Account from "./pages/Account";
import Home from "./pages/Home";
import Itinerary from "./pages/Itinerary";
import MyTrips from "./pages/MyTrips";
import NotFound from "./pages/NotFound";
import Planner from "./pages/Planner";
import SharedTrip from "./pages/SharedTrip";

function Router() { return <Switch><Route path="/" component={Home} /><Route path="/account" component={Account} /><Route path="/planner" component={Planner} /><Route path="/itinerary" component={Itinerary} /><Route path="/explore" component={Explore} /><Route path="/trips" component={MyTrips} /><Route path="/trip/:shareCode" component={SharedTrip} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }

function SupabaseConfigurationNotice() {
  return <main className="min-h-screen bg-[#f7f3e9] px-5 py-12 text-[#123f38] sm:px-8"><section className="mx-auto flex min-h-[70vh] max-w-xl items-center"><div className="w-full rounded-[2rem] border border-[#d9d3c4] bg-white p-8 shadow-[0_20px_60px_rgba(16,62,55,0.12)] sm:p-10"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e96b24]">TripsForge setup</p><h1 className="mt-3 font-serif text-4xl leading-tight">Finish the Supabase connection.</h1><p className="mt-4 leading-7 text-[#52706b]">TripsForge could not start because its Supabase browser configuration is missing in this deployment. Add the required values in Vercel, then redeploy.</p><div className="mt-6 rounded-2xl bg-[#f4f0e6] p-5 font-mono text-sm leading-7 text-[#123f38]"><p>VITE_SUPABASE_URL</p><p>VITE_SUPABASE_PUBLISHABLE_KEY</p><p>VITE_APP_URL</p></div><p className="mt-5 text-sm leading-6 text-[#52706b]">Use the project’s Supabase URL and publishable key. Set <code className="rounded bg-[#edf2ec] px-1.5 py-0.5">VITE_APP_URL</code> to this deployed site’s public URL. Do not add a service-role key to browser variables.</p></div></section></main>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider>{!isSupabaseConfigured ? <SupabaseConfigurationNotice /> : <TripProvider><Toaster richColors position="top-center" /><Router /></TripProvider>}</TooltipProvider></ThemeProvider></ErrorBoundary>; }
