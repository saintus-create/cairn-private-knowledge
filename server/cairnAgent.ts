import { answerFromProject } from "./knowledgeDb";
import { runEpistemicPipeline } from "./epistemicReasoner";

export type CairnConversationMessage = { role: "user" | "assistant"; content: string };
export type CairnAgentResult = Awaited<ReturnType<typeof answerFromProject>> & {
  agent: "cairn";
  modelUsed: boolean;
  reasoningUsed: boolean;
  epistemic?: {
    confidence: number;
    challengedClaimCount: number;
    contradictionCount: number;
    uncertaintyCount: number;
    stages: string[];
  };
};

type EvidenceResult = Extract<Awaited<ReturnType<typeof answerFromProject>>, { status: "evidence" }>;

const REASONING_TERMS = /\b(why|how|explain|compare|contrast|analy[sz]e|interpret|teach|learn|argue|evaluate|implication|difference|conflict|contradict|missing|should|could|would|what do you think|make sense)\b/i;

function needsReasoning(question: string, history: CairnConversationMessage[]) {
  const aiConfigured = Boolean(process.env.CAIRN_AI_API_KEY?.trim());
  return aiConfigured || history.length > 0 || REASONING_TERMS.test(question) || question.trim().split(/\s+/).length > 18;
}

function withMetadata(result: Awaited<ReturnType<typeof answerFromProject>>, modelUsed: boolean, reasoningUsed: boolean, epistemic?: CairnAgentResult["epistemic"]): CairnAgentResult {
  return { ...result, agent: "cairn", modelUsed, reasoningUsed, epistemic } as CairnAgentResult;
}

export async function converseWithProject(input: {
  userId: number;
  projectId: number;
  question: string;
  history?: CairnConversationMessage[];
}): Promise<CairnAgentResult> {
  const history = input.history ?? [];
  const evidence = await answerFromProject(input.userId, input.projectId, input.question, false);
  if (evidence.status !== "evidence") return withMetadata(evidence, false, false);

  const reasoningUsed = needsReasoning(input.question, history);
  if (!reasoningUsed) return withMetadata(evidence, false, false);

  try {
    const result = await runEpistemicPipeline({
      question: input.question,
      history,
      evidence: evidence.citations.map((citation) => ({
        id: citation.id,
        title: citation.title,
        headingPath: citation.headingPath,
        excerpt: citation.excerpt,
        url: citation.url,
        score: citation.score,
      })),
    });

    if (!result) return withMetadata(evidence, false, false);

    return withMetadata(
      { ...evidence, answer: result.answer, synthesized: true },
      true,
      true,
      {
        confidence: result.synthesis.confidence,
        challengedClaimCount: result.critique.challengedClaimIds.length,
        contradictionCount: result.critique.contradictions.length,
        uncertaintyCount: result.synthesis.uncertainty.length,
        stages: result.stages,
      },
    );
  } catch {
    return withMetadata(evidence, false, false);
  }
}
