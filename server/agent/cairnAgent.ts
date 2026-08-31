import { invokeAI, type AIMessage } from "../_core/aiProvider";

export type CairnEvidence = {
  passageId?: string;
  title?: string;
  source?: string;
  excerpt?: string;
  text?: string;
  citation?: string;
};

export type CairnAgentInput = {
  question: string;
  history?: AIMessage[];
  evidence?: CairnEvidence[];
};

export type CairnAgentResult = {
  answer: string;
  sources: CairnEvidence[];
  modelUsed: boolean;
};

const SYSTEM_PROMPT = `You are Cairn, an independent conversational knowledge companion.
Be natural and conversational, but never pretend to be human or invent experiences.
Treat supplied evidence as authoritative source material for claims about the user's corpus.
Distinguish source claims from synthesis and inference. Never invent citations, quotations, documents, or facts.
If evidence is insufficient, say so. When sources conflict, surface the conflict.
Teach at the user's level, explain prerequisites, and encourage follow-up questions.
You may respectfully disagree when the evidence supports it.`;

function formatEvidence(evidence: CairnEvidence[] = []): string {
  return evidence.map((item, index) => {
    const heading = item.title || `Source ${index + 1}`;
    const source = item.source || item.citation ? `\nSource: ${item.source || item.citation}` : "";
    const excerpt = item.excerpt || item.text ? `\nExcerpt:\n${item.excerpt || item.text}` : "";
    return `[${index + 1}] ${heading}${source}${excerpt}`;
  }).join("\n\n");
}

function fallbackSources(evidence: CairnEvidence[]): string {
  return evidence.map((item, index) => {
    const label = item.citation || item.source || item.title || `Source ${index + 1}`;
    return `[${index + 1}] ${label}`;
  }).join("\n");
}

export async function runCairnAgent(input: CairnAgentInput): Promise<CairnAgentResult> {
  const evidence = input.evidence ?? [];
  if (!evidence.length) {
    return {
      answer: "I don't have enough evidence to answer that question from this project.",
      sources: [],
      modelUsed: false,
    };
  }

  const history = (input.history ?? []).slice(-12);
  const messages: AIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Source material for this turn:\n\n${formatEvidence(evidence)}` },
    ...history,
    { role: "user", content: input.question },
  ];

  try {
    const answer = await invokeAI(messages, { temperature: 0.2 });
    return { answer, sources: evidence, modelUsed: true };
  } catch {
    return {
      answer: `AI synthesis is currently unavailable. The available source material is:\n${fallbackSources(evidence)}`,
      sources: evidence,
      modelUsed: false,
    };
  }
}
