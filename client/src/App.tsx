/** Monsoon Atlas app shell: light parchment ground, client-only trip state, and deliberate route navigation. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TripProvider } from "./contexts/TripContext";
import Explore from "./pages/Explore";
import Home from "./pages/Home";
import Itinerary from "./pages/Itinerary";
import NotFound from "./pages/NotFound";
import Planner from "./pages/Planner";

function Router() { return <Switch><Route path="/" component={Home} /><Route path="/planner" component={Planner} /><Route path="/itinerary" component={Itinerary} /><Route path="/explore" component={Explore} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><TripProvider><Toaster richColors position="top-center" /><Router /></TripProvider></TooltipProvider></ThemeProvider></ErrorBoundary>; }
