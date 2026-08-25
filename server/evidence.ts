export type EvidenceRow = {
  passageId: number;
  passageText: string;
  headingPath: string;
  anchor: string;
  pageTitle: string;
  url: string;
};

export function queryTerms(question: string) {
  const stopWords = new Set(["about", "after", "also", "archive", "before", "does", "from", "have", "into", "more", "most", "only", "over", "said", "says", "that", "the", "then", "this", "what", "when", "where", "which", "with", "would"]);
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term))
    .slice(0, 7);
}

function excerptForQuestion(text: string, terms: string[]) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 30);
  return sentences
    .sort((a, b) => terms.filter((term) => b.toLowerCase().includes(term)).length - terms.filter((term) => a.toLowerCase().includes(term)).length)[0]
    ?.trim() || text.slice(0, 500);
}

export function citationUrl(url: string, anchor: string, passageText: string) {
  if (anchor.startsWith("id:")) return `${url}#${encodeURIComponent(anchor.slice(3))}`;
  const exactText = anchor.startsWith("text:") ? anchor.slice(5) : passageText.slice(0, 120);
  return `${url}#:~:text=${encodeURIComponent(exactText)}`;
}

export function buildEvidenceResponse(input: {
  collection: string;
  answerMode: "extractive" | "source-backed" | "labeled-synthesis";
  question: string;
  rows: EvidenceRow[];
}) {
  const terms = queryTerms(input.question);
  const ranked = input.rows
    .map((row) => ({ ...row, score: terms.filter((term) => row.passageText.toLowerCase().includes(term)).length }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!ranked.length) {
    return {
      status: "insufficient-evidence" as const,
      collection: input.collection,
      answerMode: input.answerMode,
      answer: "Insufficient evidence in this collection to answer that question. Try a narrower question or import a source that covers it.",
      citations: [],
      relatedEntries: [],
      synthesized: false,
    };
  }
  const citations = ranked.map((row) => ({
    id: row.passageId,
    title: row.pageTitle,
    url: citationUrl(row.url, row.anchor, row.passageText),
    headingPath: row.headingPath,
    excerpt: excerptForQuestion(row.passageText, terms),
    score: row.score,
  }));
  return {
    status: "evidence" as const,
    collection: input.collection,
    answerMode: input.answerMode,
    answer: citations.map((citation) => citation.excerpt).join(" "),
    citations,
    relatedEntries: citations.slice(1).map((citation) => ({ title: citation.title, headingPath: citation.headingPath })),
    synthesized: false,
  };
}
