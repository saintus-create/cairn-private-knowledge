import { describe, expect, it } from "vitest";
import { checkSupabaseConfig } from "./supabaseConfig";

describe("Supabase project connectivity", () => {
  it("accepts both configured keys at the selected project without logging them", async () => {
    const checked = checkSupabaseConfig();
    expect(checked.ready).toBe(true);
    if (!checked.ready) return;

    expect(checked.config.serviceRoleKey).toBeTruthy();
    const endpoint = `${checked.config.url}/auth/v1/settings`;

    const [browserResponse, serverResponse] = await Promise.all([
      fetch(endpoint, { headers: { apikey: checked.config.publishableKey } }),
      fetch(endpoint, { headers: { apikey: checked.config.serviceRoleKey! } }),
    ]);

    expect(browserResponse.status).toBe(200);
    expect(serverResponse.status).toBe(200);
  });
});
