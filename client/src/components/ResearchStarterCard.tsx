import {
  publicSourceSearchUrl,
  starterSourceRecommendation,
} from "@/lib/projectStart";
import { FileUp, Globe2, Plus } from "lucide-react";
import React from "react";

export function ResearchStarterCard({
  topic,
  projectName,
  onStartProject,
  onWebsite,
  onDocument,
}: {
  topic: string;
  projectName?: string;
  onStartProject: () => void;
  onWebsite: () => void;
  onDocument: () => void;
}) {
  const recommendation = starterSourceRecommendation(topic);
  const primaryAction =
    recommendation.kind === "website" ? onWebsite : onDocument;
  const primaryIcon =
    recommendation.kind === "website" ? (
      <Globe2 className="h-3.5 w-3.5" />
    ) : (
      <FileUp className="h-3.5 w-3.5" />
    );
  const alternateAction =
    recommendation.kind === "website" ? onDocument : onWebsite;
  const alternateLabel =
    recommendation.kind === "website" ? "Attach a document" : "Add a website";
  const searchUrl = publicSourceSearchUrl(topic);

  return (
    <section className="max-w-2xl border-y border-white/10 py-6">
      <p className="text-xs text-muted-foreground">Research starting point</p>
      <h2 className="mt-2 max-w-xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
        {topic}
      </h2>
      <p className="mt-5 max-w-xl text-[17px] leading-8 text-foreground">
        Cairn has not answered this yet because{" "}
        {projectName
          ? `${projectName} has no saved evidence`
          : "this is not yet a focused evidence project"}
        . {recommendation.reason}
      </p>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        A public-source search is only a starting route. Cairn will not treat
        anything from it as evidence until you approve and import a permitted
        source.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={primaryAction}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-signal)] px-4 py-2 text-sm text-[var(--accent-signal-foreground)]"
        >
          {primaryIcon} {recommendation.label}
        </button>
        <a
          href={searchUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Find a public source
        </a>
        <button
          type="button"
          onClick={alternateAction}
          className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          {alternateLabel}
        </button>
        <button
          type="button"
          onClick={onStartProject}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />{" "}
          {projectName ? "Start a separate project" : "Name this project"}
        </button>
      </div>
    </section>
  );
}
