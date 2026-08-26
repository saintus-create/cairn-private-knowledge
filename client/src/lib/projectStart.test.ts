import { describe, expect, it } from "vitest";
import { emptyProjectNextStep, firstUseActions, publicSourceSearchUrl, starterSourceRecommendation, suggestedProjectName } from "./projectStart";

describe("first-use project guidance", () => {
  it("starts a focused project before asking broad questions in the default empty space", () => {
    expect(emptyProjectNextStep("Unfiled research")).toBe("create-project");
  });

  it("keeps a named empty project focused on adding supporting evidence", () => {
    expect(emptyProjectNextStep("California law")).toBe("add-source");
  });

  it("keeps the landing orientation to three concise actions", () => {
    expect(firstUseActions).toEqual(["Ask your evidence", "Start a project", "Add a source"]);
  });

  it("turns a loose question into an editable project-name suggestion without using a model", () => {
    expect(suggestedProjectName("What are California statute requirements?")).toBe("Are California statute requirements");
  });

  it("offers a private document path when the question names private material", () => {
    expect(starterSourceRecommendation("Can you summarize this PDF report?").kind).toBe("document");
  });

  it("offers an inspectable website path for a broad public topic", () => {
    expect(starterSourceRecommendation("What does the California statute require?").kind).toBe("website");
  });

  it("creates a topic-derived public-source search route without treating results as Cairn evidence", () => {
    expect(publicSourceSearchUrl("California statute")).toBe("https://www.google.com/search?q=California%20statute%20official%20source");
  });
});
