import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  bootstrapCaliforniaFamilyCodeExpert: vi.fn(),
  bootstrapCongressGovExpert: vi.fn(),
  listProjects: vi.fn(),
  answerFromProject: vi.fn(),
  research: vi.fn(),
}));

vi.mock("./knowledgeDb", () => ({
  createProject: mocks.createProject,
  bootstrapCaliforniaFamilyCodeExpert: mocks.bootstrapCaliforniaFamilyCodeExpert,
  bootstrapCongressGovExpert: mocks.bootstrapCongressGovExpert,
  listProjects: mocks.listProjects,
  answerFromProject: mocks.answerFromProject,
}));

vi.mock("./researchPipeline", () => ({
  research: mocks.research,
}));

import { projectsRouter } from "./routers/projects";

const ctx = { user: { id: 42 } } as never;

describe("projects router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a project for the authenticated owner", async () => {
    mocks.createProject.mockResolvedValue(7);
    const caller = projectsRouter.createCaller(ctx);

    await expect(caller.create({ name: "California law", description: "Official sources" })).resolves.toEqual({ projectId: 7 });
    expect(mocks.createProject).toHaveBeenCalledWith({ userId: 42, name: "California law", description: "Official sources" });
  });

  it("bootstraps the official Family Code expert for the authenticated owner", async () => {
    mocks.bootstrapCaliforniaFamilyCodeExpert.mockResolvedValue({ projectId: 11, collectionId: 22, sourceCount: 241, alreadyExists: false });
    const caller = projectsRouter.createCaller(ctx);

    await expect(caller.bootstrapCaliforniaFamilyCode()).resolves.toEqual({ projectId: 11, collectionId: 22, sourceCount: 241, alreadyExists: false });
    expect(mocks.bootstrapCaliforniaFamilyCodeExpert).toHaveBeenCalledWith(42);
  });

  it("prepares a separate Congress.gov expert for the authenticated owner", async () => {
    mocks.bootstrapCongressGovExpert.mockResolvedValue({ projectId: 12, sourceCount: 3, alreadyExists: false });
    const caller = projectsRouter.createCaller(ctx);

    await expect(caller.bootstrapCongressGov()).resolves.toEqual({ projectId: 12, sourceCount: 3, alreadyExists: false });
    expect(mocks.bootstrapCongressGovExpert).toHaveBeenCalledWith(42);
  });

  it("runs the pinned research boundary for the authenticated owner", async () => {
    mocks.research.mockResolvedValue({
      status: "evidence",
      collection: "California law",
      answerMode: "extractive",
      answer: "The source supports the conclusion.",
      citations: [{ id: 1, title: "Official source", url: "https://example.com", headingPath: "Section 1", excerpt: "The source supports the conclusion.", score: 2 }],
      relatedEntries: [],
      synthesized: false,
    });
    const caller = projectsRouter.createCaller(ctx);

    await expect(caller.answer({ projectId: 9, question: "What does this statute require?" })).resolves.toMatchObject({ status: "evidence", citations: [{ title: "Official source" }] });
    expect(mocks.research).toHaveBeenCalledWith({ userId: 42, projectId: 9, query: "What does this statute require?" });
  });

  it("lists only the authenticated owner’s projects", async () => {
    mocks.listProjects.mockResolvedValue([{ id: 9, name: "California law" }]);
    const caller = projectsRouter.createCaller(ctx);

    await expect(caller.list()).resolves.toEqual([{ id: 9, name: "California law" }]);
    expect(mocks.listProjects).toHaveBeenCalledWith(42);
  });
});
