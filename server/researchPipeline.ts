import { answerFromProject } from "./knowledgeDb";

export type ResearchRequest = {
  userId: number;
  projectId: number;
  query: string;
};

export type ResearchResponse = Awaited<ReturnType<typeof answerFromProject>>;

/**
 * Cairn's pinned accept -> knowledge-work -> return boundary.
 *
 * The pipeline deliberately owns no provider logic or UI concerns. The
 * knowledge layer retrieves approved passages for the project and performs
 * the configured source-bounded synthesis before returning citations.
 */
export async function research(input: ResearchRequest): Promise<ResearchResponse> {
  const query = input.query.trim();
  if (!query) throw new Error("Cairn needs a question to research.");
  return answerFromProject(input.userId, input.projectId, query, true);
}
