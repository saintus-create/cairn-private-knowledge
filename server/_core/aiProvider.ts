export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getAIProviderConfig(): AIProviderConfig {
  const baseUrl = env("CAIRN_AI_BASE_URL") || "https://openrouter.ai/api/v1";
  const apiKey = env("CAIRN_AI_API_KEY");
  const model = env("CAIRN_AI_MODEL") || "openai/gpt-4o-mini";

  if (!apiKey) {
    throw new Error("CAIRN_AI_API_KEY is not configured.");
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model };
}

export async function invokeAI(messages: AIMessage[], options: { temperature?: number } = {}) {
  const config = getAIProviderConfig();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
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
