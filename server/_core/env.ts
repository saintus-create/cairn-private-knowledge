const legacyForgeUrl = process.env.FORGE_API_URL?.trim() ?? "";
const legacyForgeKey = process.env.FORGE_API_KEY?.trim() ?? "";

/**
 * Central application configuration.
 *
 * Forge values remain only as a temporary compatibility bridge for legacy
 * utilities that have not yet been migrated. New Cairn code must not use them.
 */
export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  singleOwnerMode: process.env.CAIRN_SINGLE_OWNER_MODE !== "false",
  singleOwnerOpenId: process.env.CAIRN_OWNER_OPEN_ID ?? process.env.OWNER_OPEN_ID ?? "cairn-owner",
  isProduction: process.env.NODE_ENV === "production",
  aiProvider: process.env.CAIRN_AI_PROVIDER ?? "openrouter",
  aiBaseUrl: process.env.CAIRN_AI_BASE_URL ?? "https://openrouter.ai/api/v1",
  aiApiKey: process.env.CAIRN_AI_API_KEY ?? "",
  aiModel: process.env.CAIRN_AI_MODEL ?? "openai/gpt-5-nano",
  aiAppUrl: process.env.CAIRN_AI_APP_URL ?? "",
  // Temporary migration bridge; remove once legacy utilities are migrated.
  forgeApiUrl: legacyForgeUrl,
  forgeApiKey: legacyForgeKey,
};

export function productionConfigIssues(input: NodeJS.ProcessEnv = process.env): string[] {
  const issues: string[] = [];
  if (!input.DATABASE_URL?.trim()) issues.push("DATABASE_URL is required.");
  const jwtSecret = input.JWT_SECRET?.trim() ?? "";
  if (!jwtSecret) issues.push("JWT_SECRET is required.");
  else if (jwtSecret.length < 32) issues.push("JWT_SECRET must be at least 32 characters.");
  else if (/replace_with|change-this|your[_-]?secret/i.test(jwtSecret)) issues.push("JWT_SECRET must be replaced with a generated secret.");
  if (input.CAIRN_SINGLE_OWNER_MODE === "false") {
    if (!input.OAUTH_SERVER_URL?.trim()) issues.push("OAUTH_SERVER_URL is required when single-owner mode is disabled.");
    if (!input.VITE_APP_ID?.trim()) issues.push("VITE_APP_ID is required when single-owner mode is disabled.");
  }
  return issues;
}
