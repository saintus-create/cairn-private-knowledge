import { describe, expect, it } from "vitest";
import { rankEvidence } from "./ragRetriever";

describe("hybrid evidence retriever", () => {
  it("prioritizes an exact numeric section over generic repeated terms", () => {
    const ranked = rankEvidence(
      [
        {
          id: 1,
          title: "General overview",
          heading: "Overview",
          source: "https://example.test/overview",
          text: "This page discusses procedure and registration in general terms.",
        },
        {
          id: 2,
          title: "California Family Code § 5602",
          heading: "California Family Code § 5602",
          source: "https://example.test/family-code",
          text: "Section 5602 provides the procedure for registering an order.",
        },
      ],
      "What does Family Code section 5602 provide?",
      4
    );
    expect(ranked[0]?.id).toBe(2);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it("keeps the selected context diverse across sources", () => {
    const ranked = rankEvidence(
      [
        {
          id: 1,
          title: "One",
          heading: "A",
          source: "https://one.test",
          text: "The rule applies to a filing and notice.",
        },
        {
          id: 2,
          title: "One",
          heading: "B",
          source: "https://one.test",
          text: "The rule applies to a filing and notice with details.",
        },
        {
          id: 3,
          title: "Two",
          heading: "C",
          source: "https://two.test",
          text: "The rule applies to a filing and notice.",
        },
      ],
      "What rule applies to filing notice?",
      2
    );
    expect(ranked).toHaveLength(2);
    expect(new Set(ranked.map(item => item.source))).toEqual(
      new Set(["https://one.test", "https://two.test"])
    );
  });

  it("returns no candidates for a query with no usable terms", () => {
    expect(
      rankEvidence(
        [
          {
            id: 1,
            title: "A",
            heading: "B",
            source: "https://example.test",
            text: "Some text.",
          },
        ],
        "the and what"
      )
    ).toEqual([]);
  });
});
