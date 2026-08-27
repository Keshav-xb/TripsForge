/** Monsoon Atlas data layer: route-first Indian travel demo records with deterministic itinerary construction. */
export type Interest =
  | "Nature"
  | "Food"
  | "History"
  | "Adventure"
  | "Shopping"
  | "Nightlife"
  | "Photography"
  | "Culture"
  | "Beaches"
  | "Architecture"
  | "Family";

export type Activity = {
  id: string;
  time: string;
  title: string;
  description: string;
  category: Interest | "Local pick";
  cost: number;
  duration: string;
  distance: string;
  marker: number;
  location?: { lat: number; lng: number };
};

export type PlanInputs = {
  destination: string;
  startLocation: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  budget: number;
  currency: string;
  budgetLevel: "Budget" | "Balanced" | "Premium";
  interests: Interest[];
  travelStyle: "Relaxed" | "Balanced" | "Packed";
};

export type DayPlan = {
  day: number;
  title: string;
  subtitle: string;
  activities: Activity[];
};

export type ForgedTrip = {
  destination: Destination;
  plan: PlanInputs;
  days: DayPlan[];
  budget: { transportation: number; hotels: number; food: number; activities: number; miscellaneous: number; total: number };
  totalDistance: number;
  travelTime: string;
  score: number;
};

export type Destination = {
  name: string;
  region: string;
  image: string;
  price: number;
  bestTime: string;
  description: string;
  category: string;
  mapLabel: string;
  themes: string[];
  activities: Omit<Activity, "id" | "marker">[];
};

