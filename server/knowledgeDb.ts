import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { collectionPages, collections, importBatches, pageSnapshots, passages } from "../drizzle/schema";
import { chunkSnapshot, scrapeSnapshot } from "./websiteSafety";
import { buildEvidenceResponse, queryTerms } from "./evidence";
import { invokeLLM } from "./_core/llm";

export async function listCollections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: collections.id,
      name: collections.name,
      rootUrl: collections.rootUrl,
      scope: collections.scope,
      tone: collections.tone,
      answerMode: collections.answerMode,
      pageLimit: collections.pageLimit,
      importStatus: collections.importStatus,
      updatedAt: collections.updatedAt,
      pageCount: sql<number>`count(${collectionPages.id})`,
    })
    .from(collections)
    .leftJoin(collectionPages, eq(collectionPages.collectionId, collections.id))
    .where(eq(collections.userId, userId))
    .groupBy(collections.id)
    .orderBy(desc(collections.updatedAt));
}

export async function getCollection(userId: number, collectionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listPages(userId: number, collectionId: number) {
  const db = await getDb();
  if (!db) return [];
  const collection = await getCollection(userId, collectionId);
  if (!collection) return [];
  const rows = await db
    .select({
      id: collectionPages.id,
      canonicalUrl: collectionPages.canonicalUrl,
      pageTitle: collectionPages.pageTitle,
      sourceStatus: collectionPages.sourceStatus,
      contentHash: collectionPages.contentHash,
      importError: collectionPages.importError,
      importedAt: collectionPages.importedAt,
      fetchedAt: collectionPages.fetchedAt,
    })
    .from(collectionPages)
    .where(eq(collectionPages.collectionId, collectionId))
    .orderBy(desc(collectionPages.importedAt));
  if (!rows.length) return [];
  const counts = await db
    .select({ pageId: pageSnapshots.pageId, count: sql<number>`count(*)` })
    .from(pageSnapshots)
    .where(inArray(pageSnapshots.pageId, rows.map((row) => row.id)))
    .groupBy(pageSnapshots.pageId);
  const snapshotCountByPage = new Map(counts.map((count) => [count.pageId, Number(count.count)]));
  return rows.map((row) => ({ ...row, snapshotCount: snapshotCountByPage.get(row.id) ?? 0 }));
}

export async function listPageSnapshots(userId: number, collectionId: number, pageId: number) {
  const db = await getDb();
  if (!db) return [];
  const collection = await getCollection(userId, collectionId);
  if (!collection) return [];
  const page = await db
    .select({ id: collectionPages.id })
    .from(collectionPages)
    .where(and(eq(collectionPages.id, pageId), eq(collectionPages.collectionId, collectionId)))
    .limit(1);
  if (!page[0]) return [];
  return db.select().from(pageSnapshots).where(eq(pageSnapshots.pageId, pageId)).orderBy(desc(pageSnapshots.version));
}

export async function getLatestImportBatch(userId: number, collectionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const collection = await getCollection(userId, collectionId);
  if (!collection) return undefined;
  const rows = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.collectionId, collectionId))
    .orderBy(desc(importBatches.createdAt))
    .limit(1);
  return rows[0];
}

export async function createCollection(input: {
  userId: number;
  name: string;
  rootUrl: string;
  scope: string;
  audience: string;
  tone: string;
  answerMode: "extractive" | "source-backed" | "labeled-synthesis";
  includePaths: string;
  excludePaths: string;
  pageLimit: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const result = await db.insert(collections).values({ ...input, importStatus: "idle" });
  return Number(result[0].insertId);
}

export async function updateProfile(
  userId: number,
  collectionId: number,
  input: Partial<Pick<typeof collections.$inferInsert, "name" | "scope" | "audience" | "tone" | "answerMode" | "aiSynthesisEnabled" | "includePaths" | "excludePaths" | "pageLimit">>,
) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const collection = await getCollection(userId, collectionId);
  if (!collection) throw new Error("Collection not found.");
  await db.update(collections).set(input).where(eq(collections.id, collectionId));
}

export async function startImport(userId: number, collectionId: number, urls: string[]) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const collection = await getCollection(userId, collectionId);
  if (!collection) throw new Error("Collection not found.");
  const selectedUrls = Array.from(new Set(urls)).slice(0, collection.pageLimit);
  if (!selectedUrls.length) throw new Error("Select at least one approved page before importing.");
  const result = await db.insert(importBatches).values({
    collectionId,
    status: "running",
    requestedCount: selectedUrls.length,
    processedCount: 0,
    unchangedCount: 0,
    failedCount: 0,
  });
  const batchId = Number(result[0].insertId);
  for (const url of selectedUrls) {
    const existing = await db
      .select({ id: collectionPages.id })
      .from(collectionPages)
      .where(and(eq(collectionPages.collectionId, collectionId), eq(collectionPages.canonicalUrl, url)))
      .limit(1);
    if (existing[0]) {
      await db
        .update(collectionPages)
        .set({ sourceStatus: "queued", importBatchId: batchId, importError: null })
        .where(eq(collectionPages.id, existing[0].id));
    } else {
      await db.insert(collectionPages).values({
        collectionId,
        importBatchId: batchId,
        canonicalUrl: url,
        pageTitle: new URL(url).hostname,
        headings: [],
        sourceStatus: "queued",
        contentHash: "",
      });
    }
  }
  await db.update(collections).set({ importStatus: "importing" }).where(eq(collections.id, collectionId));
  return runNextImportBatch(userId, batchId);
}

