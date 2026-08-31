import { describe, expect, it, vi } from "vitest";

const { invokeAI } = vi.hoisted(() => ({
  invokeAI: vi.fn(),
}));

vi.mock("../_core/aiProvider", () => ({ invokeAI }));

import { runCairnAgent } from "./cairnAgent";

describe("Cairn agent", () => {
  it("does not call the model when evidence is absent", async () => {
    const result = await runCairnAgent({
      question: "What is this?",
      evidence: [],
    });

    expect(invokeAI).not.toHaveBeenCalled();
    expect(result.answer).toContain("I don't have enough evidence");
  });

  it("passes evidence and conversation history to the provider", async () => {
    invokeAI.mockResolvedValueOnce("The answer is supported by the supplied evidence.");

    const result = await runCairnAgent({
      question: "What does this mean?",
      evidence: [
        {
          passageId: "p1",
          title: "Test source",
          text: "A source-backed fact.",
          citation: "Test source, p. 1",
        },
      ],
      history: [
        { role: "user", content: "Start with the basics." },
        { role: "assistant", content: "Sure." },
      ],
    });

    expect(result.answer).toBe("The answer is supported by the supplied evidence.");
    expect(invokeAI).toHaveBeenCalledTimes(1);

    const messages = invokeAI.mock.calls[0][0];
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "Start with the basics." }),
        expect.objectContaining({ role: "assistant", content: "Sure." }),
      ]),
    );
    expect(messages.at(-1).content).toBe("What does this mean?");
    expect(messages[1].content).toContain("A source-backed fact.");
  });

  it("returns a safe fallback when the provider fails", async () => {
    invokeAI.mockRejectedValueOnce(new Error("provider unavailable"));

    const result = await runCairnAgent({
      question: "Explain this.",
      evidence: [
        {
          passageId: "p2",
          title: "Source",
          text: "A verified passage.",
          citation: "Source, p. 2",
        },
      ],
    });

    expect(result.answer).toContain("AI synthesis is currently unavailable");
    expect(result.answer).toContain("Source, p. 2");
  });
});
