import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseEpistemicJson, runEpistemicPipeline } from "./epistemicReasoner";

const evidence = [
  {
    id: 1,
    title: "Primary source",
    headingPath: "§ 1 · Rule",
    excerpt: "The rule applies to the described proceeding.",
    url: "https://example.test/source#1",
  },
  {
    id: 2,
    title: "Secondary source",
    headingPath: "Analysis · Scope",
    excerpt: "The source describes a narrower application than the first source.",
    url: "https://example.test/source#2",
  },
];

describe("epistemic reasoning", () => {
  it("parses fenced JSON", () => {
    const schema = z.object({ answer: z.string() });
    expect(parseEpistemicJson('```json\n{"answer":"ok"}\n```', schema)).toEqual({ answer: "ok" });
  });

  it("rejects malformed JSON", () => {
    const schema = z.object({ answer: z.string() });
    expect(parseEpistemicJson("not json", schema)).toBeNull();
  });

  it("runs analyst, critic, adjudicator, and synthesis stages", async () => {
    const responses = [
      JSON.stringify({
        claims: [{ id: "C1", text: "The rule applies.", kind: "fact", evidenceIds: [1], support: "direct", confidence: 0.9 }],
        contradictions: [],
        uncertainties: [],
      }),
      JSON.stringify({
        challengedClaimIds: [],
        unsupportedClaimIds: [],
        contradictions: [],
        uncertainties: [],
        verdict: "supported",
      }),
      JSON.stringify({
        answer: "The supplied evidence supports the rule applying to the described proceeding.",
        retainedClaimIds: ["C1"],
        confidence: 0.85,
        uncertainty: [],
      }),
      "The supplied evidence supports the rule applying to the described proceeding.",
    ];

    let calls = 0;
    const result = await runEpistemicPipeline({
      question: "Does the rule apply?",
      history: [],
      evidence,
      invoke: async () => responses[calls++],
    });

    expect(calls).toBe(4);
    expect(result?.answer).toContain("supports the rule");
    expect(result?.analysis.claims[0].evidenceIds).toEqual([1]);
    expect(result?.critique.verdict).toBe("supported");
    expect(result?.synthesis.confidence).toBe(0.85);
    expect(result?.stages).toEqual(["retrieval", "analysis", "critique", "adjudication", "synthesis"]);
  });

  it("fails closed when a structured stage is invalid", async () => {
    const result = await runEpistemicPipeline({
      question: "What is supported?",
      history: [],
      evidence,
      invoke: async () => "not json",
    });

    expect(result).toBeNull();
  });
});
