import { describe, expect, it } from "vitest";
import { buildEvidenceResponse, citationUrl } from "./evidence";

describe("evidence-first answers", () => {
  const row = {
    passageId: 8,
    pageTitle: "Source handbook",
    headingPath: "Overview / Safety",
    anchor: "id:safety",
    url: "https://example.org/guide",
    passageText: "The handbook requires every decision to retain a source citation and an inspectable evidence trail.",
  };

  it("returns an explicit boundary when the collection has no matching evidence", () => {
    const result = buildEvidenceResponse({ collection: "Handbook", answerMode: "extractive", question: "What does the archive say about zoning?", rows: [row] });
    expect(result.status).toBe("insufficient-evidence");
    expect(result.citations).toHaveLength(0);
  });

  it("keeps cited answers tied to the matching collection passages", () => {
    const result = buildEvidenceResponse({ collection: "Handbook", answerMode: "extractive", question: "How is an evidence trail retained?", rows: [row] });
    expect(result.status).toBe("evidence");
    expect(result.citations[0]?.url).toBe("https://example.org/guide#safety");
    expect(result.answer).toContain("source citation");
    expect(result.relatedEntries).toEqual([]);
  });

  it("uses a text fragment when the source has no native heading id", () => {
    expect(citationUrl("https://example.org/guide", "text:Evidence trail", "ignored")).toBe("https://example.org/guide#:~:text=Evidence%20trail");
  });
});
