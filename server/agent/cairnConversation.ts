import { answerFromCollection } from "../knowledgeDb";
import { runCairnAgent, type CairnEvidence } from "./cairnAgent";
import type { AIMessage } from "../_core/aiProvider";

export type CairnConversationInput = {
  userId: number;
  collectionId: number;
  question: string;
  history?: AIMessage[];
  synthesize?: boolean;
};

/**
 * Cairn's conversation boundary: retrieve and preserve source evidence first,
 * then optionally ask the independent Cairn agent to reason over that evidence.
 * The model never becomes the source of truth for the collection.
 */
export async function converseWithCairn(input: CairnConversationInput) {
  const evidence = await answerFromCollection(
    input.userId,
    input.collectionId,
    input.question,
    false,
  );

  if (evidence.status !== "evidence" || input.synthesize === false) {
    return evidence;
  }

  const sourceEvidence: CairnEvidence[] = evidence.citations.map((citation) => ({
    title: citation.title,
    source: citation.url,
    excerpt: citation.excerpt,
  }));

  const answer = await runCairnAgent({
    question: input.question,
    history: input.history,
    evidence: sourceEvidence,
  });

  return {
    ...evidence,
    answer,
    synthesized: true,
  };
}