export async function runNextImportBatch(userId: number, batchId: number) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const batch = await db.select().from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
  if (!batch[0]) throw new Error("Import batch not found.");
  const collection = await getCollection(userId, batch[0].collectionId);
  if (!collection) throw new Error("Collection not found.");
  const queued = await db
    .select()
    .from(collectionPages)
    .where(and(eq(collectionPages.importBatchId, batchId), eq(collectionPages.sourceStatus, "queued")))
    .orderBy(asc(collectionPages.id))
    .limit(5);
  let processed = 0;
  let unchanged = 0;
  let failed = 0;
  for (const page of queued) {
    try {
      const snapshot = await scrapeSnapshot(page.canonicalUrl);
      if (page.contentHash && page.contentHash === snapshot.contentHash) {
        unchanged += 1;
        await db
          .update(collectionPages)
          .set({ sourceStatus: "unchanged", fetchedAt: snapshot.fetchedAt, importedAt: new Date(), importError: null })
          .where(eq(collectionPages.id, page.id));
        continue;
      }
      const drafts = chunkSnapshot(snapshot);
      await db.delete(passages).where(eq(passages.pageId, page.id));
      await db.update(collectionPages).set({
        canonicalUrl: snapshot.canonicalUrl,
        pageTitle: snapshot.title,
        headings: snapshot.headings,
        cleanText: snapshot.text,
        contentHash: snapshot.contentHash,
        sourceStatus: "ready",
        fetchedAt: snapshot.fetchedAt,
        importedAt: new Date(),
        importError: null,
      }).where(eq(collectionPages.id, page.id));
      const versionRows = await db
        .select({ version: pageSnapshots.version })
        .from(pageSnapshots)
        .where(eq(pageSnapshots.pageId, page.id))
        .orderBy(desc(pageSnapshots.version))
        .limit(1);
      await db.insert(pageSnapshots).values({
        pageId: page.id,
        importBatchId: batchId,
        version: (versionRows[0]?.version ?? 0) + 1,
        pageTitle: snapshot.title,
        headings: snapshot.headings,
        cleanText: snapshot.text,
        contentHash: snapshot.contentHash,
        fetchedAt: snapshot.fetchedAt,
      });
      if (drafts.length) {
        await db.insert(passages).values(drafts.map((draft) => ({ ...draft, collectionId: collection.id, pageId: page.id })));
      }
      processed += 1;
    } catch (error) {
      failed += 1;
      await db.update(collectionPages).set({
        sourceStatus: "failed",
        importError: error instanceof Error ? error.message.slice(0, 500) : "Unable to import this page.",
      }).where(eq(collectionPages.id, page.id));
    }
  }
  const remainingRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(collectionPages)
    .where(and(eq(collectionPages.importBatchId, batchId), eq(collectionPages.sourceStatus, "queued")));
  const remaining = Number(remainingRows[0]?.count || 0);
  await db
    .update(importBatches)
    .set({
      status: remaining ? "paused" : "complete",
      processedCount: sql`${importBatches.processedCount} + ${processed}`,
      unchangedCount: sql`${importBatches.unchangedCount} + ${unchanged}`,
      failedCount: sql`${importBatches.failedCount} + ${failed}`,
      completedAt: remaining ? null : new Date(),
    })
    .where(eq(importBatches.id, batchId));
  await db
    .update(collections)
    .set({ importStatus: remaining ? "importing" : failed ? "attention" : "ready" })
    .where(eq(collections.id, collection.id));
  return { batchId, processed, unchanged, failed, remaining, complete: remaining === 0 };
}

export async function refreshCollection(userId: number, collectionId: number) {
  const pages = await listPages(userId, collectionId);
  return startImport(userId, collectionId, pages.map((page) => page.canonicalUrl));
}

export async function answerFromCollection(userId: number, collectionId: number, question: string, useOptionalSynthesis = false) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const collection = await getCollection(userId, collectionId);
  if (!collection) throw new Error("Collection not found.");
  const terms = queryTerms(question);
  if (!terms.length) throw new Error("Ask a more specific question using at least one meaningful term.");
  const predicates = terms.map((term) => like(passages.text, `%${term}%`));
  const rows = await db
    .select({
      passageId: passages.id,
      passageText: passages.text,
      headingPath: passages.headingPath,
      anchor: passages.anchor,
      pageTitle: collectionPages.pageTitle,
      url: collectionPages.canonicalUrl,
    })
    .from(passages)
    .innerJoin(collectionPages, eq(passages.pageId, collectionPages.id))
    .where(and(eq(passages.collectionId, collectionId), or(...predicates)))
    .limit(80);
  const evidence = buildEvidenceResponse({ collection: collection.name, answerMode: collection.answerMode, question, rows });
  if (evidence.status !== "evidence" || !useOptionalSynthesis || !collection.aiSynthesisEnabled) return evidence;
  const sourcePacket = evidence.citations.map((citation, index) => `[${index + 1}] ${citation.title} — ${citation.headingPath}\n${citation.excerpt}`).join("\n\n");
  const response = await invokeLLM({
    model: "gpt-5-nano",
    messages: [
      { role: "system", content: "You write short, source-bounded reference entries. Use only the supplied excerpts. Never add facts, resolve gaps with assumptions, or mention material not present in the excerpts. Cite relevant statements using [1], [2], and so on. If the excerpts do not support an answer, say exactly: Insufficient evidence in this collection." },
      { role: "user", content: `Question: ${question}\n\nApproved source excerpts:\n${sourcePacket}\n\nWrite no more than 130 words.` },
    ],
  });
  const content = response.choices[0]?.message.content;
  const synthesis = typeof content === "string" ? content.trim() : "";
  if (!synthesis) return evidence;
  return { ...evidence, answer: synthesis, synthesized: true };
}
