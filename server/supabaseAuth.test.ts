import { describe, expect, it } from "vitest";
import { getVerifiedSupabaseOwnerEmail } from "./supabaseAuth";

const env = {
  VITE_SUPABASE_URL: "https://cairn-example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_example",
  CAIRN_OWNER_EMAIL: "owner@example.com",
};

describe("getVerifiedSupabaseOwnerEmail", () => {
  it("accepts only the configured owner returned by Supabase token verification", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://cairn-example.supabase.co/auth/v1/user");
      expect(init?.headers).toMatchObject({ apikey: "sb_publishable_example", Authorization: "Bearer access-token" });
      return new Response(JSON.stringify({ email: "OWNER@example.com" }), { status: 200 });
    };

    await expect(getVerifiedSupabaseOwnerEmail("Bearer access-token", { env, fetcher: fetcher as typeof fetch }))
      .resolves.toBe("owner@example.com");
  });

  it("rejects a valid token belonging to a different email", async () => {
    const fetcher = async () => new Response(JSON.stringify({ email: "other@example.com" }), { status: 200 });

    await expect(getVerifiedSupabaseOwnerEmail("Bearer access-token", { env, fetcher: fetcher as typeof fetch }))
      .resolves.toBeNull();
  });

  it("fails closed for a missing or rejected token", async () => {
    const fetcher = async () => new Response("Unauthorized", { status: 401 });

    await expect(getVerifiedSupabaseOwnerEmail(undefined, { env, fetcher: fetcher as typeof fetch })).resolves.toBeNull();
    await expect(getVerifiedSupabaseOwnerEmail("Bearer invalid", { env, fetcher: fetcher as typeof fetch })).resolves.toBeNull();
  });
});
