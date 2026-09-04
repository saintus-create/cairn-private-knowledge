import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ResearchStarterCard } from "./ResearchStarterCard";

describe("ResearchStarterCard", () => {
  it("prioritizes a private document for a document-shaped topic", () => {
    const markup = renderToStaticMarkup(
      <ResearchStarterCard
        topic="Can you summarize this PDF report?"
        onStartProject={vi.fn()}
        onWebsite={vi.fn()}
        onDocument={vi.fn()}
      />
    );
    expect(markup).toContain("Attach your document");
    expect(markup).toContain("Add a website");
    expect(markup).toContain("Find a public source");
  });

  it("prioritizes a website for a broad public topic", () => {
    const markup = renderToStaticMarkup(
      <ResearchStarterCard
        topic="What does the California statute require?"
        onStartProject={vi.fn()}
        onWebsite={vi.fn()}
        onDocument={vi.fn()}
      />
    );
    expect(markup).toContain("Start with a website");
    expect(markup).toContain("Attach a document");
    expect(markup).toContain("google.com/search?q=");
    expect(markup).toContain("official%20source");
  });

  it("wires topic-derived primary and alternate actions to the correct callbacks", () => {
    const onStartProject = vi.fn();
    const onWebsite = vi.fn();
    const onDocument = vi.fn();
    const card = ResearchStarterCard({
      topic: "Can you summarize this PDF report?",
      onStartProject,
      onWebsite,
      onDocument,
    }) as React.ReactElement<{ children: React.ReactNode }>;
    const sectionChildren = React.Children.toArray(card.props.children);
    const actionGroup = sectionChildren[4] as React.ReactElement<{
      children: React.ReactNode;
    }>;
    const actions = React.Children.toArray(actionGroup.props.children) as Array<
      React.ReactElement<{ onClick?: () => void }>
    >;

    actions[0].props.onClick?.();
    actions[2].props.onClick?.();
    actions[3].props.onClick?.();

    expect(onDocument).toHaveBeenCalledOnce();
    expect(onWebsite).toHaveBeenCalledOnce();
    expect(onStartProject).toHaveBeenCalledOnce();
  });
});
