import { answerFromProject } from "./knowledgeDb";
import { invokeAI, type AIMessage } from "./_core/aiProvider";
import { readableModelAnswer } from "./evidence";

export type CairnConversationMessage = { role: "user" | "assistant"; content: string };
export type CairnAgentResult = Awaited<ReturnType<typeof answerFromProject>> & { agent: "cairn"; modelUsed: boolean; reasoningUsed: boolean };

const REASONING_TERMS = /\b(why|how|explain|compare|contrast|analy[sz]e|interpret|teach|learn|argue|evaluate|implication|difference|conflict|contradict|missing|should|could|would|what do you think|make sense)\b/i;

function needsReasoning(question: string, history: CairnConversationMessage[]) {
  return history.length > 0 || REASONING_TERMS.test(question) || question.trim().split(/\s+/).length > 18;
}

function normalizeHistory(history: CairnConversationMessage[]): AIMessage[] {
  return history.filter((message) => message.content.trim()).slice(-10).map((message) => ({ role: message.role, content: message.content.trim() }));
}

function sourcePacket(evidence: Extract<CairnAgentResult, { status: "evidence" }>) {
  return evidence.citations.map((citation, index) => `[${index + 1}] ${citation.title}\n${citation.headingPath}\n${citation.excerpt}`).join("\n\n");
}

export async function converseWithProject(input: { userId: number; projectId: number; question: string; history?: CairnConversationMessage[] }): Promise<CairnAgentResult> {
  const history = input.history ?? [];
  const evidence = await answerFromProject(input.userId, input.projectId, input.question, false);
  if (evidence.status !== "evidence") return { ...evidence, agent: "cairn", modelUsed: false, reasoningUsed: false };

  const reasoningUsed = needsReasoning(input.question, history);
  if (!reasoningUsed) return { ...evidence, agent: "cairn", modelUsed: false, reasoningUsed: false };

  const messages: AIMessage[] = [
    { role: "system", content: `You are Cairn, an independent knowledge companion. You are not Manus, Forge, OpenAI, or any other provider. Help the person understand the evidence in the current Cairn project. Be conversational, patient, curious, and intellectually honest. Teach, explain, compare, challenge premises, and identify missing prerequisites when useful. Never present an inference as a source fact. Never invent facts or citations. If sources disagree, preserve the disagreement. If evidence is insufficient, say so plainly. Keep source-backed claims tied to the supplied excerpts; the application displays inspectable citations separately.` },
    ...normalizeHistory(history),
    { role: "user", content: `Current question: ${input.question}\n\nEvidence from this Cairn project:\n${sourcePacket(evidence)}` },
  ];

  try {
    const response = await invokeAI(messages, { temperature: 0.2 });
    const answer = readableModelAnswer(response);
    if (!answer) return { ...evidence, agent: "cairn", modelUsed: false, reasoningUsed: false };
    return { ...evidence, answer, synthesized: true, agent: "cairn", modelUsed: true, reasoningUsed: true };
  } catch {
    return { ...evidence, agent: "cairn", modelUsed: false, reasoningUsed: false };
  }
}
