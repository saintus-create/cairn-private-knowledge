export type EvidenceRow = {
  passageId: number;
  passageText: string;
  headingPath: string;
  anchor: string;
  pageTitle: string;
  url: string;
  officialCitationMetadata?: unknown;
};

export function queryTerms(question: string) {
  const stopWords = new Set(["about", "after", "also", "archive", "before", "does", "from", "have", "into", "more", "most", "only", "over", "said", "says", "that", "the", "then", "this", "what", "when", "where", "which", "with", "would"]);
  return question
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, " ")
    .split(/\s+/)
    .map((term) => term.replace(/^\.+|\.+$/g, ""))
    .filter((term) => term.length > 2 && !stopWords.has(term))
    .slice(0, 7);
}

export function readableModelAnswer(value: unknown) {
  const content = typeof value === "string" ? value.trim() : null;
  if (!content || content.startsWith("{") || content.startsWith("[") || content.startsWith("```json")) return null;
  return content.replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]/g, "").trim() || null;
}

function excerptForQuestion(text: string, terms: string[]) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 30);
  return sentences
    .sort((a, b) => terms.filter((term) => b.toLowerCase().includes(term)).length - terms.filter((term) => a.toLowerCase().includes(term)).length)[0]
    ?.trim() || text.slice(0, 500);
}

export function citationUrl(url: string, anchor: string, passageText: string) {
  if (/downloads\.leginfo\.legislature\.ca\.gov\/[^#]+\.zip#FAM/i.test(url)) return url;
  if (anchor.startsWith("pdfpage:")) return `${url.split("#")[0]}#page=${Number(anchor.slice(8))}`;
  if (anchor.startsWith("id:")) return `${url}#${encodeURIComponent(anchor.slice(3))}`;
  if (anchor.startsWith("official:")) return `${url.split("#")[0]}#${encodeURIComponent(anchor.slice(9))}`;
  const exactText = anchor.startsWith("text:") ? anchor.slice(5) : passageText.slice(0, 120);
  return `${url}#:~:text=${encodeURIComponent(exactText)}`;
}

function provenanceForCitation(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = metadata as Record<string, unknown>;
  if (value.authority !== "California Family Code" || typeof value.sectionNumber !== "string") return null;
  const statute = value.statute && typeof value.statute === "object" ? value.statute as Record<string, unknown> : null;
  const statuteLine = statute && typeof statute.year === "string" && typeof statute.chapter === "string" && typeof statute.section === "string" ? `Stats. ${statute.year}, ch. ${statute.chapter}, § ${statute.section}` : null;
  const effectiveDate = typeof value.effectiveDate === "string" && value.effectiveDate ? `effective ${value.effectiveDate}` : null;
  const archiveSha256 = typeof value.archiveSha256 === "string" ? `archive ${value.archiveSha256.slice(0, 12)}…` : null;
  return ["Cal. Fam. Code", `§ ${value.sectionNumber}`, statuteLine, effectiveDate, archiveSha256].filter(Boolean).join(" · ");
}

export function buildEvidenceResponse(input: {
  collection: string;
  answerMode: "extractive" | "source-backed" | "labeled-synthesis";
  question: string;
  rows: EvidenceRow[];
}) {
  const terms = queryTerms(input.question);
  const candidates = input.rows
    .map((row) => ({
      ...row,
      score: terms.reduce((score, term) => {
        const hits = Number(row.passageText.toLowerCase().includes(term)) + Number(row.pageTitle.toLowerCase().includes(term)) + Number(row.headingPath.toLowerCase().includes(term));
        return score + hits * (/^\d+(?:\.\d+)?$/.test(term) ? 8 : 1);
      }, 0),
    }))
    .filter((row) => row.score > 0 && assessSourceQuality(row.passageText).usable);
  const bestBySource = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const previous = bestBySource.get(candidate.url);
    if (!previous || candidate.score > previous.score) bestBySource.set(candidate.url, candidate);
  }
  const ranked = Array.from(bestBySource.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!ranked.length) {
    return {
      status: "insufficient-evidence" as const,
      collection: input.collection,
      answerMode: input.answerMode,
      answer: "Insufficient reliable evidence in this collection to answer that question. Cairn excluded unsuitable or repetitive source text; try a narrower question or import a source that directly covers it.",
      citations: [],
      relatedEntries: [],
      synthesized: false,
    };
  }
  const citations = ranked.map((row) => ({
    id: row.passageId,
    title: row.pageTitle,
    url: citationUrl(row.url, row.anchor, row.passageText),
    headingPath: [row.headingPath, provenanceForCitation(row.officialCitationMetadata)].filter(Boolean).join(" · "),
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
import { assessSourceQuality } from "./sourceQuality";
