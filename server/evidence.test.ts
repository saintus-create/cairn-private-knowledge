import { describe, expect, it } from "vitest";
import { buildEvidenceResponse, citationUrl, readableModelAnswer } from "./evidence";

describe("evidence-first answers", () => {
  const row = {
    passageId: 8,
    pageTitle: "Source handbook",
    headingPath: "Overview / Safety",
    anchor: "id:safety",
    url: "https://example.org/guide",
    passageText: "The handbook requires every decision to retain a source citation and an inspectable evidence trail.",
  };

  it("accepts natural prose but rejects structured model payloads from visible answers", () => {
    expect(readableModelAnswer("The approved text supports this conclusion.\n\nIt does not establish anything beyond that.")).toContain("approved text");
    expect(readableModelAnswer("[{\\\"title\\\":\\\"raw metadata\\\"}]")).toBeNull();
    expect(readableModelAnswer("```json\\n{\\\"answer\\\":\\\"leak\\\"}\\n```")).toBeNull();
  });

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

  it("opens a cited procedural rule at its original official PDF page", () => {
    expect(citationUrl("https://courts.ca.gov/system/files?file=file/roc-title-5_3.pdf", "pdfpage:12", "ignored")).toBe("https://courts.ca.gov/system/files?file=file/roc-title-5_3.pdf#page=12");
  });

  it("prioritizes an exact decimal procedural rule number and retains its PDF page anchor", () => {
    const result = buildEvidenceResponse({
      collection: "California Rules of Court — Title Five",
      answerMode: "extractive",
      question: "What does Rule 5.2 say about the Family Rules?",
      rows: [
        { passageId: 1, pageTitle: "California Rules of Court, Title Five — Rule 5.2. Division title", headingPath: "Rule 5.2", anchor: "pdfpage:2", url: "https://courts.ca.gov/system/files?file=file/roc-title-5_3.pdf#rule=5.2", passageText: "The rules in this division may be referred to as the Family Rules." },
        { passageId: 2, pageTitle: "California Rules of Court, Title Five — Rule 5.14. Sanctions", headingPath: "Rule 5.14", anchor: "pdfpage:7", url: "https://courts.ca.gov/system/files?file=file/roc-title-5_3.pdf#rule=5.14", passageText: "Sanctions may be imposed for violations of rules of court in family law cases." },
      ],
    });
    expect(result.citations[0]).toMatchObject({ title: "California Rules of Court, Title Five — Rule 5.2. Division title", url: "https://courts.ca.gov/system/files?file=file/roc-title-5_3.pdf#page=2" });
  });

  it("prioritizes an exact statutory section title and preserves its official record anchor", () => {
    const result = buildEvidenceResponse({
      collection: "California Family Code",
      answerMode: "extractive",
      question: "What does Family Code section 5602 provide?",
      rows: [
        { passageId: 1, pageTitle: "California Family Code § 5602.", headingPath: "California Family Code § 5602.", anchor: "official:FAM5602.200080870", url: "https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip#FAM5602.200080870", passageText: "An obligee may register an order issued in this state using the same procedures specified in subdivision (a) of Section 5601." },
        { passageId: 2, pageTitle: "California Family Code § 5242.", headingPath: "California Family Code § 5242.", anchor: "official:FAM5242.199216210", url: "https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip#FAM5242.199216210", passageText: "Service of the assignment order creates a lien on the earnings of the employee." },
      ],
    });
    expect(result.status).toBe("evidence");
    expect(result.citations[0]?.title).toBe("California Family Code § 5602.");
    expect(result.citations[0]?.url).toBe("https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip#FAM5602.200080870");
  });

  it("displays stored Family Code legal provenance without changing the official archive citation URL", () => {
    const result = buildEvidenceResponse({
      collection: "California Family Code",
      answerMode: "extractive",
      question: "What does Family Code section 5602 provide?",
      rows: [{
        passageId: 1,
        pageTitle: "California Family Code § 5602.",
        headingPath: "California Family Code § 5602.",
        anchor: "official:FAM5602.200080870",
        url: "https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip#FAM5602.200080870",
        passageText: "An obligee may register an order issued in this state using the same procedures specified in subdivision (a) of Section 5601.",
        officialCitationMetadata: { authority: "California Family Code", code: "FAM", sectionNumber: "5602", statute: { year: "2000", chapter: "808", section: "7" }, effectiveDate: "2001-01-01", recordKey: "FAM5602.200080870", archiveSha256: "a3efc8049f45406a4cc96871e1a23c3af8ead6bf81847947bdbf57d136c8215e", sourceUrl: "https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip#FAM5602.200080870" },
      }],
    });
    expect(result.citations[0]?.url).toBe("https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip#FAM5602.200080870");
    expect(result.citations[0]?.headingPath).toContain("Cal. Fam. Code · § 5602 · Stats. 2000, ch. 808, § 7 · effective 2001-01-01 · archive a3efc8049f45…");
  });

  it("collapses several matched passages from one official statutory section into one archive citation", () => {
    const url = "https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip#FAM5602.200080870";
    const result = buildEvidenceResponse({
      collection: "California Family Code",
      answerMode: "extractive",
      question: "What does Family Code section 5602 provide?",
      rows: [
        { passageId: 1, pageTitle: "California Family Code § 5602.", headingPath: "California Family Code § 5602.", anchor: "official:FAM5602.200080870", url, passageText: "An obligee may register an order under Section 5602 using the stated procedures." },
        { passageId: 2, pageTitle: "California Family Code § 5602.", headingPath: "California Family Code § 5602.", anchor: "text:Additional procedure", url, passageText: "The clerk of the court shall file the documents under Section 5602." },
      ],
    });
    expect(result.status).toBe("evidence");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.url).toBe(url);
  });

  it("refuses repeated promotional boilerplate even when it contains the question terms", () => {
    const result = buildEvidenceResponse({ collection: "Example", answerMode: "extractive", question: "What is Fadr?", rows: [{ passageId: 2, pageTitle: "Promotion", headingPath: "Overview", anchor: "text:Introducing", url: "https://example.org/promotion", passageText: "Introducing Pro Stems 50 percent Off Fadr Plus ".repeat(8) }] });
    expect(result.status).toBe("insufficient-evidence");
    expect(result.answer).toContain("excluded unsuitable or repetitive");
  });
});
