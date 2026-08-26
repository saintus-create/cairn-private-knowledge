import { describe, expect, it } from "vitest";
import { assessSourceQuality } from "./sourceQuality";

describe("assessSourceQuality", () => {
  it("rejects the repeated promotional pattern seen in an unsuitable imported page", () => {
    const boilerplate = "Introducing Pro Stems 50 percent Off Fadr Plus ".repeat(8);
    expect(assessSourceQuality(boilerplate)).toMatchObject({ usable: false });
  });

  it("keeps ordinary source prose eligible for evidence", () => {
    const prose = "A source collection preserves the original page, its normalized text, and a dated snapshot. Each passage remains linked to a clear heading and source URL so readers can inspect the evidence rather than relying on an unstated model assumption.";
    expect(assessSourceQuality(prose)).toEqual({ usable: true });
  });
});
