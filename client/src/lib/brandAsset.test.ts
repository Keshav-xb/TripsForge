import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const headerAsset = "https://raw.githubusercontent.com/Keshav-xb/TripsForge/main/brand-assets/tripforge-mark-hightech-premium-768.png";
const faviconAsset = "https://raw.githubusercontent.com/Keshav-xb/TripsForge/main/brand-assets/tripforge-mark-hightech-premium-512.png";
const socialAsset = "https://raw.githubusercontent.com/Keshav-xb/TripsForge/main/brand-assets/tripsforge-social-og-final.jpg";
const appleIcon180 = "https://raw.githubusercontent.com/Keshav-xb/TripsForge/main/brand-assets/apple-touch-icon-180.png";
const appleIcon152 = "https://raw.githubusercontent.com/Keshav-xb/TripsForge/main/brand-assets/apple-touch-icon-152.png";
const appleIcon120 = "https://raw.githubusercontent.com/Keshav-xb/TripsForge/main/brand-assets/apple-touch-icon-120.png";
const legacyAsset = "/manus-storage/tripforge-mark_1e8ee249.png";
const heroAsset = "https://raw.githubusercontent.com/Keshav-xb/TripsForge/b2fd6e8975bb4627dff3de2d16514202481f2a0c/client/public/assets/hero-jaipur.jpg";

describe("TripsForge brand asset", () => {
  it("uses the refined transparent asset in the shared mark and favicon", () => {
    const header = readFileSync(resolve(process.cwd(), "client/src/components/SiteHeader.tsx"), "utf8");
    const document = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    const footer = readFileSync(resolve(process.cwd(), "client/src/components/SiteFooter.tsx"), "utf8");
    const account = readFileSync(resolve(process.cwd(), "client/src/pages/Account.tsx"), "utf8");
    const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    const destinations = readFileSync(resolve(process.cwd(), "client/src/lib/tripData.ts"), "utf8");
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    expect(header).toContain(headerAsset);
    expect(home).toContain(heroAsset);
    expect(document).toContain(faviconAsset);
    expect(document).toContain(socialAsset);
    expect(document).toContain(`content="${socialAsset}"`);
    expect(document).toContain('name="twitter:url" content="%VITE_APP_URL%"');
    expect(document).toContain(appleIcon180);
    expect(document).toContain(appleIcon152);
    expect(document).toContain(appleIcon120);
    expect(document).toContain('name="twitter:card" content="summary_large_image"');
    expect(header).not.toContain(legacyAsset);
    expect(document).not.toContain(legacyAsset);
    expect(document).not.toContain("tripforge-mark-premium-transparent-final-clean_dfa3931d.png");
    expect(header).not.toContain("/manus-storage/");
    expect(document).not.toContain("/manus-storage/");
    expect(destinations).not.toContain("/manus-storage/");
    expect(home).not.toContain("/manus-storage/");
    for (const destination of ["jaipur", "goa", "manali", "kerala", "srinagar"]) {
      expect(destinations).toContain(`https://raw.githubusercontent.com/Keshav-xb/TripsForge/3307af91cdc5a51ff45fabc25f69aaf07b6e3942/destination-assets/${destination}.jpg`);
    }
    expect(header).toContain("brand-wordmark");
    expect(footer).toContain("brand-wordmark");
    expect(account).toContain("brand-wordmark");
    expect(styles).toContain('font-family: "Bodoni Moda"');
  });
});
