import { checkSupabaseConfig } from "./supabaseConfig";
import { getSupabaseOwnerConfig, ownsSupabaseEmail } from "./supabaseOwner";

type Environment = Record<string, string | undefined>;
type Fetcher = typeof fetch;

function bearerToken(authorization: string | string[] | undefined): string | null {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

/**
 * Verifies a browser Supabase access token with the project itself rather than
 * trusting a client-provided email. A positive result means only that this is
 * the configured Cairn owner; mapping it to the existing internal user stays
 * in the tRPC context.
 */
export async function getVerifiedSupabaseOwnerEmail(
  authorization: string | string[] | undefined,
  options: { env?: Environment; fetcher?: Fetcher } = {},
): Promise<string | null> {
  const env = options.env ?? process.env;
  const owner = getSupabaseOwnerConfig(env);
  const config = checkSupabaseConfig(env);
  const token = bearerToken(authorization);
  if (!owner || !config.ready || !token) return null;

  const fetcher = options.fetcher ?? fetch;
  try {
    const response = await fetcher(`${owner.supabase.url}/auth/v1/user`, {
      headers: {
        apikey: owner.supabase.publishableKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { email?: unknown };
    return typeof payload.email === "string" && ownsSupabaseEmail(payload.email, owner.ownerEmail)
      ? owner.ownerEmail
      : null;
  } catch {
    return null;
  }
}
