import { describe, expect, it } from "vitest";
import { collectionNameFromUrl, commandIntent, firstPublicUrl } from "./codexCommand";

describe("Codex command interpretation", () => {
  it("finds a public website request inside natural language", () => {
    expect(firstPublicUrl("Make an expert from https://www.example.org/guide.")).toBe("https://www.example.org/guide");
  });

  it("derives a readable collection name without asking the user to configure one", () => {
    expect(collectionNameFromUrl("https://www.city-planning.gov/reference")).toBe("City-planning");
  });

  it("routes collection-management requests without requiring navigation", () => {
    expect(commandIntent("Show my sources")).toBe("collection");
    expect(commandIntent("Refresh the collection")).toBe("collection");
    expect(commandIntent("What evidence supports this? ")).toBe("question");
  });
});
