export function firstPublicUrl(command: string) {
  const match = command.match(/https?:\/\/[^\s<>"']+/i);
  return match?.[0]?.replace(/[),.;!?]+$/, "") ?? null;
}

export type CodexCommandIntent = "question" | "source" | "collection";

export function commandIntent(command: string): CodexCommandIntent {
  if (firstPublicUrl(command)) return "source";
  const normalized = command.toLowerCase();
  const collectionWords = "source|sources|collection|collections|library";
  const actionWords = "show|open|manage|review|refresh|list|switch";
  const pattern = new RegExp(`\\b(${actionWords})\\b.*\\b(${collectionWords})\\b|\\b(${collectionWords})\\b.*\\b(${actionWords})\\b`);
  return pattern.test(normalized) ? "collection" : "question";
}

export function collectionNameFromUrl(rawUrl: string) {
  const host = new URL(rawUrl).hostname.replace(/^www\./, "");
  return host.split(".").slice(0, -1).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || host;
}
