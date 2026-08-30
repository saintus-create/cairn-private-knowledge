import { answerFromProject } from "./knowledgeDb";
import { invokeAI, type AIMessage } from "./_core/aiProvider";
import { readableModelAnswer } from "./evidence";

export type CairnConversationMessage = { role: "user" | "assistant"; content: string };
export type CairnAgentResult = Awaited<ReturnType<typeof answerFromProject>> & { agent: "cairn"; modelUsed: boolean; reasoningUsed: boolean };

type EvidenceResult = Extract<Awaited<ReturnType<typeof answerFromProject>>, { status: "evidence" }>;

const REASONING_TERMS = /\b(why|how|explain|compare|contrast|analy[sz]e|interpret|teach|learn|argue|evaluate|implication|difference|conflict|contradict|missing|should|could|would|what do you think|make sense)\b/i;

function needsReasoning(question: string, history: CairnConversationMessage[]) {
  // When an AI key is configured, Cairn is a conversational agent for every
  // evidence-backed question, not only questions containing reasoning keywords.
  const aiConfigured = Boolean(process.env.CAIRN_AI_API_KEY?.trim());
  return aiConfigured || history.length > 0 || REASONING_TERMS.test(question) || question.trim().split(/\s+/).length > 18;
}

function normalizeHistory(history: CairnConversationMessage[]): AIMessage[] {
  return history.filter((message) => message.content.trim()).slice(-10).map((message) => ({ role: message.role, content: message.content.trim() }));
}

function sourcePacket(evidence: EvidenceResult) {
  return evidence.citations.map((citation, index) => `[${index + 1}] ${citation.title}\n${citation.headingPath}\n${citation.excerpt}`).join("\n\n");
}

function withMetadata(result: Awaited<ReturnType<typeof answerFromProject>>, modelUsed: boolean, reasoningUsed: boolean): CairnAgentResult {
  return { ...result, agent: "cairn", modelUsed, reasoningUsed } as CairnAgentResult;
}

export async function converseWithProject(input: { userId: number; projectId: number; question: string; history?: CairnConversationMessage[] }): Promise<CairnAgentResult> {
  const history = input.history ?? [];
  const evidence = await answerFromProject(input.userId, input.projectId, input.question, false);
  if (evidence.status !== "evidence") return withMetadata(evidence, false, false);

  const reasoningUsed = needsReasoning(input.question, history);
  if (!reasoningUsed) return withMetadata(evidence, false, false);

  const messages: AIMessage[] = [
    { role: "system", content: `You are Cairn, an independent knowledge companion. You are not Manus, Forge, OpenAI, or any other provider. Help the person understand the evidence in the current Cairn project. Be conversational, patient, curious, and intellectually honest. Teach, explain, compare, challenge premises, and identify missing prerequisites when useful. Never present an inference as a source fact. Never invent facts or citations. If sources disagree, preserve the disagreement. If evidence is insufficient, say so plainly. Keep source-backed claims tied to the supplied excerpts; the application displays inspectable citations separately.` },
    ...normalizeHistory(history),
    { role: "user", content: `Current question: ${input.question}\n\nEvidence from this Cairn project:\n${sourcePacket(evidence)}` },
  ];

  try {
    const response = await invokeAI(messages, { temperature: 0.2 });
    const answer = readableModelAnswer(response);
    if (!answer) return withMetadata(evidence, false, false);
    return withMetadata({ ...evidence, answer, synthesized: true }, true, true);
  } catch {
    return withMetadata(evidence, false, false);
  }
}
