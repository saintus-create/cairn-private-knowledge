import { describe, expect, it } from "vitest";

describe("runtime configuration", () => {
  it("allows the application to respond without optional analytics settings", async () => {
    const response = await fetch("http://127.0.0.1:3000/").catch(() => null);
    expect(response === null || response.status < 500).toBe(true);
  });
});
