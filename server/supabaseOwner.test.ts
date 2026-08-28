import { describe, expect, it } from "vitest";
import { getSupabaseOwnerConfig, ownsSupabaseEmail } from "./supabaseOwner";

describe("Supabase owner configuration", () => {
  it("validates the configured project with its server key while retaining the owner identity server-side", async () => {
    const configured = getSupabaseOwnerConfig();
    expect(configured).not.toBeNull();
    if (!configured) return;

    expect(ownsSupabaseEmail(configured.ownerEmail, configured.ownerEmail)).toBe(true);
    const response = await fetch(`${configured.supabase.url}/auth/v1/settings`, {
      headers: { apikey: configured.supabase.serviceRoleKey! },
    });

    expect(response.status).toBe(200);
  });

  it("compares the owner email case-insensitively and rejects other addresses", () => {
    expect(ownsSupabaseEmail("Owner@Example.com", "owner@example.com")).toBe(true);
    expect(ownsSupabaseEmail("other@example.com", "owner@example.com")).toBe(false);
  });
});
