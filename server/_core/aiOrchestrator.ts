/**
 * Cairn AI Orchestrator
 * 
 * Multi-provider AI interface with automatic failover, 
 * circuit breakers, caching, and graceful degradation.
 * 
 * Features:
 * - Multi-provider failover chain
 * - Exponential backoff retries
 * - Circuit breakers per provider
 * - Response caching
 * - Graceful degradation
 * - Timeout protection
 * - Request deduplication
 * 
 * Usage:
 *   const response = await invokeAI(messages);
 */

// Define AIMessage locally to avoid circular import issues
export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Provider configuration with health tracking
 */
export interface OrchestratorProvider {
  id: string;
  name: string;
  type: "openrouter" | "mistral" | "codestral" | "groq" | "huggingface" | "custom";
  baseUrl: string;
  apiKeyEnv: string;
  model: string;
  
  // Health tracking
  isHealthy: boolean;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  consecutiveFailures: number;
  
  // Priority (lower = tried first)
  priority: number;
}

/**
 * Circuit breaker state
 */
interface CircuitBreaker {
  isOpen: boolean;
  lastOpenedAt: number | null;
  nextAttemptAt: number | null;
  failureThreshold: number;
  recoveryTimeout: number;
}

/**
 * Cached response
 */
interface CachedResponse {
  hash: string;
  response: string;
  timestamp: number;
  ttl: number; // Time to live in ms
}

/**
 * Request context for tracing
 */
