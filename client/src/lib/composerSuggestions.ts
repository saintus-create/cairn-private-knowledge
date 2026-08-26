import { firstPublicUrl } from "@/lib/codexCommand";

export type ComposerSuggestion = {
  label: string;
  command: string;
  detail: string;
};

type SuggestionPage = { pageTitle: string; canonicalUrl: string };
type SuggestionCollection = { name: string } | undefined;

export function getComposerSuggestions({ query, expanded, collection, pages }: { query: string; expanded: boolean; collection: SuggestionCollection; pages: SuggestionPage[] }): ComposerSuggestion[] {
  if (!expanded) return [];
  const text = query.trim();
  if (text.length < 2) return [];
  if (firstPublicUrl(text)) return [
    { label: "Create an expert collection", command: text, detail: "Codex will inspect the website and prepare a small source proposal." },
    { label: "Preview source boundary", command: text, detail: "You will approve the selected pages before import." },
  ];
  const terms = text.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
  const matchedPages = pages
    .filter((page) => terms.some((term) => `${page.pageTitle} ${page.canonicalUrl}`.toLowerCase().includes(term)))
    .slice(0, 3);
  if (matchedPages.length) return matchedPages.map((page) => ({ label: page.pageTitle, command: `${text} — focus on ${page.pageTitle}`, detail: new URL(page.canonicalUrl, "https://cairn.local").pathname || "/" }));
  return collection ? [
    { label: `Ask ${collection.name}`, command: text, detail: "Codex will answer only from this collection’s saved passages." },
    { label: "Review source coverage", command: "Show my sources", detail: "See what the current collection can support." },
  ] : [{ label: "Add this as a source", command: text, detail: "Paste a public website URL to start a collection." }];
}
