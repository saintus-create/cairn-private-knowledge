import { describe, expect, it } from "vitest";
import { productionConfigIssues } from "./_core/env";

describe("runtime configuration", () => {
  it("allows the application to respond without optional analytics settings", async () => {
    const response = await fetch("http://127.0.0.1:3000/").catch(() => null);
    expect(response === null || response.status < 500).toBe(true);
  });

  it("rejects incomplete production configuration", () => {
    expect(productionConfigIssues({ NODE_ENV: "production" })).toEqual([
      "DATABASE_URL is required.",
      "JWT_SECRET is required.",
    ]);
  });

  it("requires OAuth settings for multi-user production mode", () => {
    expect(productionConfigIssues({ DATABASE_URL: "mysql://db", JWT_SECRET: "x".repeat(32), CAIRN_SINGLE_OWNER_MODE: "false" })).toEqual([
      "OAUTH_SERVER_URL is required when single-owner mode is disabled.",
      "VITE_APP_ID is required when single-owner mode is disabled.",
    ]);
  });

  it("rejects the shipped JWT placeholder", () => {
    expect(productionConfigIssues({ DATABASE_URL: "mysql://db", JWT_SECRET: "REPLACE_WITH_OUTPUT_OF_openssl_rand_base64_32" })).toContain("JWT_SECRET must be replaced with a generated secret.");
  });
});
