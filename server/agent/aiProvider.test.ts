import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeAI, clearAllCaches } from "../_core/aiOrchestrator";

describe("AI Orchestrator", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CAIRN_AI_API_KEY = "test-key";
    process.env.CAIRN_AI_MODEL = "openai/gpt-4o-mini";
    globalThis.fetch = vi.fn();
    clearAllCaches();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    clearAllCaches();
  });

  it("returns graceful error when no provider has API key", async () => {
    delete process.env.CAIRN_AI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.CODESTRAL_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;

    const answer = await invokeAI([{ role: "user", content: "Hello" }]);

    expect(answer.response).toContain("unavailable");
    expect(answer.fromCache).toBe(false);
    expect(answer.errors.length).toBeGreaterThan(0);
  });

  it("caches responses when enabled", async () => {
    // Mock the first provider (OpenRouter) which has the API key
    // Need to mock all potential provider URLs that the orchestrator might try
    const mockFetch = vi.fn()
      .mockImplementation((url: RequestInfo | URL, options?: RequestInit) => {
        // Check if this is a request to OpenRouter (first provider in priority)
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        // Mock successful response for OpenRouter
        if (urlStr.includes('openrouter.ai') || urlStr.includes('openrouter')) {
          return Promise.resolve(
            new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), {
              status: 200,
              headers: { "content-type": "application/json" },
            })
          );
        }
        
        // For other providers, return error responses to simulate them being down
        return Promise.reject(new Error('Provider unavailable'));
      });
    
    globalThis.fetch = mockFetch;

    const answer1 = await invokeAI([{ role: "user", content: "Hello" }], {
      enableCache: true,
      globalTimeout: 5000, // 5 second global timeout
      maxAttempts: 2, // Limit attempts to prevent timeout
    });

    expect(answer1.fromCache).toBe(false);
    expect(answer1.response).toBe("hello");

    const answer2 = await invokeAI([{ role: "user", content: "Hello" }], {
      enableCache: true,
      globalTimeout: 5000,
      maxAttempts: 2,
    });

    expect(answer2.fromCache).toBe(true);
    expect(answer2.response).toBe("hello");
  }, 10000);

  it("handles all providers failing gracefully", async () => {
    const mockFetch = vi.fn()
      .mockImplementation(() => 
        Promise.reject(new Error('All providers down'))
      );
    
    // Remove all API keys to ensure no providers are available
    delete process.env.CAIRN_AI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.CODESTRAL_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;
    
    globalThis.fetch = mockFetch;

    const answer = await invokeAI([{ role: "user", content: "Hello" }], {
      maxAttempts: 2,
      maxRetries: 0,
      globalTimeout: 2000,
    });

    expect(answer.response).toContain("unavailable");
    expect(answer.fromCache).toBe(false);
    expect(answer.errors.length).toBeGreaterThan(0);
    expect(answer.provider).toBe("none");
  }, 10000);
});
