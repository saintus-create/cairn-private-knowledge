export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIProvider = "openrouter" | "mistral" | "codestral" | "groq" | "custom";

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
    (env("CODESTRAL_API_KEY") ? "codestral" :
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
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(process.env.CAIRN_AI_APP_URL
        ? { "HTTP-Referer": process.env.CAIRN_AI_APP_URL }
        : {}),
      ...(process.env.CAIRN_AI_APP_NAME
        ? { "X-Title": process.env.CAIRN_AI_APP_NAME }
        : { "X-Title": "Cairn" }),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI provider returned ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI provider returned no usable response.");
  }

  return content.trim();
}
