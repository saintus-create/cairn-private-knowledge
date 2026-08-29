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
