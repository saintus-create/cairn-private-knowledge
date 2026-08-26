export function documentPreviewLabel(input: { fileName: string; mimeType: string; bytes: number }) {
  const extension = input.fileName.split(".").pop()?.toLowerCase();
  const kind = input.mimeType === "application/pdf" || extension === "pdf" ? "PDF document" : extension === "md" || extension === "markdown" ? "Markdown document" : extension === "txt" || input.mimeType === "text/plain" ? "Text document" : "Document";
  const size = input.bytes / 1024 / 1024;
  return `${kind} · ${size.toFixed(input.bytes < 1024 * 1024 ? 2 : 1)} MB`;
}
