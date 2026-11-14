import { z } from "zod";
import { makeRequest, type DirectionsResult } from "./_core/map";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";

const routeStopSchema = z.object({ title: z.string().trim().min(2).max(180), location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional() });
const simulatorInterpretationSchema = z.object({ budgetDelta: z.number().int().min(-1000000).max(1000000), dayDelta: z.number().int().min(-5).max(5), destination: z.string().nullable(), transportation: z.enum(["flight", "train", "bus", "car"]).nullable(), travelStyle: z.enum(["Backpacking", "Budget", "Relaxed", "Balanced", "Packed", "Comfortable", "Luxury"]).nullable(), rationale: z.string().max(240) });
const guardianAssistantSchema = z.object({ urgency: z.enum(["routine", "important", "urgent"]), answer: z.string().min(1).max(1200), actions: z.array(z.string().min(1).max(180)).max(5), disclaimer: z.string().max(240) });

async function createStaticRouteImage(route: DirectionsResult["routes"][number], stops: Array<z.infer<typeof routeStopSchema>>) {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return null;
  const url = new URL(`${ENV.forgeApiUrl.replace(/\/+$/, "")}/v1/maps/proxy/maps/api/staticmap`);
  url.searchParams.set("key", ENV.forgeApiKey); url.searchParams.set("size", "640x400"); url.searchParams.set("scale", "1"); url.searchParams.set("maptype", "roadmap");
  if (route.overview_polyline?.points) url.searchParams.set("path", `color:0xe6651b|weight:5|enc:${route.overview_polyline.points}`);
  stops.forEach((stop, index) => url.searchParams.append("markers", `color:0x123a35|label:${index + 1}|${stop.location ? `${stop.location.lat},${stop.location.lng}` : stop.title}`));
  const response = await fetch(url); if (!response.ok) return null;
  return `data:${response.headers.get("content-type") || "image/png"};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
}

export const appRouter = router({
  simulator: router({
    interpret: publicProcedure.input(z.object({ instruction: z.string().trim().min(3).max(500), currentDestination: z.string().trim().min(2).max(120), currentStyle: z.string().trim().min(2).max(40) })).mutation(async ({ input }) => {
      const response = await invokeLLM({ messages: [{ role: "system", content: "You interpret travel what-if instructions. Return only requested changes. Never invent live prices or availability. Use 0/null when a field is not requested. Keep rationale short." }, { role: "user", content: `Current destination: ${input.currentDestination}\nCurrent style: ${input.currentStyle}\nInstruction: ${input.instruction}` }], response_format: { type: "json_schema", json_schema: { name: "trip_simulation_controls", strict: true, schema: { type: "object", properties: { budgetDelta: { type: "integer" }, dayDelta: { type: "integer" }, destination: { type: ["string", "null"] }, transportation: { type: ["string", "null"], enum: ["flight", "train", "bus", "car", null] }, travelStyle: { type: ["string", "null"], enum: ["Backpacking", "Budget", "Relaxed", "Balanced", "Packed", "Comfortable", "Luxury", null] }, rationale: { type: "string" } }, required: ["budgetDelta", "dayDelta", "destination", "transportation", "travelStyle", "rationale"], additionalProperties: false } } }, max_tokens: 300 });
      return simulatorInterpretationSchema.parse(JSON.parse(typeof response.choices[0]?.message.content === "string" ? response.choices[0].message.content : "{}"));
    }),
  }),
  guardian: router({
    weather: publicProcedure.input(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(async ({ input }) => {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(input.lat)); url.searchParams.set("longitude", String(input.lng));
      url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max"); url.searchParams.set("timezone", "auto"); url.searchParams.set("forecast_days", "16");
      const response = await fetch(url); if (!response.ok) throw new Error("WEATHER_UNAVAILABLE");
      const data = await response.json() as { daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[]; wind_speed_10m_max?: number[] } };
      const dates = data.daily?.time ?? [];
      const daily = dates.map((date, index) => ({ date, code: data.daily?.weather_code?.[index] ?? null, max: data.daily?.temperature_2m_max?.[index] ?? null, min: data.daily?.temperature_2m_min?.[index] ?? null, precipitationProbability: data.daily?.precipitation_probability_max?.[index] ?? null, wind: data.daily?.wind_speed_10m_max?.[index] ?? null })).filter(day => day.date >= input.startDate && day.date <= input.endDate);
      return { source: "Open-Meteo forecast", fetchedAt: new Date().toISOString(), forecastAvailable: daily.length > 0, daily };
    }),
    assist: publicProcedure.input(z.object({ question: z.string().trim().min(3).max(800), destination: z.string().trim().min(2).max(120), weatherSummary: z.string().max(800).optional() })).mutation(async ({ input }) => {
      const response = await invokeLLM({ messages: [{ role: "system", content: "You are a cautious travel safety assistant. For immediate danger, tell the traveller to contact local emergency services first. Do not claim you contacted anyone. Do not invent local numbers, live conditions, facilities, or laws. Use the supplied destination and weather only as context. Return concise practical advice." }, { role: "user", content: `Destination: ${input.destination}\nWeather context: ${input.weatherSummary ?? "unavailable"}\nQuestion: ${input.question}` }], response_format: { type: "json_schema", json_schema: { name: "travel_guardian_answer", strict: true, schema: { type: "object", properties: { urgency: { type: "string", enum: ["routine", "important", "urgent"] }, answer: { type: "string" }, actions: { type: "array", items: { type: "string" } }, disclaimer: { type: "string" } }, required: ["urgency", "answer", "actions", "disclaimer"], additionalProperties: false } } }, max_tokens: 500 });
      return guardianAssistantSchema.parse(JSON.parse(typeof response.choices[0]?.message.content === "string" ? response.choices[0].message.content : "{}"));
    }),
  }),
  route: router({
    preview: publicProcedure.input(z.object({ destination: z.string().trim().min(2).max(120), stops: z.array(routeStopSchema).min(2).max(8) })).query(async ({ input }) => {
      try { const address = (stop: z.infer<typeof routeStopSchema>) => stop.location ? `${stop.location.lat},${stop.location.lng}` : `${stop.title}, ${input.destination}, India`; const result = await makeRequest<DirectionsResult>("/maps/api/directions/json", { origin: address(input.stops[0]), destination: address(input.stops[input.stops.length - 1]), waypoints: input.stops.slice(1, -1).map(address).join("|"), mode: "driving", units: "metric" }); const route = result.routes[0]; if (!route) return { available: false as const }; const metres = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0); const seconds = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0); const hours = Math.floor(seconds / 3600); const minutes = Math.round((seconds % 3600) / 60); return { available: true as const, distanceKm: Math.round((metres / 1000) * 10) / 10, duration: hours ? `${hours}h ${minutes}m` : `${minutes}m`, warnings: route.warnings, mapImage: await createStaticRouteImage(route, input.stops) }; } catch { return { available: false as const }; }
    }),
  }),
});

export type AppRouter = typeof appRouter;