export const INDIAN_DESTINATIONS: Destination[] = [
  {
    name: "Jaipur", region: "Rajasthan", image: "/assets/hero-jaipur.jpg", price: 11900, bestTime: "Oct — Mar", category: "Culture & food", mapLabel: "Pink City circuit", themes: ["History", "Food", "Architecture", "Shopping", "Photography", "Culture"], description: "Courtyards, craft studios and desert light woven into one deliberate route.",
    activities: [
      { time: "08:30", title: "Masala chai at Sahu", description: "A spice-laced local start near the old city lanes.", category: "Food", cost: 120, duration: "35 min", distance: "0 km", location: { lat: 26.9209, lng: 75.8232 } },
      { time: "09:30", title: "Amber Fort ramparts", description: "Climb through mirrored halls and sunlit courtyards before the crowds.", category: "History", cost: 200, duration: "2 hr", distance: "11.4 km", location: { lat: 26.9855, lng: 75.8513 } },
      { time: "12:30", title: "Panna Meena ka Kund", description: "A geometric stepwell made for slow photographs and cool shade.", category: "Architecture", cost: 0, duration: "35 min", distance: "1.8 km", location: { lat: 26.9877, lng: 75.8541 } },
      { time: "14:00", title: "Rajasthani thali lunch", description: "A relaxed thali with gatte, ker and freshly made rotis.", category: "Food", cost: 520, duration: "1 hr", distance: "8.2 km", location: { lat: 26.9271, lng: 75.8244 } },
      { time: "16:00", title: "City Palace galleries", description: "Royal textiles, ceremonial courtyards and blue-painted doorways.", category: "Culture", cost: 700, duration: "1.5 hr", distance: "2.1 km", location: { lat: 26.9258, lng: 75.8237 } },
      { time: "18:30", title: "Hawa Mahal blue hour", description: "See the honeycomb façade take on its softest evening colour.", category: "Photography", cost: 0, duration: "45 min", distance: "0.6 km", location: { lat: 26.9239, lng: 75.8267 } },
      { time: "20:00", title: "Johari Bazaar browse", description: "A focused hour for block prints, silver and hand-made keepsakes.", category: "Shopping", cost: 0, duration: "1 hr", distance: "0.4 km", location: { lat: 26.9219, lng: 75.8285 } },
      { time: "21:15", title: "Courtyard dinner", description: "Regional small plates in a softly lit heritage haveli.", category: "Food", cost: 900, duration: "1.5 hr", distance: "1.2 km", location: { lat: 26.9209, lng: 75.8232 } },
    ]
  },
  {
    name: "Goa", region: "Goa", image: "/assets/goa-coast.jpg", price: 14800, bestTime: "Nov — Feb", category: "Beaches & slow days", mapLabel: "Coastal loop", themes: ["Beaches", "Food", "Nature", "Nightlife", "Photography"], description: "Salt air, quiet coves and a generous pace from one shoreline to the next.",
    activities: [
      { time: "08:00", title: "Beachside breakfast", description: "Poee, fruit and strong coffee where the palms meet the sand.", category: "Food", cost: 320, duration: "50 min", distance: "0 km" },
      { time: "09:30", title: "Kayak the Nerul backwaters", description: "Paddle quietly beneath mangroves with a local naturalist.", category: "Nature", cost: 950, duration: "1.5 hr", distance: "4.4 km" },
      { time: "12:00", title: "Fontainhas colour walk", description: "A pastel-lined pocket of old Panjim with photogenic doors.", category: "Photography", cost: 0, duration: "1.5 hr", distance: "8.8 km" },
      { time: "14:00", title: "Konkan seafood lunch", description: "Fresh catch, sol kadhi and a quiet view over the estuary.", category: "Food", cost: 780, duration: "1 hr", distance: "1.2 km" },
      { time: "16:30", title: "Hidden cove swim", description: "A low-key beach stretch selected for your afternoon tide.", category: "Beaches", cost: 0, duration: "1.5 hr", distance: "12.6 km" },
      { time: "19:00", title: "Sunset at Chapora", description: "Watch the coast turn copper from the old fort’s edge.", category: "Photography", cost: 50, duration: "1 hr", distance: "6.3 km" },
      { time: "21:00", title: "Vinyl bar session", description: "A small, warm evening stop with coastal cocktails and records.", category: "Nightlife", cost: 900, duration: "2 hr", distance: "3.5 km" },
    ]
  },
  {
    name: "Manali", region: "Himachal Pradesh", image: "/assets/manali.jpg", price: 13600, bestTime: "Mar — Jun", category: "Mountain adventure", mapLabel: "Kullu valley traverse", themes: ["Nature", "Adventure", "Photography", "Family", "Food"], description: "Cedar trails, glacial rivers and a mountain-day rhythm with room to breathe.",
    activities: [
      { time: "07:30", title: "Mountain breakfast", description: "Warm siddu and tea before the valley wakes fully.", category: "Food", cost: 250, duration: "40 min", distance: "0 km" },
      { time: "09:00", title: "Jogini Falls trail", description: "A steady forest climb with mountain views opening in stages.", category: "Nature", cost: 0, duration: "2.5 hr", distance: "5.1 km" },
      { time: "12:30", title: "River-view lunch", description: "Simple Himachali comfort food beside the Beas.", category: "Food", cost: 480, duration: "1 hr", distance: "3.2 km" },
      { time: "14:30", title: "Solang Valley ropeway", description: "A high, scenic ascent built for a wide horizon view.", category: "Adventure", cost: 750, duration: "2 hr", distance: "13.4 km" },
      { time: "17:30", title: "Cedar forest portrait walk", description: "A brief golden-hour loop on quiet forest paths.", category: "Photography", cost: 0, duration: "50 min", distance: "9.8 km" },
      { time: "19:30", title: "Old Manali dinner", description: "A relaxed meal in the village’s lantern-lit lanes.", category: "Food", cost: 650, duration: "1.5 hr", distance: "4.3 km" },
      { time: "21:30", title: "Stories by the fire", description: "A low-key mountain evening at your stay.", category: "Family", cost: 0, duration: "1 hr", distance: "0.2 km" },
    ]
  },
  {
    name: "Kerala", region: "Kerala", image: "/assets/kerala.jpg", price: 15400, bestTime: "Sep — Mar", category: "Nature & wellness", mapLabel: "Backwater passage", themes: ["Nature", "Food", "Culture", "Family", "Photography"], description: "Backwater mornings, spice-rich kitchens and unhurried village channels.",
    activities: [
      { time: "07:30", title: "Filter coffee & appam", description: "A gentle breakfast with local fruit and coconut stew.", category: "Food", cost: 240, duration: "45 min", distance: "0 km" },
      { time: "09:00", title: "Backwater canoe ride", description: "Glide through palm-fringed channels with a local boatman.", category: "Nature", cost: 1100, duration: "2 hr", distance: "1.1 km" },
      { time: "12:00", title: "Village kitchen lunch", description: "Home-style sadya served on a banana leaf.", category: "Food", cost: 450, duration: "1 hr", distance: "3.5 km" },
      { time: "14:00", title: "Coir workshop visit", description: "Meet the makers behind Kerala’s traditional coconut fibre craft.", category: "Culture", cost: 250, duration: "1 hr", distance: "2.2 km" },
      { time: "16:30", title: "Sunset lagoon photographs", description: "A still-water interlude as the birds return to the palms.", category: "Photography", cost: 0, duration: "1 hr", distance: "4.6 km" },
      { time: "19:00", title: "Ayurvedic wind-down", description: "A short restorative treatment arranged near your stay.", category: "Family", cost: 1200, duration: "1.5 hr", distance: "0.5 km" },
      { time: "21:00", title: "Coconut curry dinner", description: "Fresh regional plates in a garden-facing dining room.", category: "Food", cost: 650, duration: "1.5 hr", distance: "0.4 km" },
    ]
  },
  { name: "Udaipur", region: "Rajasthan", image: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1000&q=85", price: 12700, bestTime: "Oct — Mar", category: "Romantic lakes", mapLabel: "Lake city loop", themes: ["Architecture", "Culture", "Food", "Photography"], description: "Lakeside palaces and whitewashed alleys for a romantic, unhurried circuit.", activities: [] },
  { name: "Rishikesh", region: "Uttarakhand", image: "https://images.unsplash.com/photo-1626621331169-5f34be280ed9?auto=format&fit=crop&w=1000&q=85", price: 9800, bestTime: "Sep — Nov", category: "Adventure & nature", mapLabel: "Ganga river line", themes: ["Adventure", "Nature", "Food", "Culture"], description: "River mornings, forest air and a pulse of adventure in every bend.", activities: [] },
  { name: "Srinagar", region: "Kashmir", image: "/assets/srinagar.jpg", price: 17600, bestTime: "Apr — Oct", category: "Lakes & mountains", mapLabel: "Dal Lake circuit", themes: ["Nature", "Photography", "Food", "Family"], description: "A gentle lakeside route through gardens, mountain views and old-city flavour.", activities: [] },
];

const fallbackActivities: Omit<Activity, "id" | "marker">[] = [
  { time: "08:30", title: "Local breakfast stop", description: "A calm, flavour-first start close to your stay.", category: "Food", cost: 300, duration: "45 min", distance: "0 km" },
  { time: "10:00", title: "Signature city landmark", description: "A considered visit timed for the best light and fewer crowds.", category: "Culture", cost: 450, duration: "1.5 hr", distance: "3.2 km" },
  { time: "13:00", title: "Seasonal lunch", description: "A regional meal selected around the day’s route.", category: "Food", cost: 600, duration: "1 hr", distance: "1.1 km" },
  { time: "15:00", title: "Neighbourhood discovery", description: "Independent time for small shops, stories and local texture.", category: "Shopping", cost: 0, duration: "1.5 hr", distance: "1.7 km" },
  { time: "18:30", title: "Golden-hour viewpoint", description: "A scenic pause before your evening opens up.", category: "Photography", cost: 0, duration: "1 hr", distance: "4.5 km" },
  { time: "20:00", title: "Dinner with a sense of place", description: "A warm local table to close the day.", category: "Food", cost: 800, duration: "1.5 hr", distance: "1.4 km" },
];

export const defaultPlan: PlanInputs = {
  destination: "Jaipur", startLocation: "Delhi", startDate: "2026-10-16", endDate: "2026-10-19", adults: 2, children: 0, budget: 20000, currency: "INR", budgetLevel: "Balanced", interests: ["History", "Food", "Architecture"], travelStyle: "Balanced",
};

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value).replace("₹", "₹");
}

