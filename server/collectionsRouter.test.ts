import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  answerFromCollection: vi.fn(),
  createCollection: vi.fn(),
  ensureDefaultProject: vi.fn(),
  getCollection: vi.fn(),
  getLatestImportBatch: vi.fn(),
  getLatestSourceArchive: vi.fn(),
  importUploadedDocument: vi.fn(),
  listCollections: vi.fn(),
  listPageSnapshots: vi.fn(),
  listPages: vi.fn(),
  refreshCollection: vi.fn(),
  runNextImportBatch: vi.fn(),
  startImport: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("./knowledgeDb", () => mocks);

import { collectionsRouter } from "./routers/collections";

const ctx = { user: { id: 42 } } as never;

describe("collections router official archive status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns archive provenance alongside an owned official-primary collection", async () => {
    const collection = { id: 9, userId: 42, sourceAuthority: "official_primary" };
    const archive = {
      fileName: "pubinfo_2025.zip",
      sourceUrl: "https://downloads.example/pubinfo_2025.zip",
      archiveSha256: "a3efc8049f45406a4cc96871e1a23c3af8ead6bf81847947bdbf57d136c8215e",
      acquiredAt: new Date("2026-08-25T00:00:00.000Z"),
      recordCount: 1636,
      extractSha256: "example-extract",
    };
    mocks.getCollection.mockResolvedValue(collection);
    mocks.listPages.mockResolvedValue([]);
    mocks.getLatestImportBatch.mockResolvedValue(null);
    mocks.getLatestSourceArchive.mockResolvedValue(archive);
    const caller = collectionsRouter.createCaller(ctx);

    await expect(caller.get({ collectionId: 9 })).resolves.toEqual({ collection, pages: [], batch: null, sourceArchive: archive });
    expect(mocks.getCollection).toHaveBeenCalledWith(42, 9);
    expect(mocks.getLatestSourceArchive).toHaveBeenCalledWith(42, 9);
  });

  it("does not disclose archive provenance when owner-scoped collection lookup fails", async () => {
    mocks.getCollection.mockResolvedValue(undefined);
    const caller = collectionsRouter.createCaller(ctx);

    await expect(caller.get({ collectionId: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getLatestSourceArchive).not.toHaveBeenCalled();
  });
});
