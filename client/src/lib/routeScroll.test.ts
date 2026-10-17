import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const restorationSource = readFileSync(resolve(process.cwd(), "client/src/components/RouteScrollRestoration.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("route scroll restoration", () => {
  it("mounts a centralized restoration component in the router", () => {
    expect(appSource).toContain("<RouteScrollRestoration />");
    expect(restorationSource).toContain("useLocation");
    expect(restorationSource).toContain("window.scrollTo({ top: 0, left: 0, behavior: \"auto\" })");
  });

  it("preserves intentional hash-section navigation", () => {
    expect(restorationSource).toContain("window.location.hash");
    expect(restorationSource).toContain("scrollIntoView({ block: \"start\", behavior: \"auto\" })");
    expect(restorationSource).toContain("window.history.scrollRestoration = \"manual\"");
    expect(restorationSource).toContain("window.addEventListener(\"hashchange\", handleHashChange)");
    expect(restorationSource).toContain("document.addEventListener(\"click\", handleAnchorClick)");
    expect(restorationSource).toContain("window.history.replaceState");
  });
});
