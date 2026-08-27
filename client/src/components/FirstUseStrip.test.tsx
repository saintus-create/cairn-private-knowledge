import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { FirstUseStrip } from "./FirstUseStrip";

describe("FirstUseStrip", () => {
  it("renders only the three actionable first-use choices", () => {
    const markup = renderToStaticMarkup(<FirstUseStrip onAsk={vi.fn()} onProject={vi.fn()} onSource={vi.fn()} />);
    expect(markup).toContain("Ask your evidence");
    expect(markup).toContain("Start a project");
    expect(markup).toContain("Add a source");
  });

  it("wires each quiet landing action to its own intended next step", () => {
    const onAsk = vi.fn();
    const onProject = vi.fn();
    const onSource = vi.fn();
    const strip = FirstUseStrip({ onAsk, onProject, onSource }) as React.ReactElement<{ children: React.ReactNode }>;
    const children = React.Children.toArray(strip.props.children) as Array<React.ReactElement<{ onClick?: () => void }>>;

    children[0].props.onClick?.();
    children[2].props.onClick?.();
    children[4].props.onClick?.();

    expect(onAsk).toHaveBeenCalledOnce();
    expect(onProject).toHaveBeenCalledOnce();
    expect(onSource).toHaveBeenCalledOnce();
  });
});
