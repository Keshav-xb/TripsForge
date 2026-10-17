import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const itinerarySource = readFileSync(resolve(process.cwd(), "client/src/pages/Itinerary.tsx"), "utf8");

describe("itinerary day navigation", () => {
  it("scrolls the selected day header into view after opening it", () => {
    expect(itinerarySource).toContain("const dayRefs = useRef<Array<HTMLElement | null>>([])");
    expect(itinerarySource).toContain("dayRefs.current[index]?.scrollIntoView({ block: \"start\", behavior: \"smooth\" })");
    expect(itinerarySource).toContain("scroll-mt-24");
  });

  it("routes day-header clicks through the viewport-aware selector", () => {
    expect(itinerarySource).toContain("onClick={() => selectDay(index, item.activities[0]?.id)}");
  });
});
