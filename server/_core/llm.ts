import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";
export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = { role: Role; content: MessageContent | MessageContent[]; name?: string; tool_call_id?: string };
export type Tool = { type: "function"; function: { name: string; description?: string; parameters?: Record<string, unknown> } };
export type ToolChoice = "none" | "auto" | "required" | { name: string } | { type: "function"; function: { name: string } };
export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type OutputSchema = JsonSchema;
export type ResponseFormat = { type: "text" } | { type: "json_object" } | { type: "json_schema"; json_schema: JsonSchema };
export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{ index: number; message: { role: Role; content: string | Array<TextContent | ImageContent | FileContent>; tool_calls?: ToolCall[] }; finish_reason: string | null }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};
export type ModelInfo = { id: string; object: string; created: number; owned_by: string };
export type ModelsResponse = { object: string; data: ModelInfo[] };

const normalizeContent = (content: MessageContent | MessageContent[]) => {
  const parts = Array.isArray(content) ? content : [content];
  const normalized = parts.map((part) => typeof part === "string" ? { type: "text", text: part } : part);
  return normalized.length === 1 && normalized[0].type === "text" ? normalized[0].text : normalized;
};
const normalizeMessage = (message: Message) => ({ role: message.role, ...(message.name ? { name: message.name } : {}), ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}), content: normalizeContent(message.content) });
const normalizeToolChoice = (choice: ToolChoice | undefined, tools?: Tool[]) => {
  if (!choice) return undefined;
  if (choice === "required") {
    if (!tools?.length) throw new Error("tool_choice 'required' needs at least one tool");
    if (tools.length !== 1) throw new Error("tool_choice 'required' needs one tool or an explicit tool name");
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if (choice === "none" || choice === "auto") return choice;
  if ("name" in choice) return { type: "function", function: { name: choice.name } };
  return choice;
};

const resolveApiUrl = () => `${ENV.aiBaseUrl.replace(/\/$/, "")}/chat/completions`;
const assertApiKey = () => { if (!ENV.aiApiKey) throw new Error("CAIRN_AI_API_KEY is not configured"); };
const responseFormat = (input: InvokeParams) => input.responseFormat ?? input.response_format ?? (input.outputSchema || input.output_schema ? { type: "json_schema" as const, json_schema: input.outputSchema ?? input.output_schema! } : undefined);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchWithBackoff(url: string, init: RequestInit) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === 4) return response;
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      await response.body?.cancel().catch(() => undefined);
      const cap = Math.min(500 * 2 ** attempt, 30_000);
      await sleep(Math.min(Math.max(retryAfter * 1000, cap / 2 + Math.random() * cap / 2), 30_000));
    } catch (error) {
      lastError = error;
      if (attempt === 4) throw error;
      await sleep(Math.min(500 * 2 ** attempt, 30_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI request failed");
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();
  const payload: Record<string, unknown> = { model: params.model ?? ENV.aiModel, messages: params.messages.map(normalizeMessage) };
  if (params.tools?.length) payload.tools = params.tools;
  const choice = normalizeToolChoice(params.toolChoice ?? params.tool_choice, params.tools);
  if (choice) payload.tool_choice = choice;
  const maxTokens = params.max_tokens ?? params.maxTokens;
  if (typeof maxTokens === "number") payload.max_tokens = maxTokens;
  if (params.thinking) payload.thinking = params.thinking;
  if (params.reasoning) payload.reasoning = params.reasoning;
  const format = responseFormat(params);
  if (format) payload.response_format = format;

  const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${ENV.aiApiKey}` };
  if (ENV.aiAppUrl) { headers["HTTP-Referer"] = ENV.aiAppUrl; headers["X-Title"] = "Cairn"; }
  const response = await fetchWithBackoff(resolveApiUrl(), { method: "POST", headers, body: JSON.stringify(payload) });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cairn AI request failed: ${response.status} ${response.statusText} – ${errorText}`);
  }
  return await response.json() as InvokeResult;
}

export async function listLLMModels(): Promise<ModelsResponse> {
  assertApiKey();
  const response = await fetchWithBackoff(`${ENV.aiBaseUrl.replace(/\/$/, "")}/models`, { headers: { authorization: `Bearer ${ENV.aiApiKey}` } });
  if (!response.ok) throw new Error(`Cairn AI model listing failed: ${response.status} ${response.statusText}`);
  return await response.json() as ModelsResponse;
}
