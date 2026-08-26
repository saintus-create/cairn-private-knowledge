import type { buildEvidenceResponse } from "./evidence";

type EvidenceAnswer = ReturnType<typeof buildEvidenceResponse>;

export async function applyOptionalSynthesis(evidence: EvidenceAnswer, enabled: boolean, request: () => Promise<string | undefined>) {
  if (evidence.status !== "evidence" || !enabled) return evidence;
  try {
    const content = await request();
    const synthesis = content?.trim();
    return synthesis ? { ...evidence, answer: synthesis, synthesized: true } : evidence;
  } catch {
    return evidence;
  }
}
