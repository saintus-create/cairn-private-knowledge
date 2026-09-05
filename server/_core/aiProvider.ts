/**
 * Legacy AI Provider Types
 * 
 * NOTE: For new implementations, use aiOrchestrator.ts which provides:
 * - Multi-provider failover chain (7 providers)
 * - Circuit breakers per provider
 * - Response caching (5 min TTL)
 * - Request deduplication (1 min window)
 * - Exponential backoff retries (default 3)
 * - Graceful degradation (never fails completely)
 * - Timeout protection (60s default)
 * - Health monitoring
 * 
 * This file is kept for backward compatibility.
 */

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIProvider = "openrouter" | "mistral" | "codestral" | "groq" | "huggingface" | "custom";

export type AIProviderConfig = {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/**
 * Get AI provider configuration (legacy)
 * @deprecated Use aiOrchestrator.ts for new implementations
 */
export function getAIProviderConfig(): AIProviderConfig {
  const requestedProvider = env("CAIRN_AI_PROVIDER").toLowerCase() as AIProvider | "";
  const provider: AIProvider = requestedProvider ||
    (env("HUGGINGFACE_API_KEY") ? "huggingface" :
      env("CODESTRAL_API_KEY") ? "codestral" :
        env("MISTRAL_API_KEY") ? "mistral" :
          env("GROQ_API_KEY") ? "groq" : "openrouter");

  if (provider === "mistral") {
    const apiKey = env("MISTRAL_API_KEY") || env("CAIRN_AI_API_KEY");
    if (!apiKey) throw new Error("MISTRAL_API_KEY or CAIRN_AI_API_KEY is not configured.");
    return {
      provider,
      baseUrl: env("CAIRN_AI_BASE_URL") || "https://api.mistral.ai/v1",
      apiKey,
      model: env("CAIRN_AI_MODEL") || "mistral-small-latest",
    };
  }

  if (provider === "codestral") {
    const apiKey = env("CODESTRAL_API_KEY") || env("MISTRAL_API_KEY") || env("CAIRN_AI_API_KEY");
    if (!apiKey) throw new Error("CODESTRAL_API_KEY, MISTRAL_API_KEY, or CAIRN_AI_API_KEY is not configured.");
    return {
      provider,
      baseUrl: env("CAIRN_AI_BASE_URL") || "https://api.mistral.ai/v1",
      apiKey,
      model: env("CAIRN_AI_MODEL") || "codestral-2508",
    };
  }

  if (provider === "groq") {
    const apiKey = env("GROQ_API_KEY") || env("CAIRN_AI_API_KEY");
    if (!apiKey) throw new Error("GROQ_API_KEY or CAIRN_AI_API_KEY is not configured.");
    return {
      provider,
      baseUrl: env("CAIRN_AI_BASE_URL") || "https://api.groq.com/openai/v1",
      apiKey,
      model: env("CAIRN_AI_MODEL") || "openai/gpt-oss-120b",
    };
  }

  if (provider === "huggingface") {
    const apiKey = env("HUGGINGFACE_API_KEY") || env("CAIRN_AI_API_KEY");
    if (!apiKey) throw new Error("HUGGINGFACE_API_KEY or CAIRN_AI_API_KEY is not configured.");
    return {
      provider,
      baseUrl: env("CAIRN_AI_BASE_URL") || "https://api-inference.huggingface.co",
      apiKey,
      model: env("CAIRN_AI_MODEL") || "laurabernardy/LuxGPT-basedEN",
    };
  }

  if (provider === "custom") {
    const apiKey = env("CAIRN_AI_API_KEY");
    if (!apiKey) throw new Error("CAIRN_AI_API_KEY is not configured.");
    return {
      provider,
      baseUrl: env("CAIRN_AI_BASE_URL"),
      apiKey,
      model: env("CAIRN_AI_MODEL") || "openrouter/free",
    };
  }

  const apiKey = env("CAIRN_AI_API_KEY");
  if (!apiKey) throw new Error("CAIRN_AI_API_KEY is not configured.");
  return {
    provider: "openrouter",
    baseUrl: env("CAIRN_AI_BASE_URL") || "https://openrouter.ai/api/v1",
    apiKey,
    model: env("CAIRN_AI_MODEL") || "openai/gpt-4o-mini",
  };
}

/**
 * Legacy invokeAI function
 * 
 * @deprecated Use the Supreme AI Orchestrator from aiOrchestrator.ts instead
 * 
 * The new orchestrator provides:
 * - Automatic failover between all 6+ providers
 * - Circuit breakers to prevent cascading failures
 * - Response caching for cost savings and speed
 * - Request deduplication to prevent duplicate calls
 * - Exponential backoff retries
 * - Graceful degradation when all providers fail
 * - Comprehensive error tracking and logging
 * - Timeout protection
 * 
 * For new code, import from aiOrchestrator.ts:
 *   import { invokeAI } from "./aiOrchestrator";
 */
export async function invokeAI(messages: AIMessage[], options: { temperature?: number } = {}): Promise<string> {
  // Delegate to the Supreme AI Orchestrator
  const { invokeAI: supremeInvokeAI } = await import("./aiOrchestrator");
  
  const result = await supremeInvokeAI(messages, {
    ...options,
    enableCache: true,
    enableDeduplication: true,
    maxAttempts: 20, // Try hard - up to 20 provider attempts
    maxRetries: 3,
    timeout: 60000,
  });
  
  return result.response;
}

// Re-export types for backward compatibility
export type { AIMessage, AIProvider, AIProviderConfig };
