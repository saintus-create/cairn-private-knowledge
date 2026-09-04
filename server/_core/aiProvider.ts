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
    model: env("CAIRN_AI_MODEL") || "openrouter/free",
  };
}

export async function invokeAI(messages: AIMessage[], options: { temperature?: number } = {}) {
  const config = getAIProviderConfig();
  
  // Build the URL based on provider
  let url: string;
  let requestBody: unknown;
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    ...(process.env.CAIRN_AI_APP_URL
      ? { "HTTP-Referer": process.env.CAIRN_AI_APP_URL }
      : {}),
    ...(process.env.CAIRN_AI_APP_NAME
      ? { "X-Title": process.env.CAIRN_AI_APP_NAME }
      : { "X-Title": "Cairn" }),
  };

  if (config.provider === "huggingface") {
    // Hugging Face inference API for chat/text generation
    // Some models support /chat/completions, others need /models/{model}/chat/completions
    // or the text generation endpoint
    const modelPath = config.model.replace(/\//g, "%2F"); // URL encode slashes
    url = `${config.baseUrl.replace(/\/$/, "")}/models/${modelPath}`;
    
    // Convert messages to Hugging Face chat format or text prompt
    const lastUserMessage = messages.filter(m => m.role === "user").at(-1)?.content || "";
    const systemPrompt = messages.filter(m => m.role === "system").at(-1)?.content || "";
    
    // Try OpenAI-compatible chat endpoint first for Hugging Face
    // If that fails, fall back to text generation
    requestBody = {
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: 1024,
    };
  } else {
    // OpenAI-compatible providers (OpenRouter, Mistral, Codestral, Groq, Custom)
    url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    requestBody = {
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.2,
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI provider returned ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = await response.json();
  let content: string;

  if (config.provider === "huggingface") {
    // Hugging Face response format
    // Could be OpenAI-compatible { choices: [{ message: { content } }] }
    // or Hugging Face format { generated_text: "..." } or [ { generated_text: "..." } ]
    if (Array.isArray(payload)) {
      // Text generation response: [ { generated_text: "..." } ]
      content = payload[0]?.generated_text as string;
    } else if (typeof payload === "object" && payload && "generated_text" in payload) {
      // Single text generation response: { generated_text: "..." }
      content = (payload as { generated_text?: string }).generated_text as string;
    } else if (typeof payload === "object" && payload && "choices" in payload) {
      // OpenAI-compatible chat response
      content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content as string;
    } else {
      throw new Error(`Unexpected Hugging Face response format: ${JSON.stringify(payload).slice(0, 200)}`);
    }
  } else {
    // OpenAI-compatible response format
    content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content as string;
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI provider returned no usable response.");
  }

  return content.trim();
}
