import { z } from "zod";
import { invokeAI, type AIMessage } from "./_core/aiProvider";
import type { CairnConversationMessage } from "./cairnAgent";
import { readableModelAnswer } from "./evidence";

export type EpistemicEvidence = {
  id: number;
  title: string;
  headingPath: string;
  excerpt: string;
  url: string;
  score?: number;
};

const claimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(["fact", "inference", "evaluation", "hypothesis"]),
  evidenceIds: z.array(z.number().int().positive()),
  support: z.enum(["direct", "indirect", "mixed", "none"]),
  confidence: z.number().min(0).max(1),
});

const contradictionSchema = z.object({
  claimA: z.string().min(1),
  claimB: z.string().min(1),
  evidenceIds: z.array(z.number().int().positive()),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string().min(1),
});

const uncertaintySchema = z.object({
  claimId: z.string().min(1).nullable(),
  issue: z.string().min(1),
});

const analysisSchema = z.object({
  claims: z.array(claimSchema).max(20),
  contradictions: z.array(contradictionSchema).max(12),
  uncertainties: z.array(uncertaintySchema).max(12),
});

const critiqueSchema = z.object({
  challengedClaimIds: z.array(z.string()),
  unsupportedClaimIds: z.array(z.string()),
  contradictions: z.array(contradictionSchema).max(12),
  uncertainties: z.array(uncertaintySchema).max(12),
  verdict: z.enum(["supported", "partially-supported", "insufficient"]),
});

const synthesisSchema = z.object({
  answer: z.string().min(1).max(12000),
  retainedClaimIds: z.array(z.string()).max(20),
  confidence: z.number().min(0).max(1),
  uncertainty: z.array(z.string()).max(12),
});

export type EpistemicAnalysis = z.infer<typeof analysisSchema>;
export type EpistemicCritique = z.infer<typeof critiqueSchema>;
export type EpistemicSynthesis = z.infer<typeof synthesisSchema>;

export type EpistemicResult = {
  answer: string;
  analysis: EpistemicAnalysis;
  critique: EpistemicCritique;
  synthesis: EpistemicSynthesis;
  stages: ["retrieval", "analysis", "critique", "adjudication", "synthesis"];
};

type Invoke = (messages: AIMessage[], options?: { temperature?: number }) => Promise<string>;

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseEpistemicJson<T>(value: string, schema: z.ZodType<T>): T | null {
  const cleaned = stripCodeFence(value);
  try {
    return schema.parse(JSON.parse(cleaned));
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first < 0 || last <= first) return null;
    try {
      return schema.parse(JSON.parse(cleaned.slice(first, last + 1)));
    } catch {
      return null;
    }
  }
}

function evidencePacket(evidence: EpistemicEvidence[]) {
  return evidence.map((item) => `[${item.id}] ${item.title}\n${item.headingPath}\n${item.excerpt}\n${item.url}`).join("\n\n");
}

