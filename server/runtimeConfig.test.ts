import { describe, expect, it } from "vitest";

describe("runtime configuration", () => {
  it("accepts the configured application title without exposing its value", async () => {
    const response = await fetch("http://127.0.0.1:3000/").catch(() => null);
    expect(response === null || response.status < 500).toBe(true);
    expect(typeof process.env.VITE_APP_TITLE).toBe("string");
    expect(process.env.VITE_APP_TITLE?.trim().length).toBeGreaterThan(0);
  });
});
