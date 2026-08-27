import { describe, expect, it } from "vitest";
import { getSupabaseConfiguration } from "./supabase";

describe("getSupabaseConfiguration", () => {
  it("marks empty Vercel variables as unconfigured without throwing", () => {
    expect(getSupabaseConfiguration({})).toMatchObject({
      isConfigured: false,
      url: undefined,
      publishableKey: undefined,
    });
  });

  it("accepts trimmed browser-safe Supabase configuration values", () => {
    expect(getSupabaseConfiguration({
      url: " https://project.supabase.co ",
      publishableKey: " sb_publishable_example ",
    })).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_example",
      isConfigured: true,
    });
  });
});
