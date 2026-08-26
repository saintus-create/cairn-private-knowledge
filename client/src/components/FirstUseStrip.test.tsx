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
});
