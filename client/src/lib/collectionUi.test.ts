import { describe, expect, it } from "vitest";
import { answerModeDisclosure, sourceStatusLabel } from "./collectionUi";

describe("collection UI disclosures", () => {
  it("makes snapshot history visible next to source status", () => {
    expect(sourceStatusLabel("unchanged", 2)).toBe("Unchanged on refresh · 2 saved versions");
  });

  it("keeps no-credit extractive retrieval clear until synthesis is explicitly enabled", () => {
    expect(answerModeDisclosure(false)).toContain("does not spend model credits");
    expect(answerModeDisclosure(true)).toContain("may use a low-cost model call");
  });
});
