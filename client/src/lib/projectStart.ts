export type EmptyProjectNextStep = "create-project" | "add-source";

export function emptyProjectNextStep(projectName?: string): EmptyProjectNextStep {
  return projectName === "Unfiled research" ? "create-project" : "add-source";
}

export const firstUseActions = ["Ask your evidence", "Start a project", "Add a source"] as const;

export type StarterSourceKind = "website" | "document";

export function starterSourceRecommendation(topic: string): { kind: StarterSourceKind; label: string; reason: string } {
  const normalized = topic.toLowerCase();
  const documentSignals = /\b(pdf|document|file|report|notes?|transcript|paper|attachment)\b/;
  if (documentSignals.test(normalized)) {
    return { kind: "document", label: "Attach your document", reason: "This sounds like material you may already have in a private file." };
  }
  return { kind: "website", label: "Start with a website", reason: "This sounds like a topic that may benefit from an inspectable public source." };
}

export function publicSourceSearchUrl(topic: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${topic} official source`)}`;
}

export function suggestedProjectName(topic: string) {
  const cleaned = topic
    .trim()
    .replace(/^(can you |could you |please )/i, "")
    .replace(/^(what|how|why|when|where|who|which)\b[^a-z0-9]*/i, "")
    .replace(/[?!.]+$/, "")
    .trim()
    .slice(0, 72);
  if (!cleaned) return "New research project";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
