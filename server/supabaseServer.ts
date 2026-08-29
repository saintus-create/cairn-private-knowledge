import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkSupabaseConfig } from "./supabaseConfig";

type ServerClient = SupabaseClient;

let cachedClient: ServerClient | null = null;

/**
 * Server-side Supabase client. The service-role key is never exposed to the
 * browser. The client is intentionally lazy so local evidence-only operation
 * still works when Supabase has not been configured yet.
 */
export function getSupabaseServerClient(): ServerClient | null {
  const checked = checkSupabaseConfig(process.env);
  if (!checked.ready || !checked.config.serviceRoleKey) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient(checked.config.url, checked.config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}

export async function ensureSupabaseUser(input: {
  authUserId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
}) {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client
    .from("users")
    .upsert(
      {
        auth_user_id: input.authUserId,
        name: input.name ?? null,
        email: input.email ?? null,
        login_method: input.loginMethod ?? null,
        last_signed_in: new Date().toISOString(),
      },
      { onConflict: "auth_user_id" },
    )
    .select("id, auth_user_id, name, email, login_method, role, created_at, updated_at, last_signed_in")
    .single();

  if (error) throw error;
  return data;
}

export async function createConversation(input: {
  userId: number;
  projectId?: number | null;
  title?: string | null;
}) {
  const client = getSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("conversations")
    .insert({ user_id: input.userId, project_id: input.projectId ?? null, title: input.title ?? null })
    .select("id, user_id, project_id, title, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function appendConversationMessage(input: {
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: unknown;
  modelProvider?: string | null;
  modelName?: string | null;
}) {
  const client = getSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("conversation_messages")
    .insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      citations: input.citations ?? null,
      model_provider: input.modelProvider ?? null,
      model_name: input.modelName ?? null,
    })
    .select("id, conversation_id, role, content, citations, model_provider, model_name, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function listConversationMessages(conversationId: number, limit = 50) {
  const client = getSupabaseServerClient();
  if (!client) return [];
  const { data, error } = await client
    .from("conversation_messages")
    .select("id, conversation_id, role, content, citations, model_provider, model_name, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
