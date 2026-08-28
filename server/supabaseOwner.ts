import { checkSupabaseConfig, type SupabaseConfig } from "./supabaseConfig";

type Environment = Record<string, string | undefined>;

export type SupabaseOwnerConfig = {
  supabase: SupabaseConfig;
  ownerEmail: string;
};

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function getSupabaseOwnerConfig(env: Environment = process.env): SupabaseOwnerConfig | null {
  const checked = checkSupabaseConfig(env);
  const ownerEmail = normalizeEmail(env.CAIRN_OWNER_EMAIL);

  if (!checked.ready || !/^\S+@\S+\.\S+$/.test(ownerEmail)) {
    return null;
  }

  return { supabase: checked.config, ownerEmail };
}

export function ownsSupabaseEmail(candidateEmail: string | null | undefined, ownerEmail: string): boolean {
  return normalizeEmail(candidateEmail) === normalizeEmail(ownerEmail);
}
