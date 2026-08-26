import { describe, expect, it } from "vitest";
import { documentPreviewLabel } from "./documentPreview";

describe("documentPreviewLabel", () => {
  it("labels supported private source formats and keeps small file sizes precise", () => {
    expect(documentPreviewLabel({ fileName: "statute.pdf", mimeType: "application/pdf", bytes: 524_288 })).toBe("PDF document · 0.50 MB");
    expect(documentPreviewLabel({ fileName: "notes.md", mimeType: "text/markdown", bytes: 1_500_000 })).toBe("Markdown document · 1.4 MB");
  });
});