export function formatDateRange(startDate: string, endDate: string) {
  const format = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${format(startDate)} — ${format(endDate)}`;
}

export function getDestination(name: string) {
  return INDIAN_DESTINATIONS.find((destination) => destination.name === name) ?? INDIAN_DESTINATIONS[0];
}

export function getTripDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`).getTime();
  const end = new Date(`${endDate}T12:00:00`).getTime();
  const distance = Math.round((end - start) / 86400000);
  return Math.min(5, Math.max(1, Number.isFinite(distance) ? distance : 3));
}

export function buildTrip(plan: PlanInputs): ForgedTrip {
  const destination = getDestination(plan.destination);
  const dayCount = getTripDays(plan.startDate, plan.endDate);
  const templates = destination.activities.length ? destination.activities : fallbackActivities;
  const selectedThemes = new Set(plan.interests);
  const mealAndChosen = templates.filter((activity) => activity.category === "Food" || selectedThemes.has(activity.category as Interest));
  const routePool = mealAndChosen.length >= 5 ? mealAndChosen : templates;
  const targetActivities = plan.travelStyle === "Relaxed" ? 4 : plan.travelStyle === "Packed" ? 6 : 5;
  const days: DayPlan[] = Array.from({ length: dayCount }, (_, dayIndex) => {
    const activities = Array.from({ length: targetActivities }, (_, activityIndex) => {
      const source = routePool[(dayIndex * targetActivities + activityIndex) % routePool.length];
      return { ...source, id: `${dayIndex}-${activityIndex}-${source.title.replaceAll(" ", "-")}`, marker: activityIndex + 1 };
    });
    const first = activities[0]?.category.toLowerCase() ?? "local";
    return { day: dayIndex + 1, title: dayIndex === 0 ? `Arrival & ${destination.mapLabel}` : dayIndex === dayCount - 1 ? "A final unhurried chapter" : `${first[0].toUpperCase()}${first.slice(1)} at a better pace`, subtitle: `${activities.length} route moments • curated around ${plan.interests.slice(0, 2).join(" + ") || "your pace"}`, activities };
  });
  const total = Math.max(8000, plan.budget);
  const budget = { transportation: Math.round(total * 0.18), hotels: Math.round(total * 0.32), food: Math.round(total * 0.2), activities: Math.round(total * 0.18), miscellaneous: Math.round(total * 0.12), total };
  return { destination, plan, days, budget, totalDistance: Math.round(dayCount * (plan.travelStyle === "Packed" ? 21.4 : plan.travelStyle === "Relaxed" ? 11.8 : 16.7)), travelTime: `${dayCount * (plan.travelStyle === "Packed" ? 2 : plan.travelStyle === "Relaxed" ? 1 : 1.5)}h ${plan.travelStyle === "Balanced" ? "30m" : ""}`.trim(), score: 92 + Math.min(6, plan.interests.length) };
}
