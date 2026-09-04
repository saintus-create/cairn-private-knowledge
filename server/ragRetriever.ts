export type RetrievalDocument = {
  id: number;
  text: string;
  title: string;
  heading: string;
  source: string;
};

export type RankedRetrievalDocument<
  T extends RetrievalDocument = RetrievalDocument,
> = T & {
  score: number;
};

const TOKEN_PATTERN = /[a-z0-9]+(?:\.\d+)?/gi;
const STOP_WORDS = new Set(["about", "after", "also", "archive", "before", "does", "from", "have", "into", "more", "most", "only", "over", "said", "says", "that", "the", "then", "this", "what", "when", "where", "which", "with", "would"]);

export function retrievalTokens(value: string): string[] {
  return (value.toLowerCase().match(TOKEN_PATTERN) ?? []).filter(
    token => token.length > 1
  );
}

function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function fieldScore(field: string, queryTerms: string[], weight: number) {
  const value = field.toLowerCase();
  return queryTerms.reduce(
    (score, term) => score + (value.includes(term) ? weight : 0),
    0
  );
}

/**
 * Rank already-approved evidence passages without sending corpus text to a third party.
 * This is intentionally deterministic: the model is only allowed to synthesize after
 * this source-bounded retrieval step has selected the context.
 */
export function rankEvidence<T extends RetrievalDocument>(
  documents: T[],
  query: string,
  limit = 4
): RankedRetrievalDocument<T>[] {
  const queryTerms = retrievalTokens(query).filter((term) => !STOP_WORDS.has(term));
  if (!queryTerms.length) return [];
  const queryCounts = termFrequency(queryTerms);
  const documentFrequency = new Map<string, number>();
  const tokenized = documents.map(document => {
    const tokens = retrievalTokens(
      `${document.title} ${document.heading} ${document.text}`
    );
    const unique = new Set(tokens);
    for (const term of Array.from(queryCounts.keys())) {
      if (unique.has(term))
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    return { document, tokens, unique };
  });
  const totalDocuments = Math.max(1, documents.length);
  const ranked = tokenized
    .map(({ document, tokens, unique }) => {
      const frequencies = termFrequency(tokens);
      const lexicalScore = Array.from(queryCounts.entries()).reduce(
        (score, [term, queryFrequency]) => {
          const tf = frequencies.get(term) ?? 0;
          if (!tf) return score;
          const idf = Math.log(
            1 +
              (totalDocuments - (documentFrequency.get(term) ?? 0) + 0.5) /
                ((documentFrequency.get(term) ?? 0) + 0.5)
          );
          return (
            score +
            idf * (1 + Math.min(tf, 3) * 0.35) * (queryFrequency > 1 ? 1.15 : 1)
          );
        },
        0
      );
      const numericBoost =
        queryTerms.filter(
          term => /^\d+(?:\.\d+)?$/.test(term) && unique.has(term)
        ).length * 8;
      const exactPhraseBoost =
        query.trim().length > 8 &&
        document.text.toLowerCase().includes(query.trim().toLowerCase())
          ? 6
          : 0;
      const score =
        lexicalScore +
        fieldScore(document.title, queryTerms, 2.5) +
        fieldScore(document.heading, queryTerms, 1.5) +
        numericBoost +
        exactPhraseBoost;
      return { ...document, score };
    })
    .filter(document => document.score > 0);

  const selected: RankedRetrievalDocument<T>[] = [];
  const sourceCounts = new Map<string, number>();
  for (const candidate of ranked.sort((a, b) => b.score - a.score)) {
    const sourceCount = sourceCounts.get(candidate.source) ?? 0;
    if (sourceCount >= 1 && selected.length < limit) continue;
    selected.push(candidate);
    sourceCounts.set(candidate.source, sourceCount + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}
