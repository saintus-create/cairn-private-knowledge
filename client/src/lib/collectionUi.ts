export function sourceStatusLabel(status: string, snapshotCount: number) {
  const state = status === "unchanged" ? "Unchanged on refresh" : status;
  return `${state} · ${snapshotCount} saved version${snapshotCount === 1 ? "" : "s"}`;
}

export function answerModeDisclosure(aiSynthesisEnabled: boolean) {
  return aiSynthesisEnabled
    ? "Optional synthesis is on and may use a low-cost model call after retrieval."
    : "Extractive retrieval is active and does not spend model credits.";
}