export interface AIRequestContext {
  requestId: string;
  timestamp: number;
  providerAttempts: Array<{
    provider: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  finalProvider: string | null;
  fromCache: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 1000; // 1 second initial backoff
const CACHE_TTL_MS = 300000; // 5 minutes
const DEDUPLICATION_WINDOW_MS = 60000; // 1 minute

// Provider priority order (lower = tried first)
const PROVIDER_PRIORITY = {
  openrouter: 10,
  mistral: 20,
  codestral: 30,
  groq: 40,
  huggingface: 50,
  custom: 60,
};

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG: CircuitBreaker = {
  isOpen: false,
  lastOpenedAt: null,
  nextAttemptAt: null,
  failureThreshold: 5, // Open circuit after 5 consecutive failures
  recoveryTimeout: 300000, // 5 minutes recovery time
};

// In-memory cache (in production, use Redis)
const responseCache = new Map<string, CachedResponse>();

// Deduplication cache (prevent duplicate requests)
const deduplicationCache = new Map<string, {
  promise: Promise<string>;
  timestamp: number;
}>();

// Provider registry with health tracking
const providers: OrchestratorProvider[] = [
  {
    id: "openrouter-primary",
    name: "OpenRouter Primary",
    type: "openrouter",
    baseUrl: process.env.CAIRN_AI_BASE_URL || "https://openrouter.ai/api/v1",
    apiKeyEnv: "CAIRN_AI_API_KEY",
    model: process.env.CAIRN_AI_MODEL || "openai/gpt-4o-mini",
    isHealthy: true,
    lastFailureTime: null,
    lastSuccessTime: null,
    consecutiveFailures: 0,
    priority: PROVIDER_PRIORITY.openrouter,
  },
  {
    id: "mistral",
    name: "Mistral AI",
    type: "mistral",
    baseUrl: "https://api.mistral.ai/v1",
    apiKeyEnv: "MISTRAL_API_KEY",
    model: "mistral-small-latest",
    isHealthy: true,
    lastFailureTime: null,
    lastSuccessTime: null,
    consecutiveFailures: 0,
    priority: PROVIDER_PRIORITY.mistral,
  },
  {
    id: "codestral",
    name: "Codestral",
    type: "codestral",
    baseUrl: "https://api.mistral.ai/v1",
    apiKeyEnv: "CODESTRAL_API_KEY",
    model: "codestral-2508",
    isHealthy: true,
    lastFailureTime: null,
    lastSuccessTime: null,
    consecutiveFailures: 0,
    priority: PROVIDER_PRIORITY.codestral,
  },
  {
    id: "groq",
    name: "Groq",
    type: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
    isHealthy: true,
    lastFailureTime: null,
    lastSuccessTime: null,
    consecutiveFailures: 0,
    priority: PROVIDER_PRIORITY.groq,
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    type: "huggingface",
    baseUrl: process.env.CAIRN_AI_BASE_URL || "https://api-inference.huggingface.co",
    apiKeyEnv: "HUGGINGFACE_API_KEY",
    model: process.env.CAIRN_AI_MODEL || "laurabernardy/LuxGPT-basedEN",
    isHealthy: true,
    lastFailureTime: null,
    lastSuccessTime: null,
    consecutiveFailures: 0,
    priority: PROVIDER_PRIORITY.huggingface,
  },
  {
    id: "openrouter-fallback",
    name: "OpenRouter Fallback",
    type: "openrouter",
    baseUrl: process.env.CAIRN_AI_BASE_URL || "https://openrouter.ai/api/v1",
    apiKeyEnv: "CAIRN_AI_API_KEY",
    model: "openrouter/free",
    isHealthy: true,
    lastFailureTime: null,
    lastSuccessTime: null,
    consecutiveFailures: 0,
    priority: PROVIDER_PRIORITY.openrouter + 100,
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a hash of the request for caching/deduplication
 */
function createRequestHash(messages: AIMessage[]): string {
  const normalized = JSON.stringify(
    messages.map(m => ({
      role: m.role,
      content: m.content.slice(0, 200), // Limit for hash
    }))
  );
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}

/**
 * Sleep for specified milliseconds
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get API key for a provider
 */
function getProviderApiKey(provider: OrchestratorProvider): string {
  const key = process.env[provider.apiKeyEnv];
  // Also check fallback keys
  const fallbackKeys = {
    openrouter: ["CAIRN_AI_API_KEY", "OPENROUTER_API_KEY"],
    mistral: ["MISTRAL_API_KEY", "CAIRN_AI_API_KEY"],
    codestral: ["CODESTRAL_API_KEY", "MISTRAL_API_KEY", "CAIRN_AI_API_KEY"],
    groq: ["GROQ_API_KEY", "CAIRN_AI_API_KEY"],
    huggingface: ["HUGGINGFACE_API_KEY", "CAIRN_AI_API_KEY"],
    custom: ["CAIRN_AI_API_KEY"],
  };
  
  if (key) return key;
  
  for (const fallback of fallbackKeys[provider.type] || []) {
    const fallbackKey = process.env[fallback];
    if (fallbackKey) return fallbackKey;
  }
  
  return "";
}

/**
 * Check if circuit breaker is open for a provider
 */
function isCircuitOpen(provider: OrchestratorProvider): boolean {
  if (!provider.isHealthy && provider.consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    const cooldownPassed = provider.lastFailureTime 
      ? Date.now() - provider.lastFailureTime > CIRCUIT_BREAKER_CONFIG.recoveryTimeout
      : true;
    return !cooldownPassed;
  }
  return false;
}

/**
 * Check if provider is available (healthy + circuit closed)
 */
function isProviderAvailable(provider: OrchestratorProvider): boolean {
  const hasApiKey = !!getProviderApiKey(provider);
  const isCircuitClosed = !isCircuitOpen(provider);
  return hasApiKey && isCircuitClosed && provider.isHealthy;
}

// ============================================================================
// PROVIDER IMPLEMENTATIONS
// ============================================================================

/**
 * Invoke a single provider
 */
async function invokeSingleProvider(
  provider: OrchestratorProvider,
  messages: AIMessage[],
  options: { temperature?: number; timeout?: number } = {}
): Promise<{ response: string; duration: number; success: boolean; error?: string }> {
  const startTime = Date.now();
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  const temperature = options.temperature ?? 0.2;
  
  try {
    const apiKey = getProviderApiKey(provider);
    if (!apiKey) {
      return {
        response: "",
        duration: Date.now() - startTime,
        success: false,
        error: `No API key for ${provider.name}`,
      };
    }
    
    // Build URL based on provider type
    let url: string;
    let requestBody: unknown;
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(process.env.CAIRN_AI_APP_URL && { "HTTP-Referer": process.env.CAIRN_AI_APP_URL }),
      ...(process.env.CAIRN_AI_APP_NAME && { "X-Title": process.env.CAIRN_AI_APP_NAME }),
    };
    
    if (provider.type === "huggingface") {
      // Hugging Face inference API
      const modelPath = provider.model.replace(/\//g, "%2F");
      url = `${provider.baseUrl.replace(/\/$/, "")}/models/${modelPath}`;
      
      // Try chat completion format first
      requestBody = {
        messages,
        temperature,
        max_tokens: 1024,
      };
    } else {
      // OpenAI-compatible providers
      url = `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`;
      requestBody = {
        model: provider.model,
        messages,
        temperature,
      };
    }
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const errorMsg = `Provider ${provider.name} returned ${response.status}: ${detail.slice(0, 200)}`;
      return {
        response: "",
        duration: Date.now() - startTime,
        success: false,
        error: errorMsg,
      };
    }
    
    const payload = await response.json();
    let content: string;
    
    if (provider.type === "huggingface") {
      // Handle Hugging Face response formats
      if (Array.isArray(payload)) {
        content = payload[0]?.generated_text as string;
      } else if (typeof payload === "object" && payload && "generated_text" in payload) {
        content = (payload as { generated_text?: string }).generated_text as string;
      } else if (typeof payload === "object" && payload && "choices" in payload) {
        content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content as string;
      } else {
        content = JSON.stringify(payload);
      }
    } else {
      // OpenAI-compatible response
      content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content as string;
    }
    
    if (typeof content !== "string" || !content.trim()) {
      return {
        response: "",
        duration: Date.now() - startTime,
        success: false,
        error: `Empty response from ${provider.name}`,
      };
    }
    
    // Update provider health
    provider.isHealthy = true;
    provider.lastSuccessTime = Date.now();
    provider.consecutiveFailures = 0;
    
    return {
      response: content.trim(),
      duration: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Update provider health
    provider.consecutiveFailures++;
    provider.lastFailureTime = Date.now();
    
    // Check if circuit should open
    if (provider.consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      provider.isHealthy = false;
    }
    
    return {
      response: "",
      duration,
      success: false,
      error: `Provider ${provider.name} error: ${errorMsg}`,
    };
  }
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * AI Orchestrator Options
 */
export interface AIOrchestratorOptions {
  /** Maximum number of provider attempts (across all providers) */
  maxAttempts?: number;
  /** Temperature for AI responses (0-1) */
  temperature?: number;
  /** Request timeout in milliseconds (per provider attempt) */
  timeout?: number;
  /** Maximum retries per provider */
  maxRetries?: number;
  /** Enable response caching */
  enableCache?: boolean;
  /** Enable request deduplication */
  enableDeduplication?: boolean;
  /** Custom provider list (overrides default) */
  providers?: OrchestratorProvider[];
  /** Global timeout in milliseconds (total time for all attempts) */
  globalTimeout?: number;
}

/**
 * Result from AI Orchestrator
 */
export interface AIOrchestratorResult {
  /** The AI response */
  response: string;
  /** Whether the response came from cache */
  fromCache: boolean;
  /** Provider that generated the response */
  provider: string;
  /** Total duration in milliseconds */
  duration: number;
  /** Number of attempts made */
  attempts: number;
  /** List of errors from failed attempts */
  errors: string[];
  /** Request context for debugging */
  context: AIRequestContext;
}

/**
 * Main AI invocation function
 * 
 * Attempts all available providers in priority order with
 * retries, circuit breakers, and graceful degradation.
 * 
 * @param messages - The chat messages
 * @param options - Orchestrator options
 * @returns Promise<AIOrchestratorResult> - Resolves with response or graceful error
 */
async function invokeAIOrchestrator(
  messages: AIMessage[],
  options: AIOrchestratorOptions = {}
): Promise<AIOrchestratorResult> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const maxAttempts = options.maxAttempts ?? providers.length * 2;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const enableCache = options.enableCache ?? true;
  const enableDeduplication = options.enableDeduplication ?? true;
  const temperature = options.temperature ?? 0.2;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const globalTimeout = options.globalTimeout ?? DEFAULT_TIMEOUT_MS * 2; // 2 minutes default
  
  // Create request hash for caching/deduplication
  const requestHash = createRequestHash(messages);
  
  // Check deduplication cache
  if (enableDeduplication) {
    const existingRequest = deduplicationCache.get(requestHash);
    if (existingRequest && Date.now() - existingRequest.timestamp < DEDUPLICATION_WINDOW_MS) {
      // Return cached promise
      const result = await existingRequest.promise;
      return {
        ...result,
        fromCache: false, // Not from response cache, but deduplicated
        context: {
          ...result.context,
          requestId,
          timestamp: startTime,
        },
      };
    }
  }
  
  // Check response cache
  if (enableCache) {
    const cached = responseCache.get(requestHash);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return {
        response: cached.response,
        fromCache: true,
        provider: "cache",
        duration: 0,
        attempts: 0,
        errors: [],
        context: {
          requestId,
          timestamp: startTime,
          providerAttempts: [],
          finalProvider: "cache",
          fromCache: true,
        },
      };
    }
  }
  
  // Sort providers by priority and health
  const activeProviders = [...providers]
    .filter(p => isProviderAvailable(p))
    .sort((a, b) => a.priority - b.priority);
  
  if (activeProviders.length === 0) {
    // No providers available - return graceful degradation
    return {
      response: "I apologize, but all AI providers are currently unavailable. Please try again later.",
      fromCache: false,
      provider: "none",
      duration: Date.now() - startTime,
      attempts: 0,
      errors: providers.map(p => `Provider ${p.name} is unavailable: ${getProviderApiKey(p) ? 'No API key' : 'Circuit open'}`),
      context: {
        requestId,
        timestamp: startTime,
        providerAttempts: [],
        finalProvider: null,
        fromCache: false,
      },
    };
  }
  
  // Context tracking
  const context: AIRequestContext = {
    requestId,
    timestamp: startTime,
    providerAttempts: [],
    finalProvider: null,
    fromCache: false,
  };
  
  const errors: string[] = [];
  let finalResponse: string = "";
  let attempts = 0;
  
  // Create deduplication promise
  let deduplicationPromise: Promise<AIOrchestratorResult> | null = null;
  
  if (enableDeduplication) {
    // Don't pass enableDeduplication to avoid infinite loop
    const dedupOptions = { ...options, enableDeduplication: false };
    deduplicationPromise = invokeAIOrchestrator(messages, dedupOptions);
    deduplicationCache.set(requestHash, {
      promise: deduplicationPromise,
      timestamp: Date.now(),
    });
  }
  
  // Try each provider in priority order
  for (const provider of activeProviders) {
    if (attempts >= maxAttempts) break;
    
    // Skip if circuit is open
    if (isCircuitOpen(provider)) {
      errors.push(`Provider ${provider.name} circuit is open (cooldown)`);
      context.providerAttempts.push({
        provider: provider.id,
        success: false,
        duration: 0,
        error: "Circuit open",
      });
      attempts++;
      continue;
    }
    
    // Try with retries
    let retryCount = 0;
    let success = false;
    let response = "";
    let lastError = "";
    
    while (retryCount <= maxRetries && !success && attempts < maxAttempts) {
      attempts++;
      retryCount++;
      
      const result = await invokeSingleProvider(provider, messages, {
        temperature,
        timeout,
      });
      
      context.providerAttempts.push({
        provider: provider.id,
        success: result.success,
        duration: result.duration,
        error: result.error,
      });
      
      if (result.success) {
        response = result.response;
        success = true;
        context.finalProvider = provider.id;
        
        // Cache the response
        if (enableCache && response.length > 0) {
          responseCache.set(requestHash, {
            hash: requestHash,
            response,
            timestamp: Date.now(),
            ttl: CACHE_TTL_MS,
          });
        }
        
        break;
      } else {
        lastError = result.error || "Unknown error";
        errors.push(lastError);
        
        // Exponential backoff before retry
        if (retryCount < maxRetries) {
          await sleep(DEFAULT_BACKOFF_MS * Math.pow(2, retryCount));
        }
      }
    }
    
    if (success) {
      finalResponse = response;
      break; // Success - stop trying other providers
    }
    
    // Check global timeout
    if (Date.now() - startTime > globalTimeout) {
      errors.push(`Global timeout of ${globalTimeout}ms exceeded`);
      break;
    }
  }
  
  const duration = Date.now() - startTime;
  
  // If no provider succeeded, return graceful degradation
  if (!finalResponse) {
    finalResponse = `I'm experiencing technical difficulties. Please try again in a moment. (Errors: ${errors.slice(0, 3).join('; ')})`;
    context.finalProvider = "fallback";
  }
  
  // Clean up deduplication cache
  if (enableDeduplication) {
    deduplicationCache.delete(requestHash);
  }
  
  return {
    response: finalResponse,
    fromCache: false,
    provider: context.finalProvider || "none",
    duration,
    attempts,
    errors,
    context,
  };
}

// ============================================================================
// HEALTH CHECKS
// ============================================================================

/**
 * Check health of all providers
 */
export async function checkAllProviderHealth(): Promise<Array<{
  provider: string;
  healthy: boolean;
  error?: string;
  latency?: number;
}>> {
  const results: Array<{
    provider: string;
    healthy: boolean;
    error?: string;
    latency?: number;
  }> = [];
  
  for (const provider of providers) {
    if (!getProviderApiKey(provider)) {
      results.push({
        provider: provider.id,
        healthy: false,
        error: "No API key configured",
      });
      continue;
    }
    
    if (isCircuitOpen(provider)) {
      results.push({
        provider: provider.id,
        healthy: false,
        error: "Circuit breaker is open",
      });
      continue;
    }
    
    const startTime = Date.now();
    try {
      // Simple health check request
      const apiKey = getProviderApiKey(provider);
      const modelPath = provider.type === "huggingface" 
        ? provider.model.replace(/\//g, "%2F") 
        : "";
      const url = provider.type === "huggingface"
        ? `${provider.baseUrl.replace(/\/$/, "")}/models/${modelPath}`
        : `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "ping" }],
          temperature: 0,
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });
      
      const latency = Date.now() - startTime;
      results.push({
        provider: provider.id,
        healthy: response.ok,
        latency,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      });
    } catch (error) {
      const latency = Date.now() - startTime;
      results.push({
        provider: provider.id,
        healthy: false,
        latency,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  return results;
}

/**
 * Get provider health status
 */
export function getProviderStatus(): Array<{
  id: string;
  name: string;
  isHealthy: boolean;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}> {
  return providers.map(p => ({
    id: p.id,
    name: p.name,
    isHealthy: p.isHealthy,
    consecutiveFailures: p.consecutiveFailures,
    lastFailureTime: p.lastFailureTime,
    lastSuccessTime: p.lastSuccessTime,
  }));
}

/**
 * Reset circuit breaker for a provider
 */
export function resetProviderCircuit(providerId: string): void {
  const provider = providers.find(p => p.id === providerId);
  if (provider) {
    provider.isHealthy = true;
    provider.consecutiveFailures = 0;
    provider.lastFailureTime = null;
  }
}

/**
 * Clear response cache
 */
export function clearResponseCache(): void {
  responseCache.clear();
}

/**
 * Clear deduplication cache
 */
export function clearDeduplicationCache(): void {
  deduplicationCache.clear();
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  clearResponseCache();
  clearDeduplicationCache();
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy invokeAI function for backward compatibility
 * This now delegates to the AI Orchestrator
 */
export async function legacyInvokeAI(messages: AIMessage[], options: { temperature?: number } = {}): Promise<string> {
  const result = await invokeAIOrchestrator(messages, { ...options, enableCache: false });
  return result.response;
}

// Main export - invokeAI is the primary interface
export { invokeAIOrchestrator as invokeAI };

// Export types
export type { AIMessage };