function historyPacket(history: CairnConversationMessage[]) {
  return history
    .filter((message) => message.content.trim())
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.content.trim()}`)
    .join("\n");
}

const ANALYST_SYSTEM = `You are Cairn's epistemic analyst. Your job is to map a question onto supplied evidence without smuggling in unsupported assumptions.
Return JSON only with this shape:
{"claims":[{"id":"C1","text":"...","kind":"fact|inference|evaluation|hypothesis","evidenceIds":[1],"support":"direct|indirect|mixed|none","confidence":0.0}],"contradictions":[{"claimA":"C1","claimB":"C2","evidenceIds":[1,2],"severity":"low|medium|high","description":"..."}],"uncertainties":[{"claimId":"C1|null","issue":"..."}]}
Rules: every factual claim must point to evidence ids; mark inference separately from fact; preserve source disagreement; do not invent evidence ids; when evidence is insufficient, say so in uncertainties rather than filling the gap.`;

const CRITIC_SYSTEM = `You are Cairn's adversarial epistemic critic. Independently test the analyst's claims against the supplied evidence. Your purpose is falsification, not agreement.
Return JSON only with this shape:
{"challengedClaimIds":["C1"],"unsupportedClaimIds":["C2"],"contradictions":[{"claimA":"C1","claimB":"C2","evidenceIds":[1,2],"severity":"low|medium|high","description":"..."}],"uncertainties":[{"claimId":"C1|null","issue":"..."}],"verdict":"supported|partially-supported|insufficient"}
Rules: reject claims whose cited excerpts do not actually support them; look for scope errors, temporal mismatch, source conflict, missing premises, conflation of fact with inference, and conclusions stronger than the evidence; do not introduce facts from outside the supplied corpus.`;

const ADJUDICATOR_SYSTEM = `You are Cairn's epistemic adjudicator. Reconcile an analyst report and an adversarial critique using only the supplied evidence. Decide which claims survive, which must be weakened, and which must be discarded. Preserve genuine disagreement rather than averaging it away.
Return JSON only with this shape:
{"answer":"...","retainedClaimIds":["C1"],"confidence":0.0,"uncertainty":["..."]}
The answer is a concise provisional synthesis, not a hidden chain-of-thought. Never fabricate citations or source facts. Distinguish what the evidence establishes from what follows by inference.`;

const SYNTHESIZER_SYSTEM = `You are Cairn's final answer editor. Produce a clear answer to the user's question using the adjudicated claim set and supplied evidence. The answer must distinguish source fact from inference, explicitly preserve important conflicts, and state meaningful uncertainty. Do not add external facts. Do not invent citations. Do not mention internal agent roles or hidden reasoning.`;

export async function runEpistemicPipeline(input: {
  question: string;
  history: CairnConversationMessage[];
  evidence: EpistemicEvidence[];
  invoke?: Invoke;
}): Promise<EpistemicResult | null> {
  const call = input.invoke ?? invokeAI;
  if (!input.evidence.length) return null;

  const evidence = evidencePacket(input.evidence);
  const history = historyPacket(input.history);
  const context = `Question: ${input.question}\n\nConversation context:\n${history || "(none)"}\n\nEvidence:\n${evidence}`;

  const analysisRaw = await call([
    { role: "system", content: ANALYST_SYSTEM },
    { role: "user", content: context },
  ], { temperature: 0.1 });
  const analysis = parseEpistemicJson(analysisRaw, analysisSchema);
  if (!analysis) return null;

  const critiqueRaw = await call([
    { role: "system", content: CRITIC_SYSTEM },
    { role: "user", content: `${context}\n\nAnalyst report:\n${JSON.stringify(analysis)}` },
  ], { temperature: 0.1 });
  const critique = parseEpistemicJson(critiqueRaw, critiqueSchema);
  if (!critique) return null;

  const adjudicationRaw = await call([
    { role: "system", content: ADJUDICATOR_SYSTEM },
    { role: "user", content: `${context}\n\nAnalyst report:\n${JSON.stringify(analysis)}\n\nAdversarial critique:\n${JSON.stringify(critique)}` },
  ], { temperature: 0.1 });
  const adjudication = parseEpistemicJson(adjudicationRaw, synthesisSchema);
  if (!adjudication) return null;

  const synthesisRaw = await call([
    { role: "system", content: SYNTHESIZER_SYSTEM },
    {
      role: "user",
      content: `${context}\n\nAdjudicated synthesis:\n${JSON.stringify(adjudication)}\n\nEvidence ids available for citation: ${input.evidence.map((item) => item.id).join(", ")}`,
    },
  ], { temperature: 0.2 });
  const answer = readableModelAnswer(synthesisRaw);
  if (!answer) return null;

  return {
    answer,
    analysis,
    critique,
    synthesis: { ...adjudication, answer },
    stages: ["retrieval", "analysis", "critique", "adjudication", "synthesis"],
  };
}
