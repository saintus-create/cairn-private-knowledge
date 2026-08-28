import { describe, expect, it } from "vitest";
import { checkSupabaseConfig } from "./supabaseConfig";

describe("checkSupabaseConfig", () => {
  it("fails closed when the Project URL is missing without exposing a server secret", () => {
    const result = checkSupabaseConfig({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_never-expose-this",
    });

    expect(result).toEqual({
      ready: false,
      reasons: ["A valid Supabase Project URL is required."],
    });
    expect(JSON.stringify(result)).not.toContain("sb_secret_never-expose-this");
  });

  it("accepts a coherent public project URL and publishable key", () => {
    const result = checkSupabaseConfig({
      VITE_SUPABASE_URL: "https://cairn-example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_example",
    });

    expect(result).toEqual({
      ready: true,
      config: {
        url: "https://cairn-example.supabase.co",
        publishableKey: "sb_publishable_example",
        serviceRoleKey: "sb_secret_example",
      },
    });
  });

  it("rejects a URL that is not a Supabase project endpoint", () => {
    const result = checkSupabaseConfig({
      VITE_SUPABASE_URL: "https://example.com",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    });

    expect(result).toEqual({
      ready: false,
      reasons: ["A valid Supabase Project URL is required."],
    });
  });
});
