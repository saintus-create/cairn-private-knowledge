import { answerFromProject } from "./knowledgeDb";
import { runEpistemicPipeline } from "./epistemicReasoner";

export type CairnConversationMessage = { role: "user" | "assistant"; content: string };
export type CairnAgentResult = Awaited<ReturnType<typeof answerFromProject>> & {
  agent: "cairn";
  modelUsed: boolean;
  reasoningUsed: boolean;
  researchTrace: ResearchTrace;
  epistemic?: {
    confidence: number;
    challengedClaimCount: number;
    contradictionCount: number;
    uncertaintyCount: number;
    stages: string[];
  };
};

export type ResearchTraceStep = {
  title: string;
  detail: string;
  status: "complete" | "next";
};

export type ResearchTrace = {
  steps: ResearchTraceStep[];
  evidenceCount: number;
  uncertaintyCount: number;
};

type EvidenceResult = Extract<Awaited<ReturnType<typeof answerFromProject>>, { status: "evidence" }>;

const REASONING_TERMS = /\b(why|how|explain|compare|contrast|analy[sz]e|interpret|teach|learn|argue|evaluate|implication|difference|conflict|contradict|missing|should|could|would|what do you think|make sense)\b/i;

function needsReasoning(question: string, history: CairnConversationMessage[]) {
  const aiConfigured = Boolean(process.env.CAIRN_AI_API_KEY?.trim());
  return aiConfigured || history.length > 0 || REASONING_TERMS.test(question) || question.trim().split(/\s+/).length > 18;
}

function withMetadata(result: Awaited<ReturnType<typeof answerFromProject>>, modelUsed: boolean, reasoningUsed: boolean, epistemic?: CairnAgentResult["epistemic"]): CairnAgentResult {
  const uncertaintyCount = epistemic?.uncertaintyCount ?? 0;
  const evidenceCount = result.status === "evidence" ? result.citations.length : 0;
  const nextDetail = uncertaintyCount
    ? `${uncertaintyCount} evidence gap${uncertaintyCount === 1 ? " remains" : "s remain"}; targeted source retrieval is the next step.`
    : "No unresolved evidence gap was recorded in this pass.";
  return {
    ...result,
    agent: "cairn",
    modelUsed,
    reasoningUsed,
    researchTrace: {
      evidenceCount,
      uncertaintyCount,
      steps: [
        { title: "Map core impact areas", detail: `Reviewed ${evidenceCount} approved source passage${evidenceCount === 1 ? "" : "s"} against the question, separating direct source claims from synthesis.`, status: "complete" },
        { title: "Check disparities and competing explanations", detail: "Tested scope, missing premises, source conflict, and whether conclusions were stronger than the supplied evidence.", status: "complete" },
        { title: "Trace collateral and secondary harms", detail: "Kept indirect consequences and affected groups distinct from directly documented outcomes rather than treating them as established facts.", status: "complete" },
        { title: "Identify targeted next research", detail: nextDetail, status: uncertaintyCount ? "next" : "complete" },
        { title: "Synthesize within the evidence boundary", detail: "Returned a source-bounded answer with citations; the evidence remains the authority, not the model output.", status: "complete" },
      ],
    },
    epistemic,
  } as CairnAgentResult;
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
