import { describe, expect, it } from "vitest";
import { buildEvidenceResponse } from "./evidence";
import { applyOptionalSynthesis } from "./optionalSynthesis";

const evidence = buildEvidenceResponse({
  collection: "Reference",
  answerMode: "source-backed",
  question: "How are citations retained?",
  rows: [{ passageId: 1, pageTitle: "Guide", headingPath: "Citations", anchor: "id:citations", url: "https://example.com/guide", passageText: "Citations are retained beside every source-grounded claim for inspection." }],
});

describe("optional synthesis resilience", () => {
  it("uses a valid optional synthesis without changing its evidence boundary", async () => {
    const result = await applyOptionalSynthesis(evidence, true, async () => "A concise cited synthesis.");
    expect(result).toMatchObject({ answer: "A concise cited synthesis.", synthesized: true, citations: evidence.citations });
  });

  it("falls back to extractive evidence when the optional model request fails", async () => {
    const result = await applyOptionalSynthesis(evidence, true, async () => { throw new Error("provider unavailable"); });
    expect(result).toEqual(evidence);
  });
});
