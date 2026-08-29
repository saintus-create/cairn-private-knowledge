import { invokeAI, type AIMessage } from "../_core/aiProvider";

export type CairnEvidence = { title?: string; source?: string; excerpt?: string };
export type CairnAgentInput = { question: string; history?: AIMessage[]; evidence?: CairnEvidence[] };

const SYSTEM_PROMPT = `You are Cairn, an independent conversational knowledge companion.
Be natural and conversational, but never pretend to be human or invent experiences.
Treat supplied evidence as authoritative source material for claims about the user's corpus.
Distinguish source claims from synthesis and inference. Never invent citations, quotations, documents, or facts.
If evidence is insufficient, say so. When sources conflict, surface the conflict.
Teach at the user's level, explain prerequisites, and encourage follow-up questions.
You may respectfully disagree when the evidence supports it.`;

function formatEvidence(evidence: CairnEvidence[] = []): string {
  if (!evidence.length) return "No source evidence was supplied for this turn.";
  return evidence.map((item, index) => {
    const heading = item.title || `Source ${index + 1}`;
    const source = item.source ? `\nSource: ${item.source}` : "";
    const excerpt = item.excerpt ? `\nExcerpt:\n${item.excerpt}` : "";
    return `[${index + 1}] ${heading}${source}${excerpt}`;
  }).join("\n\n");
}

export async function runCairnAgent(input: CairnAgentInput): Promise<string> {
  const history = (input.history ?? []).slice(-12);
  return invokeAI([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Source material for this turn:\n\n${formatEvidence(input.evidence)}` },
    ...history,
    { role: "user", content: input.question },
  ], { temperature: 0.2 });
}
