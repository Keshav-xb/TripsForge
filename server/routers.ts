import { z } from "zod";
import { makeRequest, type DirectionsResult } from "./_core/map";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";

const routeStopSchema = z.object({ title: z.string().trim().min(2).max(180), location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional() });
const simulatorInterpretationSchema = z.object({ budgetDelta: z.number().int().min(-1000000).max(1000000), dayDelta: z.number().int().min(-5).max(5), destination: z.string().nullable(), transportation: z.enum(["flight", "train", "bus", "car"]).nullable(), travelStyle: z.enum(["Backpacking", "Budget", "Relaxed", "Balanced", "Packed", "Comfortable", "Luxury"]).nullable(), rationale: z.string().max(240) });

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
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You interpret travel what-if instructions. Return only the requested changes, never invent live prices, availability, or facts. Use 0/null when a field is not requested. Keep the rationale short." },
          { role: "user", content: `Current destination: ${input.currentDestination}\nCurrent style: ${input.currentStyle}\nInstruction: ${input.instruction}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "trip_simulation_controls", strict: true, schema: { type: "object", properties: { budgetDelta: { type: "integer" }, dayDelta: { type: "integer" }, destination: { type: ["string", "null"] }, transportation: { type: ["string", "null"], enum: ["flight", "train", "bus", "car", null] }, travelStyle: { type: ["string", "null"], enum: ["Backpacking", "Budget", "Relaxed", "Balanced", "Packed", "Comfortable", "Luxury", null] }, rationale: { type: "string" } }, required: ["budgetDelta", "dayDelta", "destination", "transportation", "travelStyle", "rationale"], additionalProperties: false } } },
        max_tokens: 300,
      });
      const content = response.choices[0]?.message.content;
      const parsed = typeof content === "string" ? JSON.parse(content) : null;
      return simulatorInterpretationSchema.parse(parsed);
    }),
  }),
  route: router({
    preview: publicProcedure.input(z.object({ destination: z.string().trim().min(2).max(120), stops: z.array(routeStopSchema).min(2).max(8) })).query(async ({ input }) => {
      try {
        const address = (stop: z.infer<typeof routeStopSchema>) => stop.location ? `${stop.location.lat},${stop.location.lng}` : `${stop.title}, ${input.destination}, India`;
        const result = await makeRequest<DirectionsResult>("/maps/api/directions/json", { origin: address(input.stops[0]), destination: address(input.stops[input.stops.length - 1]), waypoints: input.stops.slice(1, -1).map(address).join("|"), mode: "driving", units: "metric" });
        const route = result.routes[0]; if (!route) return { available: false as const };
        const metres = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0); const seconds = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0); const hours = Math.floor(seconds / 3600); const minutes = Math.round((seconds % 3600) / 60);
        return { available: true as const, distanceKm: Math.round((metres / 1000) * 10) / 10, duration: hours ? `${hours}h ${minutes}m` : `${minutes}m`, warnings: route.warnings, mapImage: await createStaticRouteImage(route, input.stops) };
      } catch { return { available: false as const }; }
    }),
  }),
});

export type AppRouter = typeof appRouter;
