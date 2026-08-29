import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkSupabaseConfig } from "./supabaseConfig";

const DEFAULT_BUCKET = "cairn-private";
const DEFAULT_SIGNED_URL_SECONDS = 60 * 60;

type StorageEnvironment = Record<string, string | undefined>;

function getStorageConfig(env: StorageEnvironment = process.env) {
  const config = checkSupabaseConfig(env);
  if (!config.ready) {
    throw new Error(`Supabase storage is not configured: ${config.reasons.join(" ")}`);
  }

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error("Supabase storage requires SUPABASE_SERVICE_ROLE_KEY on the server.");
  }

  return {
    url: config.config.url,
    serviceRoleKey,
    bucket: env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET,
  };
}

function getStorageClient(env: StorageEnvironment = process.env): {
  client: SupabaseClient;
  bucket: string;
} {
  const config = getStorageConfig(env);
  return {
    client: createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    bucket: config.bucket,
  };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function toBody(data: Buffer | Uint8Array | string): Blob {
  if (typeof data === "string") return new Blob([data]);
  return new Blob([new Uint8Array(data)]);
}

export async function supabaseStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { client, bucket } = getStorageClient();
  const key = appendHashSuffix(normalizeKey(relKey));

  const { error } = await client.storage.from(bucket).upload(key, toBody(data), {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Supabase storage upload failed: ${error.message}`);

  const { data: signed, error: signedError } = await client.storage
    .from(bucket)
    .createSignedUrl(key, DEFAULT_SIGNED_URL_SECONDS);
  if (signedError || !signed?.signedUrl) {
    throw new Error(`Supabase storage signed URL failed: ${signedError?.message ?? "empty URL"}`);
  }

  return { key, url: signed.signedUrl };
}

export async function supabaseStorageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { client, bucket } = getStorageClient();
  const key = normalizeKey(relKey);
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(key, DEFAULT_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error(`Supabase storage signed URL failed: ${error?.message ?? "empty URL"}`);
  }
  return { key, url: data.signedUrl };
}

export async function supabaseStorageGetSignedUrl(relKey: string): Promise<string> {
  const result = await supabaseStorageGet(relKey);
  return result.url;
}
