import { describe, expect, it } from "vitest";
import { approvedCollectionUrls, canonicalizeUrl, chunkSnapshot, matchesScope } from "./websiteSafety";

describe("website scope rules", () => {
  it("normalizes tracking URLs and removes fragments", () => {
    expect(canonicalizeUrl("https://example.com/guide/?utm_source=test#section")).toBe("https://example.com/guide");
  });

  it("keeps included paths and excludes protected paths", () => {
    expect(matchesScope("https://example.com/docs/start", "/docs", "/docs/private")).toBe(true);
    expect(matchesScope("https://example.com/docs/private/internal", "/docs", "/docs/private")).toBe(false);
  });

  it("retains only canonical, same-host URLs inside the approved collection boundary", () => {
    expect(approvedCollectionUrls({
      rootUrl: "https://example.com/docs",
      includePaths: "/docs",
      excludePaths: "/docs/private",
      pageLimit: 5,
      urls: ["https://example.com/docs/start?utm_source=test", "https://example.com/docs/start"],
    })).toEqual(["https://example.com/docs/start"]);
    expect(() => approvedCollectionUrls({
      rootUrl: "https://example.com/docs",
      includePaths: "/docs",
      excludePaths: "/docs/private",
      pageLimit: 5,
      urls: ["https://other.example/docs/start"],
    })).toThrow("approved source host");
    expect(() => approvedCollectionUrls({
      rootUrl: "https://example.com/docs",
      includePaths: "/docs",
      excludePaths: "/docs/private",
      pageLimit: 5,
      urls: ["https://example.com/docs/private/internal"],
    })).toThrow("approved source boundary");
  });
});

describe("citation passage creation", () => {
  it("retains heading-aware, ordered passages", () => {
    const passages = chunkSnapshot({
      canonicalUrl: "https://example.com/docs",
      title: "Example guide",
      headings: [{ level: 1, text: "Overview", anchor: "overview" }],
      text: "Overview\n\nThis is a sufficiently detailed source passage about evidence-bound retrieval and source citations for a collection.",
      contentHash: "hash",
      fetchedAt: new Date(),
    });
    expect(passages).toHaveLength(1);
    expect(passages[0]).toMatchObject({ anchor: "overview", position: 0, headingPath: "Overview" });
  });
});
