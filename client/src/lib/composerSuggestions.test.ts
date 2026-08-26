import { describe, expect, it } from "vitest";
import { getComposerSuggestions } from "./composerSuggestions";

describe("getComposerSuggestions", () => {
  const collection = { name: "CSS reference" };
  const pages = [
    { pageTitle: "Grid layout", canonicalUrl: "https://example.com/layout/grid" },
    { pageTitle: "Typography", canonicalUrl: "https://example.com/type" },
  ];

  it("keeps the landing surface quiet until the composer is active", () => {
    expect(getComposerSuggestions({ query: "grid", expanded: false, collection, pages })).toEqual([]);
  });

  it("does not introduce suggestion cards merely because the input received focus", () => {
    expect(getComposerSuggestions({ query: "", expanded: true, collection, pages })).toEqual([]);
    expect(getComposerSuggestions({ query: "a", expanded: true, collection, pages })).toEqual([]);
  });

  it("prioritizes matching saved source pages while typing", () => {
    const suggestions = getComposerSuggestions({ query: "How does grid work?", expanded: true, collection, pages });
    expect(suggestions[0]).toMatchObject({ label: "Grid layout", detail: "/layout/grid" });
    expect(suggestions[0].command).toContain("Grid layout");
  });

  it("offers safe bounded-import actions for public URLs", () => {
    const suggestions = getComposerSuggestions({ query: "https://example.com/docs", expanded: true, collection, pages });
    expect(suggestions.map((suggestion) => suggestion.label)).toEqual(["Create an expert collection", "Preview source boundary"]);
  });
});
