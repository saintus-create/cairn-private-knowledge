export type ExpertAnswerMode = "extractive" | "source-backed" | "labeled-synthesis";

export type ScopePreview = {
  seedUrl: string;
  host: string;
  discoveredUrls: Array<{ url: string; path: string; selected: boolean }>;
  estimatedPageCount: number;
  robotsNotice: string;
};

export type CleanSnapshot = {
  canonicalUrl: string;
  title: string;
  headings: Array<{ level: number; text: string; anchor: string }>;
  text: string;
  contentHash: string;
  fetchedAt: Date;
};

export type PassageDraft = {
  position: number;
  headingPath: string;
  anchor: string;
  text: string;
  contentHash: string;
};
