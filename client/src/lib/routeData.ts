export type RouteRecord = {
  id: string;
  slug: string;
  name: string;
  continent: string;
  country: string;
  region: string;
  startDestination: string;
  endDestination: string;
  intermediateStops: string[];
  durationDays: number;
  travelCategory: string;
  budgetMin: number;
  budgetMax: number;
  travelStyles: string[];
  photoUrl: string;
  overview: string;
  highlights: string[];
  isSample: boolean;
  sortOrder: number;
};

const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`;

export const SAMPLE_ROUTES: RouteRecord[] = [
  {
    id: "sample-golden-triangle",
    slug: "golden-triangle",
    name: "The Golden Triangle",
    continent: "Asia",
    country: "India",
    region: "North India",
    startDestination: "Delhi",
    endDestination: "Jaipur",
    intermediateStops: ["Agra", "Fatehpur Sikri"],
    durationDays: 6,
    travelCategory: "Culture & heritage",
    budgetMin: 22000,
    budgetMax: 48000,
    travelStyles: ["Cultural", "Food", "First-timer"],
    photoUrl: image("photo-1564507592333-c60657eea523"),
    overview: "A first, unforgettable passage through grand forts, Mughal courtyards, old-city markets and the colour of Rajasthan.",
    highlights: ["Sunrise at the Taj Mahal", "Amber Fort at golden hour", "Old Delhi food walk"],
    isSample: true,
    sortOrder: 1,
  },
  {
    id: "sample-kerala-coast",
    slug: "kerala-coast-and-backwaters",
    name: "Kerala Coast & Backwaters",
    continent: "Asia",
    country: "India",
    region: "South India",
    startDestination: "Kochi",
    endDestination: "Alappuzha",
    intermediateStops: ["Munnar", "Thekkady", "Kumarakom"],
    durationDays: 8,
    travelCategory: "Nature & wellness",
    budgetMin: 28000,
    budgetMax: 62000,
    travelStyles: ["Relaxed", "Nature", "Romantic"],
    photoUrl: image("photo-1602216056096-3b40cc0c9944"),
    overview: "Move from spice-scented highlands to palm-lined waterways on a slow route designed for breathing room.",
    highlights: ["Tea-country sunrise", "Wildlife in Thekkady", "Private backwater sunset"],
    isSample: true,
    sortOrder: 2,
  },
  {
    id: "sample-japan-loop",
    slug: "japan-city-and-temple-loop",
    name: "Japan: City & Temple Loop",
    continent: "Asia",
    country: "Japan",
    region: "Honshu",
    startDestination: "Tokyo",
    endDestination: "Osaka",
    intermediateStops: ["Hakone", "Kyoto", "Nara"],
    durationDays: 10,
    travelCategory: "City & culture",
    budgetMin: 115000,
    budgetMax: 235000,
    travelStyles: ["Cultural", "Food", "Packed"],
    photoUrl: image("photo-1493976040374-85c8e12f0c0e"),
    overview: "A high-contrast rail journey from neon neighbourhoods to quiet temple lanes, built around memorable food stops.",
    highlights: ["Fuji views from Hakone", "Dawn in Fushimi Inari", "Osaka street-food night"],
    isSample: true,
    sortOrder: 3,
  },
  {
    id: "sample-portugal-coast",
    slug: "portugal-coast-and-villages",
    name: "Portugal Coast & Villages",
    continent: "Europe",
    country: "Portugal",
    region: "Atlantic Coast",
    startDestination: "Lisbon",
    endDestination: "Porto",
    intermediateStops: ["Sintra", "Nazaré", "Coimbra", "Douro Valley"],
    durationDays: 9,
    travelCategory: "Coastal road trip",
    budgetMin: 98000,
    budgetMax: 190000,
    travelStyles: ["Road trip", "Food", "Romantic"],
    photoUrl: image("photo-1555881400-74d7acaacd8b"),
    overview: "An Atlantic road line through tiled cities, cliffside beaches, village cafés and the vineyards of the Douro.",
    highlights: ["Sintra palace morning", "Atlantic seafood lunch", "Douro Valley vineyard stay"],
    isSample: true,
    sortOrder: 4,
  },
  {
    id: "sample-patagonia-wild",
    slug: "patagonia-wild-frontier",
    name: "Patagonia: The Wild Frontier",
    continent: "South America",
    country: "Chile & Argentina",
    region: "Patagonia",
    startDestination: "Santiago",
    endDestination: "El Calafate",
    intermediateStops: ["Puerto Natales", "Torres del Paine", "El Chaltén"],
    durationDays: 12,
    travelCategory: "Adventure & outdoors",
    budgetMin: 210000,
    budgetMax: 390000,
    travelStyles: ["Adventure", "Nature", "Active"],
    photoUrl: image("photo-1530789253388-582c481c54b0"),
    overview: "A dramatic southern traverse for glacier light, granite peaks and long days outside the usual map.",
    highlights: ["Torres del Paine trails", "Perito Moreno Glacier", "Laguna de los Tres"],
    isSample: true,
    sortOrder: 5,
  },
  {
    id: "sample-new-zealand-south",
    slug: "new-zealand-south-island",
    name: "New Zealand South Island",
    continent: "Oceania",
    country: "New Zealand",
    region: "South Island",
    startDestination: "Christchurch",
    endDestination: "Queenstown",
    intermediateStops: ["Lake Tekapo", "Aoraki / Mount Cook", "Wanaka"],
    durationDays: 11,
    travelCategory: "Scenic drive",
    budgetMin: 165000,
    budgetMax: 320000,
    travelStyles: ["Road trip", "Adventure", "Nature"],
    photoUrl: image("photo-1469521669194-babb45599def"),
    overview: "A cinematic mountain-and-lake drive with clear route logic, flexible nights and a strong finish in Queenstown.",
    highlights: ["Aoraki night sky", "Milford Sound day trip", "Wanaka lakeshore loop"],
    isSample: true,
    sortOrder: 6,
  },
];

export function routeFromRow(row: Record<string, unknown>): RouteRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    continent: String(row.continent),
    country: String(row.country),
    region: String(row.region),
    startDestination: String(row.start_destination),
    endDestination: String(row.end_destination),
    intermediateStops: Array.isArray(row.intermediate_stops) ? row.intermediate_stops.map(String) : [],
    durationDays: Number(row.duration_days),
    travelCategory: String(row.travel_category),
    budgetMin: Number(row.budget_min),
    budgetMax: Number(row.budget_max),
    travelStyles: Array.isArray(row.travel_styles) ? row.travel_styles.map(String) : [],
    photoUrl: String(row.photo_url),
    overview: String(row.overview),
    highlights: Array.isArray(row.highlights) ? row.highlights.map(String) : [],
    isSample: Boolean(row.is_sample),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function formatRouteBudget(min: number, max: number) {
  const format = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
  return `₹${format(min)}–₹${format(max)}`;
}
