export type SupabaseConfig = {
  url: string;
  publishableKey: string;
  serviceRoleKey?: string;
};

export type SupabaseConfigCheck =
  | { ready: true; config: SupabaseConfig }
  | { ready: false; reasons: readonly string[] };

type Environment = Record<string, string | undefined>;

function trimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isSupabaseProjectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function looksLikeSupabaseKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("eyJ");
}

/**
 * Reads only the deployment environment and deliberately fails closed. This
 * lets the current Cairn runtime continue untouched until one coherent
 * Supabase project URL and publishable key are provided.
 */
export function checkSupabaseConfig(env: Environment = process.env): SupabaseConfigCheck {
  const url = trimmed(env.VITE_SUPABASE_URL);
  const publishableKey = trimmed(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const serviceRoleKey = trimmed(env.SUPABASE_SERVICE_ROLE_KEY);
  const reasons: string[] = [];

  if (!isSupabaseProjectUrl(url)) {
    reasons.push("A valid Supabase Project URL is required.");
  }
  if (!looksLikeSupabaseKey(publishableKey)) {
    reasons.push("A Supabase publishable key is required.");
  }

  if (reasons.length > 0) {
    return { ready: false, reasons };
  }

  return {
    ready: true,
    config: {
      url,
      publishableKey,
      ...(serviceRoleKey ? { serviceRoleKey } : {}),
    },
  };
}
