import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { invokeModel } from "../_core/aiProvider";

describe("independent AI provider", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CAIRN_AI_API_KEY = "test-key";
    process.env.CAIRN_AI_BASE_URL = "https://example.test/v1";
    process.env.CAIRN_AI_MODEL = "test-model";
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses the configured OpenAI-compatible endpoint", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const answer = await invokeModel({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(answer).toBe("hello");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    );
  });

  it("fails clearly when the provider is not configured", async () => {
    delete process.env.CAIRN_AI_API_KEY;

    await expect(
      invokeModel({ messages: [{ role: "user", content: "Hello" }] }),
    ).rejects.toThrow(/CAIRN_AI_API_KEY/);
  });
});
