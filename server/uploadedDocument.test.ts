import { describe, expect, it } from "vitest";
import { extractUploadedDocumentText } from "./knowledgeDb";

describe("private document extraction", () => {
  it("accepts plain text and normalizes its readable evidence", async () => {
    const result = await extractUploadedDocumentText("notes.txt", "text/plain", Buffer.from("Evidence survives\r\n\r\nwhen source passages preserve citations, context, and enough text to inspect every claim carefully."));
    expect(result).toMatchObject({ mimeType: "text/plain" });
    expect(result.text).toContain("Evidence survives");
    expect(result.text).not.toContain("\r");
  });

  it("rejects unsupported files and files without enough usable text", async () => {
    await expect(extractUploadedDocumentText("photo.png", "image/png", Buffer.from("not a document"))).rejects.toThrow("PDF, plain-text, or Markdown");
    await expect(extractUploadedDocumentText("short.txt", "text/plain", Buffer.from("too short"))).rejects.toThrow("enough readable text");
  });
});
