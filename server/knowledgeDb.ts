import { and, asc, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { getDb } from "./db";
import { collectionPages, collections, importBatches, pageSnapshots, passages, projects, sourceArchives, uploadedDocuments } from "../drizzle/schema";
import { approvedCollectionUrls, chunkSnapshot, scrapeSnapshot } from "./websiteSafety";
import { buildEvidenceResponse, queryTerms, readableModelAnswer } from "./evidence";
import { invokeLLM } from "./_core/llm";
import { applyOptionalSynthesis } from "./optionalSynthesis";
import { planOfficialArchiveDelta } from "./primaryLawDelta";
import { storageGetSignedUrl, storagePut } from "./storage";

const require = createRequire(import.meta.url);
const parsePdf = require("pdf-parse/lib/pdf-parse.js") as (buffer: Buffer) => Promise<{ text: string }>;

const MAX_UPLOADED_DOCUMENT_BYTES = 20 * 1024 * 1024;
const SUPPORTED_DOCUMENT_TYPES = new Set(["application/pdf", "text/plain", "text/markdown"]);
const FAMILY_CODE_SOURCE_MAP_URL = "https://raw.githubusercontent.com/saintus-create/family-905324/main/tableofcontents.json";
const FAMILY_CODE_SOURCE_MAP_PAGE = "https://github.com/saintus-create/family-905324/blob/main/tableofcontents.json";
const FAMILY_CODE_ROOT_URL = "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=FAM";
const MAX_PRIMARY_LAW_MANIFEST_URLS = 250;

type FamilyCodeSourceMap = {
  california_family_code_structure?: Array<{
    parts?: Array<{
      chapters?: Array<{
        sections?: Array<{ section_number_citation?: string }>;
      }>;
    }>;
  }>;
};

export type OfficialFamilyCodeRecord = {
  recordKey: string;
  code: "FAM";
  sectionNumber: string;
  statute: { year: string | null; chapter: string | null; section: string | null };
  effectiveDate: string | null;
  sourceRowId: string | null;
  hierarchy: { division: string | null; title: string | null; part: string | null; chapter: string | null; article: string | null };
  history: string | null;
  sourceFile: string;
  active: boolean;
  sourceSystem: string | null;
  recordUpdatedAt: string | null;
  text: string;
  textSha256: string;
  archive: {
    fileName: string;
    sourceUrl: string;
    archiveSha256: string;
    archiveBytes: number;
    observedLastModified: string;
    observedEtag: string;
    acquiredAt: string;
  };
};

export type OfficialFamilyCodeManifest = {
  corpus: string;
  sourceAuthority: "official_primary";
  archive: OfficialFamilyCodeRecord["archive"];
  activeRecordCount: number;
};

export type OfficialCaliforniaRuleRecord = {
  ruleNumber: string;
  title: string;
  pageNumber: number;
  text: string;
  textSha256: string;
};

export type OfficialCaliforniaRulesTitleFiveManifest = {
  corpus: "California Rules of Court Title Five";
  sourceAuthority: "official_procedural";
  publisher: "California Courts, Judicial Branch of California";
  source: {
    fileName: string;
    sourceUrl: string;
    fileSha256: string;
    fileBytes: number;
    observedLastModified: string;
    acquiredAt: string;
  };
  ruleCount: number;
};

function batchesOf<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

export function officialFamilyCodeCitationMetadata(record: OfficialFamilyCodeRecord) {
  const canonicalUrl = `${record.archive.sourceUrl}#${encodeURIComponent(record.recordKey)}`;
  const sectionNumber = record.sectionNumber.trim().replace(/\.$/, "");
  const effectiveDate = record.effectiveDate?.slice(0, 10) || null;
  return { authority: "California Family Code", code: record.code, sectionNumber, statute: record.statute, effectiveDate, history: record.history, recordKey: record.recordKey, archiveSha256: record.archive.archiveSha256, sourceUrl: canonicalUrl };
}

function officialFamilyCodePageInput(record: OfficialFamilyCodeRecord) {
  const canonicalUrl = `${record.archive.sourceUrl}#${encodeURIComponent(record.recordKey)}`;
  const title = `California Family Code § ${record.sectionNumber}`;
  const hierarchy = [record.hierarchy.division, record.hierarchy.title, record.hierarchy.part, record.hierarchy.chapter, record.hierarchy.article].filter(Boolean).join(" · ");
  const headings = [{ level: 1, text: title, anchor: `official:${record.recordKey}` }, ...(hierarchy ? [{ level: 2, text: hierarchy, anchor: `official:${record.recordKey}:hierarchy` }] : [])];
  const text = `${title}\n\n${record.text}${record.history ? `\n\nOfficial history: ${record.history}` : ""}`;
  const officialCitationMetadata = officialFamilyCodeCitationMetadata(record);
  return { record, canonicalUrl, title, headings, text, officialCitationMetadata, contentHash: createHash("sha256").update(text).digest("hex") };
}

function validateOfficialFamilyCodeCorpus(manifest: OfficialFamilyCodeManifest, records: OfficialFamilyCodeRecord[]) {
  const archive = manifest.archive;
  if (manifest.corpus !== "California Family Code" || manifest.sourceAuthority !== "official_primary") throw new Error("The supplied manifest is not an official California Family Code corpus.");
  if (!/^[a-f0-9]{64}$/i.test(archive.archiveSha256) || !/^https:\/\/downloads\.leginfo\.legislature\.ca\.gov\//.test(archive.sourceUrl)) throw new Error("The supplied corpus does not identify an approved official California archive.");
  if (!records.length || records.length !== manifest.activeRecordCount) throw new Error("The supplied corpus record count does not match its manifest.");
  const seenKeys = new Set<string>();
  for (const record of records) {
    if (record.code !== "FAM" || !record.active || !record.recordKey || !record.sectionNumber || !record.text || record.text.length < 20) throw new Error("The corpus includes an invalid Family Code record.");
    if (record.archive.archiveSha256 !== archive.archiveSha256 || record.archive.sourceUrl !== archive.sourceUrl) throw new Error("The corpus mixes records from different archive snapshots.");
    if (createHash("sha256").update(record.text).digest("hex") !== record.textSha256) throw new Error(`The statutory text hash did not match ${record.recordKey}.`);
    if (seenKeys.has(record.recordKey)) throw new Error(`The corpus repeats the official record key ${record.recordKey}.`);
    seenKeys.add(record.recordKey);
  }
  return archive;
}

export async function familyCodeOfficialUrls() {
  const response = await fetch(FAMILY_CODE_SOURCE_MAP_URL, { headers: { accept: "application/json", "user-agent": "CairnPrimaryLawBootstrap/1.0" } });
  if (!response.ok) throw new Error(`Cairn could not read the Family Code source map (HTTP ${response.status}).`);
  const sourceText = await response.text();
  if (Buffer.byteLength(sourceText, "utf8") > 6_000_000) throw new Error("The Family Code source map exceeds the bootstrap safety limit.");
  let sourceMap: FamilyCodeSourceMap;
  try {
    sourceMap = JSON.parse(sourceText) as FamilyCodeSourceMap;
  } catch {
    throw new Error("The Family Code source map was not valid JSON.");
  }
  const officialUrls = new Set<string>();
  for (const division of sourceMap.california_family_code_structure ?? []) {
    for (const part of division.parts ?? []) {
      for (const chapter of part.chapters ?? []) {
        for (const section of chapter.sections ?? []) {
          if (!section.section_number_citation) continue;
          const url = new URL(section.section_number_citation);
          if (url.hostname !== "leginfo.legislature.ca.gov" || url.pathname !== "/faces/codes_displayText.xhtml" || url.searchParams.get("lawCode") !== "FAM") continue;
          officialUrls.add(url.toString());
        }
      }
    }
  }
  const urls = Array.from(officialUrls).sort();
  if (!urls.length) throw new Error("The Family Code source map did not contain usable official statutory routes.");
  if (urls.length > MAX_PRIMARY_LAW_MANIFEST_URLS) throw new Error("The Family Code source map exceeds the current staged-import safety limit.");
  return urls;
}

export async function importOfficialFamilyCodeCorpus(input: {
  userId: number;
  projectId: number;
  collectionId: number;
  manifest: OfficialFamilyCodeManifest;
  records: OfficialFamilyCodeRecord[];
}) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const project = await getProject(input.userId, input.projectId);
  const collection = await getCollection(input.userId, input.collectionId);
  if (!project || project.projectKind !== "primary_law") throw new Error("Primary-law corpus imports require the owner’s primary-law project.");
  if (!collection || collection.projectId !== project.id || collection.sourceAuthority !== "official_primary") throw new Error("Primary-law corpus imports require the matching official-primary collection.");
  const archive = validateOfficialFamilyCodeCorpus(input.manifest, input.records);
  const priorArchive = await db.select({ id: sourceArchives.id }).from(sourceArchives).where(and(eq(sourceArchives.collectionId, collection.id), eq(sourceArchives.archiveSha256, archive.archiveSha256))).limit(1);
  if (priorArchive[0]) return { archiveId: priorArchive[0].id, recordCount: 0, alreadyImported: true };

  const extract = Buffer.from(`${input.records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  const extractHash = createHash("sha256").update(extract).digest("hex");
  const storedExtract = await storagePut(`users/${input.userId}/primary-law/${archive.archiveSha256}/family-code-sections.jsonl`, extract, "application/x-ndjson");
  const now = new Date();
  const batchResult = await db.insert(importBatches).values({
    collectionId: collection.id,
    status: "running",
    requestedCount: input.records.length,
    processedCount: 0,
    unchangedCount: 0,
    failedCount: 0,
  });
  const batchId = Number(batchResult[0].insertId);
  let archiveId: number | undefined;
  try {
    const archiveResult = await db.insert(sourceArchives).values({
      collectionId: collection.id,
      sourceUrl: archive.sourceUrl,
      fileName: archive.fileName,
      archiveSha256: archive.archiveSha256,
      observedEtag: archive.observedEtag,
      observedLastModified: new Date(archive.observedLastModified),
      acquiredAt: new Date(archive.acquiredAt),
      recordCount: input.records.length,
      extractStorageKey: storedExtract.key,
      extractStorageUrl: storedExtract.url,
      extractSha256: extractHash,
    });
    archiveId = Number(archiveResult[0].insertId);
    const pageInputs = input.records.map(officialFamilyCodePageInput);
    for (const batch of batchesOf(pageInputs, 150)) {
      await db.insert(collectionPages).values(batch.map((page) => ({
        collectionId: collection.id,
        importBatchId: batchId,
        canonicalUrl: page.canonicalUrl,
        officialRecordKey: page.record.recordKey,
        officialTextSha256: page.record.textSha256,
        officialCitationMetadata: page.officialCitationMetadata,
        pageTitle: page.title,
        headings: page.headings,
        cleanText: page.text,
        contentHash: page.contentHash,
        sourceStatus: "ready" as const,
        fetchedAt: now,
        importedAt: now,
      })));
    }
    const importedPages = await db.select({ id: collectionPages.id, canonicalUrl: collectionPages.canonicalUrl }).from(collectionPages).where(eq(collectionPages.collectionId, collection.id));
    const pageIdByUrl = new Map(importedPages.map((page) => [page.canonicalUrl, page.id]));
    if (pageIdByUrl.size !== pageInputs.length) throw new Error("The official section pages did not persist completely.");
    for (const batch of batchesOf(pageInputs, 100)) {
      const snapshots = batch.map((page) => ({
        pageId: pageIdByUrl.get(page.canonicalUrl)!,
        importBatchId: batchId,
        sourceArchiveId: archiveId,
        version: 1,
        pageTitle: page.title,
        headings: page.headings,
        officialCitationMetadata: page.officialCitationMetadata,
        cleanText: page.text,
        contentHash: page.contentHash,
        fetchedAt: now,
      }));
      await db.insert(pageSnapshots).values(snapshots);
      const sectionPassages = batch.flatMap((page) => chunkSnapshot({ canonicalUrl: page.canonicalUrl, title: page.title, headings: page.headings, text: page.text, contentHash: page.contentHash, fetchedAt: now }).map((draft) => ({ ...draft, collectionId: collection.id, pageId: pageIdByUrl.get(page.canonicalUrl)! })));
      for (const passageBatch of batchesOf(sectionPassages, 100)) if (passageBatch.length) await db.insert(passages).values(passageBatch);
    }
    await db.update(importBatches).set({ status: "complete", processedCount: input.records.length, completedAt: now }).where(eq(importBatches.id, batchId));
    await db.update(collections).set({
      importStatus: "ready",
      rootUrl: archive.sourceUrl,
      scope: `Official California Family Code text extracted from ${archive.fileName}, acquired ${archive.acquiredAt}. Cairn retains active official section records, archive identity, source hashes, and immutable snapshots; commentary is excluded.`,
    }).where(eq(collections.id, collection.id));
    return { archiveId, recordCount: input.records.length, alreadyImported: false };
  } catch (error) {
    if (archiveId) await db.delete(sourceArchives).where(eq(sourceArchives.id, archiveId));
    await db.update(importBatches).set({ status: "failed", failedCount: input.records.length, completedAt: new Date() }).where(eq(importBatches.id, batchId));
    await db.update(collections).set({ importStatus: "attention" }).where(eq(collections.id, collection.id));
    throw error;
  }
}

export async function applyOfficialFamilyCodeDelta(input: {
  userId: number;
  projectId: number;
  collectionId: number;
  manifest: OfficialFamilyCodeManifest;
  records: OfficialFamilyCodeRecord[];
}) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const project = await getProject(input.userId, input.projectId);
  const collection = await getCollection(input.userId, input.collectionId);
  if (!project || project.projectKind !== "primary_law") throw new Error("Primary-law archive updates require the owner’s primary-law project.");
  if (!collection || collection.projectId !== project.id || collection.sourceAuthority !== "official_primary") throw new Error("Primary-law archive updates require the matching official-primary collection.");
  const archive = validateOfficialFamilyCodeCorpus(input.manifest, input.records);
  const duplicateArchive = await db.select({ id: sourceArchives.id }).from(sourceArchives).where(and(eq(sourceArchives.collectionId, collection.id), eq(sourceArchives.archiveSha256, archive.archiveSha256))).limit(1);
  if (duplicateArchive[0]) return { archiveId: duplicateArchive[0].id, alreadyImported: true, addedCount: 0, changedCount: 0, unchangedCount: 0, retiredCount: 0 };

  const previousArchiveRows = await db
    .select({
      sourceUrl: sourceArchives.sourceUrl,
      fileName: sourceArchives.fileName,
      archiveSha256: sourceArchives.archiveSha256,
      observedEtag: sourceArchives.observedEtag,
      observedLastModified: sourceArchives.observedLastModified,
      acquiredAt: sourceArchives.acquiredAt,
      recordCount: sourceArchives.recordCount,
      extractStorageKey: sourceArchives.extractStorageKey,
      extractSha256: sourceArchives.extractSha256,
    })
    .from(sourceArchives)
    .where(eq(sourceArchives.collectionId, collection.id))
    .orderBy(desc(sourceArchives.acquiredAt))
    .limit(1);
  const previousArchive = previousArchiveRows[0];
  if (!previousArchive) throw new Error("Cairn cannot apply a delta before an official Family Code archive is imported.");

  const previousExtractUrl = await storageGetSignedUrl(previousArchive.extractStorageKey);
  const previousExtractResponse = await fetch(previousExtractUrl);
  if (!previousExtractResponse.ok) throw new Error(`Cairn could not read the prior immutable archive extract (HTTP ${previousExtractResponse.status}).`);
  const previousExtract = Buffer.from(await previousExtractResponse.arrayBuffer());
  if (previousExtract.byteLength > 50 * 1024 * 1024) throw new Error("The prior immutable archive extract exceeds the delta safety limit.");
  if (createHash("sha256").update(previousExtract).digest("hex") !== previousArchive.extractSha256) throw new Error("The prior immutable archive extract did not match its recorded checksum.");
  let previousRecords: OfficialFamilyCodeRecord[];
  try {
    previousRecords = previousExtract.toString("utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as OfficialFamilyCodeRecord);
  } catch {
    throw new Error("The prior immutable archive extract is not valid selected-record JSONL.");
  }
  validateOfficialFamilyCodeCorpus({
    corpus: "California Family Code",
    sourceAuthority: "official_primary",
    activeRecordCount: previousArchive.recordCount,
    archive: {
      sourceUrl: previousArchive.sourceUrl,
      fileName: previousArchive.fileName,
      archiveSha256: previousArchive.archiveSha256,
      archiveBytes: 0,
      observedEtag: previousArchive.observedEtag ?? "",
      observedLastModified: previousArchive.observedLastModified?.toISOString() ?? previousArchive.acquiredAt.toISOString(),
      acquiredAt: previousArchive.acquiredAt.toISOString(),
    },
  }, previousRecords);
  const plan = planOfficialArchiveDelta(previousRecords, input.records);
  const nextPageByRecordKey = new Map(input.records.map((record) => [record.recordKey, officialFamilyCodePageInput(record)]));
  const selectedExtract = Buffer.from(`${input.records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  const selectedExtractSha256 = createHash("sha256").update(selectedExtract).digest("hex");
  const storedExtract = await storagePut(`users/${input.userId}/primary-law/${archive.archiveSha256}/family-code-sections.jsonl`, selectedExtract, "application/x-ndjson");
  const now = new Date();

  return db.transaction(async (tx) => {
    const batchResult = await tx.insert(importBatches).values({
      collectionId: collection.id,
      status: "complete",
      requestedCount: plan.applyCount + plan.retiredCount,
      processedCount: plan.applyCount + plan.retiredCount,
      unchangedCount: plan.retainedCount,
      failedCount: 0,
      completedAt: now,
    });
    const batchId = Number(batchResult[0].insertId);
    const archiveResult = await tx.insert(sourceArchives).values({
      collectionId: collection.id,
      sourceUrl: archive.sourceUrl,
      fileName: archive.fileName,
      archiveSha256: archive.archiveSha256,
      observedEtag: archive.observedEtag,
      observedLastModified: new Date(archive.observedLastModified),
      acquiredAt: new Date(archive.acquiredAt),
      recordCount: input.records.length,
      extractStorageKey: storedExtract.key,
      extractStorageUrl: storedExtract.url,
      extractSha256: selectedExtractSha256,
    });
    const archiveId = Number(archiveResult[0].insertId);
    const existingPages = await tx
      .select({ id: collectionPages.id, officialRecordKey: collectionPages.officialRecordKey, officialTextSha256: collectionPages.officialTextSha256 })
      .from(collectionPages)
      .where(eq(collectionPages.collectionId, collection.id));
    const pageByRecordKey = new Map(existingPages.filter((page): page is typeof page & { officialRecordKey: string } => Boolean(page.officialRecordKey)).map((page) => [page.officialRecordKey, page]));
    for (const record of previousRecords) {
      const page = pageByRecordKey.get(record.recordKey);
      if (!page) throw new Error(`Cairn cannot locate the prior official page for ${record.recordKey}.`);
      if (page.officialTextSha256 !== record.textSha256) await tx.update(collectionPages).set({ officialTextSha256: record.textSha256 }).where(eq(collectionPages.id, page.id));
    }

    const createdInputs = plan.added.map((record) => nextPageByRecordKey.get(record.recordKey)!).filter((page) => !pageByRecordKey.has(page.record.recordKey));
    for (const pageBatch of batchesOf(createdInputs, 100)) {
      if (!pageBatch.length) continue;
      await tx.insert(collectionPages).values(pageBatch.map((page) => ({
        collectionId: collection.id,
        importBatchId: batchId,
        canonicalUrl: page.canonicalUrl,
        officialRecordKey: page.record.recordKey,
        officialTextSha256: page.record.textSha256,
        officialCitationMetadata: page.officialCitationMetadata,
        pageTitle: page.title,
        headings: page.headings,
        cleanText: page.text,
        contentHash: page.contentHash,
        sourceStatus: "ready" as const,
        fetchedAt: now,
        importedAt: now,
      })));
    }
    if (createdInputs.length) {
      const createdPages = await tx.select({ id: collectionPages.id, officialRecordKey: collectionPages.officialRecordKey, officialTextSha256: collectionPages.officialTextSha256 }).from(collectionPages).where(and(eq(collectionPages.collectionId, collection.id), inArray(collectionPages.officialRecordKey, createdInputs.map((page) => page.record.recordKey))));
      for (const page of createdPages) if (page.officialRecordKey) pageByRecordKey.set(page.officialRecordKey, page as typeof page & { officialRecordKey: string });
      if (createdPages.length !== createdInputs.length) throw new Error("The added official section pages did not persist completely.");
    }

    const refreshInputs = [...plan.changed, ...plan.added].map((record) => nextPageByRecordKey.get(record.recordKey)!);
    for (const page of refreshInputs) {
      const existing = pageByRecordKey.get(page.record.recordKey);
      if (!existing) throw new Error(`Cairn cannot locate the official page for ${page.record.recordKey}.`);
      await tx.delete(passages).where(eq(passages.pageId, existing.id));
      await tx.update(collectionPages).set({
        importBatchId: batchId,
        canonicalUrl: page.canonicalUrl,
        officialTextSha256: page.record.textSha256,
        officialCitationMetadata: page.officialCitationMetadata,
        pageTitle: page.title,
        headings: page.headings,
        cleanText: page.text,
        contentHash: page.contentHash,
        sourceStatus: "ready",
        importError: null,
        fetchedAt: now,
        importedAt: now,
      }).where(eq(collectionPages.id, existing.id));
      const versionRows = await tx.select({ version: pageSnapshots.version }).from(pageSnapshots).where(eq(pageSnapshots.pageId, existing.id)).orderBy(desc(pageSnapshots.version)).limit(1);
      const version = (versionRows[0]?.version ?? 0) + 1;
      await tx.insert(pageSnapshots).values({ pageId: existing.id, importBatchId: batchId, sourceArchiveId: archiveId, version, pageTitle: page.title, headings: page.headings, officialCitationMetadata: page.officialCitationMetadata, cleanText: page.text, contentHash: page.contentHash, fetchedAt: now });
      const passageDrafts = chunkSnapshot({ canonicalUrl: page.canonicalUrl, title: page.title, headings: page.headings, text: page.text, contentHash: page.contentHash, fetchedAt: now }).map((draft) => ({ ...draft, collectionId: collection.id, pageId: existing.id }));
      for (const passageBatch of batchesOf(passageDrafts, 100)) if (passageBatch.length) await tx.insert(passages).values(passageBatch);
    }
    for (const record of plan.retired) {
      const page = pageByRecordKey.get(record.recordKey);
      if (!page) throw new Error(`Cairn cannot locate the retired official page for ${record.recordKey}.`);
      await tx.update(collectionPages).set({ sourceStatus: "retired", importBatchId: batchId, importedAt: now }).where(eq(collectionPages.id, page.id));
    }
    await tx.update(collections).set({
      importStatus: "ready",
      rootUrl: archive.sourceUrl,
      scope: `Official California Family Code text extracted from ${archive.fileName}, acquired ${archive.acquiredAt}. Cairn retains active official section records, retired historical pages, archive identity, source hashes, and immutable snapshots; commentary is excluded.`,
    }).where(eq(collections.id, collection.id));
    return { archiveId, alreadyImported: false, addedCount: plan.added.length, changedCount: plan.changed.length, unchangedCount: plan.unchanged.length, retiredCount: plan.retired.length };
  });
}

export async function importOfficialCaliforniaRulesTitleFive(input: {
  userId: number;
  projectId: number;
  manifest: OfficialCaliforniaRulesTitleFiveManifest;
  rules: OfficialCaliforniaRuleRecord[];
  sourcePdf: Buffer;
}) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const project = await getProject(input.userId, input.projectId);
  if (!project || project.projectKind !== "primary_law") throw new Error("Official procedural imports require the owner’s primary-law project.");
  const { manifest, rules, sourcePdf } = input;
  const source = manifest.source;
  if (manifest.corpus !== "California Rules of Court Title Five" || manifest.sourceAuthority !== "official_procedural" || manifest.publisher !== "California Courts, Judicial Branch of California") throw new Error("The supplied manifest is not an official California Rules of Court Title Five corpus.");
  if (!/^https:\/\/courts\.ca\.gov\/system\/files\?file=file\/roc-title-5/i.test(source.sourceUrl) || !/^[a-f0-9]{64}$/i.test(source.fileSha256)) throw new Error("The supplied procedural corpus does not identify the approved California Courts Title Five PDF.");
  if (!sourcePdf.length || sourcePdf.length !== source.fileBytes || createHash("sha256").update(sourcePdf).digest("hex") !== source.fileSha256) throw new Error("The supplied Title Five PDF did not match its verified file provenance.");
  if (!rules.length || rules.length !== manifest.ruleCount) throw new Error("The supplied procedural rule count does not match its manifest.");
  const seenRules = new Set<string>();
  for (const rule of rules) {
    if (!/^5\.\d+(?:\.\d+)?$/.test(rule.ruleNumber) || !rule.title.trim() || !rule.text.trim() || rule.pageNumber < 1) throw new Error("The procedural corpus includes an invalid Title Five rule record.");
    if (createHash("sha256").update(rule.text).digest("hex") !== rule.textSha256) throw new Error(`The procedural rule text hash did not match Rule ${rule.ruleNumber}.`);
    if (seenRules.has(rule.ruleNumber)) throw new Error(`The procedural corpus repeats Rule ${rule.ruleNumber}.`);
    seenRules.add(rule.ruleNumber);
  }
  const existingCollections = await db.select({ id: collections.id }).from(collections).where(and(eq(collections.userId, input.userId), eq(collections.projectId, project.id), eq(collections.sourceAuthority, "official_procedural"), eq(collections.rootUrl, source.sourceUrl))).limit(1);
  if (existingCollections[0]) {
    const prior = await db.select({ id: sourceArchives.id }).from(sourceArchives).where(and(eq(sourceArchives.collectionId, existingCollections[0].id), eq(sourceArchives.archiveSha256, source.fileSha256))).limit(1);
    if (prior[0]) return { collectionId: existingCollections[0].id, archiveId: prior[0].id, ruleCount: 0, alreadyImported: true };
    throw new Error("A different official Title Five PDF is already present. Prepare a reviewed procedural-rule delta before replacing it.");
  }
  const storedPdf = await storagePut(`users/${input.userId}/primary-law/${source.fileSha256}/${source.fileName}`, sourcePdf, "application/pdf");
  const extract = Buffer.from(`${rules.map((rule) => JSON.stringify(rule)).join("\n")}\n`, "utf8");
  const extractSha256 = createHash("sha256").update(extract).digest("hex");
  const storedExtract = await storagePut(`users/${input.userId}/primary-law/${source.fileSha256}/title-five-rules.jsonl`, extract, "application/x-ndjson");
  const now = new Date();

  return db.transaction(async (tx) => {
    const collectionResult = await tx.insert(collections).values({
      userId: input.userId,
      projectId: project.id,
      name: "California Rules of Court — Title Five",
      rootUrl: source.sourceUrl,
      scope: `Official California Courts Title Five: Family and Juvenile Rules. Verified PDF ${source.fileName}, acquired ${source.acquiredAt}; rule citations open the official PDF at the stored page location. This separate procedural collection is not statutory text.`,
      audience: "A careful general reader",
      tone: "Direct, clear-eyed, and evidence-led",
      answerMode: "extractive",
      sourceAuthority: "official_procedural",
      publisher: manifest.publisher,
      includePaths: "/",
      excludePaths: "",
      pageLimit: rules.length,
      importStatus: "ready",
    });
    const collectionId = Number(collectionResult[0].insertId);
    const batchResult = await tx.insert(importBatches).values({ collectionId, status: "complete", requestedCount: rules.length, processedCount: rules.length, unchangedCount: 0, failedCount: 0, completedAt: now });
    const batchId = Number(batchResult[0].insertId);
    const archiveResult = await tx.insert(sourceArchives).values({
      collectionId,
      sourceUrl: source.sourceUrl,
      fileName: source.fileName,
      archiveSha256: source.fileSha256,
      observedLastModified: new Date(source.observedLastModified),
      acquiredAt: new Date(source.acquiredAt),
      recordCount: rules.length,
      sourceFileStorageKey: storedPdf.key,
      sourceFileStorageUrl: storedPdf.url,
      sourceFileSha256: source.fileSha256,
      sourceFileBytes: source.fileBytes,
      extractStorageKey: storedExtract.key,
      extractStorageUrl: storedExtract.url,
      extractSha256,
    });
    const archiveId = Number(archiveResult[0].insertId);
    const rulePages = rules.map((rule) => {
      const title = `California Rules of Court, Title Five — Rule ${rule.ruleNumber}. ${rule.title}`;
      const canonicalUrl = `${source.sourceUrl}#rule=${encodeURIComponent(rule.ruleNumber)}`;
      const headings = [{ level: 1, text: title, anchor: `pdfpage:${rule.pageNumber}` }];
      const text = `${title}\n\n${rule.text}`;
      return { rule, title, canonicalUrl, headings, text, contentHash: createHash("sha256").update(text).digest("hex") };
    });
    for (const pageBatch of batchesOf(rulePages, 100)) await tx.insert(collectionPages).values(pageBatch.map((page) => ({
      collectionId,
      importBatchId: batchId,
      canonicalUrl: page.canonicalUrl,
      officialRecordKey: `ROC5:${page.rule.ruleNumber}`,
      officialTextSha256: page.rule.textSha256,
      pageTitle: page.title,
      headings: page.headings,
      cleanText: page.text,
      contentHash: page.contentHash,
      sourceStatus: "ready" as const,
      fetchedAt: now,
      importedAt: now,
    })));
    const pages = await tx.select({ id: collectionPages.id, officialRecordKey: collectionPages.officialRecordKey }).from(collectionPages).where(eq(collectionPages.collectionId, collectionId));
    const pageIdByRuleKey = new Map(pages.filter((page): page is typeof page & { officialRecordKey: string } => Boolean(page.officialRecordKey)).map((page) => [page.officialRecordKey, page.id]));
    if (pageIdByRuleKey.size !== rulePages.length) throw new Error("The official Title Five rule pages did not persist completely.");
    for (const pageBatch of batchesOf(rulePages, 80)) {
      await tx.insert(pageSnapshots).values(pageBatch.map((page) => ({ pageId: pageIdByRuleKey.get(`ROC5:${page.rule.ruleNumber}`)!, importBatchId: batchId, sourceArchiveId: archiveId, version: 1, pageTitle: page.title, headings: page.headings, cleanText: page.text, contentHash: page.contentHash, fetchedAt: now })));
      const passageDrafts = pageBatch.flatMap((page) => chunkSnapshot({ canonicalUrl: page.canonicalUrl, title: page.title, headings: page.headings, text: page.text, contentHash: page.contentHash, fetchedAt: now }).map((draft) => ({ ...draft, collectionId, pageId: pageIdByRuleKey.get(`ROC5:${page.rule.ruleNumber}`)! })));
      for (const passageBatch of batchesOf(passageDrafts, 100)) if (passageBatch.length) await tx.insert(passages).values(passageBatch);
    }
    return { collectionId, archiveId, ruleCount: rules.length, alreadyImported: false };
  });
}

export async function getProject(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  return rows[0];
}

export async function ensureDefaultProject(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const existing = await db.select().from(projects).where(eq(projects.userId, userId)).orderBy(asc(projects.id)).limit(1);
  if (existing[0]) return existing[0];
  const result = await db.insert(projects).values({ userId, name: "Unfiled research", description: "" });
  const created = await getProject(userId, Number(result[0].insertId));
  if (!created) throw new Error("Cairn could not create the first project.");
  return created;
}

export async function listProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureDefaultProject(userId);
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      updatedAt: projects.updatedAt,
      collectionCount: sql<number>`count(${collections.id})`,
    })
    .from(projects)
    .leftJoin(collections, eq(collections.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt));
}

export async function createProject(input: { userId: number; name: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const result = await db.insert(projects).values({ userId: input.userId, name: input.name, description: input.description ?? "" });
  return Number(result[0].insertId);
}

export async function bootstrapCaliforniaFamilyCodeExpert(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const existing = await db.select().from(projects).where(and(eq(projects.userId, userId), eq(projects.name, "California Family Code expert"))).limit(1);
  if (existing[0]) {
    const existingCollection = await db.select({ id: collections.id }).from(collections).where(eq(collections.projectId, existing[0].id)).limit(1);
    const activeArchive = existingCollection[0]
      ? await db.select({ fileName: sourceArchives.fileName, recordCount: sourceArchives.recordCount, acquiredAt: sourceArchives.acquiredAt }).from(sourceArchives).where(eq(sourceArchives.collectionId, existingCollection[0].id)).orderBy(desc(sourceArchives.acquiredAt)).limit(1)
      : [];
    return { projectId: existing[0].id, collectionId: existingCollection[0]?.id ?? null, sourceCount: activeArchive[0]?.recordCount ?? 0, archive: activeArchive[0] ?? null, alreadyExists: true };
  }
  const urls = await familyCodeOfficialUrls();
  const projectResult = await db.insert(projects).values({
    userId,
    name: "California Family Code expert",
    description: "Official Family Code statutory text, with separate companion sources added only by approval.",
    projectKind: "primary_law",
  });
  const projectId = Number(projectResult[0].insertId);
  const collectionId = await createCollection({
    userId,
    projectId,
    name: "California Family Code — official text",
    rootUrl: FAMILY_CODE_ROOT_URL,
    scope: "Official California Family Code bulk source manifest. The public portal is not crawled; Cairn will add statutory text only after an approved official database extraction preserves archive provenance and snapshots.",
    audience: "A careful researcher",
    tone: "Direct, exact, and evidence-led",
    answerMode: "extractive",
    includePaths: "/faces/codes_displayText.xhtml",
    excludePaths: "",
    pageLimit: 50,
    sourceAuthority: "official_primary",
    publisher: "California Office of Legislative Counsel",
    sourceMapUrl: FAMILY_CODE_SOURCE_MAP_PAGE,
  });
  return { projectId, collectionId, sourceCount: urls.length, archive: null, alreadyExists: false };
}

export async function bootstrapCongressGovExpert(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const existing = await db.select().from(projects).where(and(eq(projects.userId, userId), eq(projects.name, "Congress.gov federal law expert"))).limit(1);
  if (existing[0]) {
    const sourceCount = await db.select({ count: sql<number>`count(*)` }).from(collections).where(eq(collections.projectId, existing[0].id));
    return { projectId: existing[0].id, sourceCount: Number(sourceCount[0]?.count ?? 0), alreadyExists: true };
  }
  const projectResult = await db.insert(projects).values({
    userId,
    name: "Congress.gov federal law expert",
    description: "Official federal bill text, public laws, and U.S. Code sources kept in separate evidence boundaries.",
    projectKind: "primary_law",
  });
  const projectId = Number(projectResult[0].insertId);
  const common = { userId, projectId, audience: "A careful researcher", tone: "Direct, exact, and evidence-led", answerMode: "extractive" as const, includePaths: "/", excludePaths: "", pageLimit: 1, sourceAuthority: "official_primary" as const, publisher: "Congress.gov, Library of Congress" };
  await createCollection({
    ...common,
    name: "Congress.gov — bill and resolution text",
    rootUrl: "https://www.congress.gov/legislation",
    scope: "Prepared official federal bill and resolution text boundary. Versions, Congress number, and bill identifier must be recorded before any evidence is admitted; no current bill text has been imported.",
  });
  await createCollection({
    ...common,
    name: "Congress.gov — public laws and Statutes at Large",
    rootUrl: "https://www.congress.gov/public-laws",
    scope: "Prepared official public-law and Statutes at Large boundary. Enacted law text remains distinct from bill versions and is not yet imported.",
  });
  await createCollection({
    ...common,
    name: "U.S. Code — official codification",
    rootUrl: "https://uscode.house.gov/",
    scope: "Prepared official U.S. Code boundary. Current codified text must remain distinct from Congress.gov bill and public-law sources; no code text has been imported.",
    publisher: "Office of the Law Revision Counsel, U.S. House of Representatives",
  });
  return { projectId, sourceCount: 3, alreadyExists: false };
}

function safeDocumentName(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "Untitled document").slice(0, 255);
}

function documentMimeType(fileName: string, mimeType: string) {
  if (SUPPORTED_DOCUMENT_TYPES.has(mimeType)) return mimeType;
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "md" || extension === "markdown") return "text/markdown";
  if (extension === "txt") return "text/plain";
  throw new Error("Upload a PDF, plain-text, or Markdown document.");
}

export async function extractUploadedDocumentText(fileName: string, mimeType: string, buffer: Buffer) {
  const normalizedType = documentMimeType(fileName, mimeType);
  const text = normalizedType === "application/pdf" ? (await parsePdf(buffer)).text : buffer.toString("utf8");
  const cleanText = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleanText.length < 80) throw new Error("This file did not contain enough readable text to become a source.");
  return { mimeType: normalizedType, text: cleanText };
}

export async function importUploadedDocument(input: { userId: number; projectId: number; fileName: string; mimeType: string; base64: string }) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const fileName = safeDocumentName(input.fileName);
  const buffer = Buffer.from(input.base64, "base64");
  if (!buffer.length || buffer.length > MAX_UPLOADED_DOCUMENT_BYTES) throw new Error("Files must be between 1 byte and 20 MB.");
  const extracted = await extractUploadedDocumentText(fileName, input.mimeType, buffer);
  const project = await getProject(input.userId, input.projectId);
  if (!project) throw new Error("Project not found.");
  const collectionName = fileName.replace(/\.[^.]+$/, "").slice(0, 80) || "Untitled document";
  const storage = await storagePut(`users/${input.userId}/documents/${Date.now()}-${fileName}`, buffer, extracted.mimeType);
  const contentHash = createHash("sha256").update(extracted.text).digest("hex");
  const headings = [{ level: 1, text: collectionName, anchor: `id:${collectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "document"}` }];
  const now = new Date();
  const collectionResult = await db.insert(collections).values({
    userId: input.userId,
    projectId: project.id,
    name: collectionName,
    rootUrl: storage.url,
    scope: `Private uploaded source: ${fileName}.`,
    audience: "A careful general reader",
    tone: "Direct, clear-eyed, and evidence-led",
    answerMode: "extractive",
    includePaths: "/",
    excludePaths: "",
    pageLimit: 1,
    importStatus: "ready",
  });
  const collectionId = Number(collectionResult[0].insertId);
  const batchResult = await db.insert(importBatches).values({
    collectionId,
    status: "complete",
    requestedCount: 1,
    processedCount: 1,
    unchangedCount: 0,
    failedCount: 0,
    completedAt: now,
  });
  const batchId = Number(batchResult[0].insertId);
  const pageResult = await db.insert(collectionPages).values({
    collectionId,
    importBatchId: batchId,
    canonicalUrl: storage.url,
    pageTitle: collectionName,
    headings,
    cleanText: extracted.text,
    contentHash,
    sourceStatus: "ready",
    fetchedAt: now,
    importedAt: now,
  });
  const pageId = Number(pageResult[0].insertId);
  await db.insert(pageSnapshots).values({
    pageId,
    importBatchId: batchId,
    version: 1,
    pageTitle: collectionName,
    headings,
    cleanText: extracted.text,
    contentHash,
    fetchedAt: now,
  });
  const drafts = chunkSnapshot({ canonicalUrl: storage.url, title: collectionName, headings, text: extracted.text, contentHash, fetchedAt: now });
  if (drafts.length) await db.insert(passages).values(drafts.map((draft) => ({ ...draft, collectionId, pageId })));
  const documentResult = await db.insert(uploadedDocuments).values({
    userId: input.userId,
    collectionId,
    pageId,
    fileName,
    mimeType: extracted.mimeType,
    byteSize: buffer.length,
    storageKey: storage.key,
    storageUrl: storage.url,
    status: "ready",
  });
  return { documentId: Number(documentResult[0].insertId), collectionId, pageId, fileName, passageCount: drafts.length };
}

export async function listCollections(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  const activeProject = projectId ? await getProject(userId, projectId) : await ensureDefaultProject(userId);
  if (!activeProject) return [];
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
    .where(and(eq(collections.userId, userId), eq(collections.projectId, activeProject.id)))
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

export async function getLatestSourceArchive(userId: number, collectionId: number) {
  const collection = await getCollection(userId, collectionId);
  if (!collection || !["official_primary", "official_procedural"].includes(collection.sourceAuthority)) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      fileName: sourceArchives.fileName,
      sourceUrl: sourceArchives.sourceUrl,
      archiveSha256: sourceArchives.archiveSha256,
      acquiredAt: sourceArchives.acquiredAt,
      recordCount: sourceArchives.recordCount,
      extractSha256: sourceArchives.extractSha256,
    })
    .from(sourceArchives)
    .where(eq(sourceArchives.collectionId, collection.id))
    .orderBy(desc(sourceArchives.acquiredAt))
    .limit(1);
  return rows[0] ?? null;
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
  projectId: number;
  name: string;
  rootUrl: string;
  scope: string;
  audience: string;
  tone: string;
  answerMode: "extractive" | "source-backed" | "labeled-synthesis";
  includePaths: string;
  excludePaths: string;
  pageLimit: number;
  sourceAuthority?: "general" | "official_primary" | "official_procedural" | "user_reference";
  publisher?: string;
  sourceMapUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const project = await getProject(input.userId, input.projectId);
  if (!project) throw new Error("Project not found.");
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
  const selectedUrls = approvedCollectionUrls({
    urls,
    rootUrl: collection.rootUrl,
    includePaths: collection.includePaths,
    excludePaths: collection.excludePaths,
    pageLimit: collection.pageLimit,
  });
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
  const predicates = terms.map((term) => or(like(passages.text, `%${term}%`), like(collectionPages.pageTitle, `%${term}%`)));
  const rows = await db
    .select({
      passageId: passages.id,
      passageText: passages.text,
      headingPath: passages.headingPath,
      anchor: passages.anchor,
      pageTitle: collectionPages.pageTitle,
      url: collectionPages.canonicalUrl,
      officialCitationMetadata: collectionPages.officialCitationMetadata,
    })
    .from(passages)
    .innerJoin(collectionPages, eq(passages.pageId, collectionPages.id))
    .where(and(eq(passages.collectionId, collectionId), ne(collectionPages.sourceStatus, "retired"), or(...predicates)))
    .limit(80);
  const evidence = buildEvidenceResponse({ collection: collection.name, answerMode: collection.answerMode, question, rows });
  if (evidence.status !== "evidence" || !useOptionalSynthesis || !collection.aiSynthesisEnabled) return evidence;
  const sourcePacket = evidence.citations.map((citation, index) => `[${index + 1}] ${citation.title} — ${citation.headingPath}\n${citation.excerpt}`).join("\n\n");
  return applyOptionalSynthesis(evidence, true, async () => {
    const response = await invokeLLM({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: "You write concise, source-bounded reference entries with direct rhetoric. State conclusions plainly when the supplied excerpts support them; do not soften clear evidence with filler. Never add facts, resolve gaps with assumptions, erase genuine disagreement, or imply certainty beyond the excerpts. Cite relevant statements using [1], [2], and so on. If the excerpts do not support an answer, say exactly: Insufficient evidence in this collection." },
        { role: "user", content: `Question: ${question}\n\nApproved source excerpts:\n${sourcePacket}\n\nWrite no more than 130 words.` },
      ],
    });
    const content = response.choices[0]?.message.content;
    return typeof content === "string" ? content : undefined;
  });
}

export async function answerFromProject(userId: number, projectId: number, question: string, useOptionalSynthesis = true) {
  const db = await getDb();
  if (!db) throw new Error("The private data store is not available yet.");
  const project = await getProject(userId, projectId);
  if (!project) throw new Error("Project not found.");
  const terms = queryTerms(question);
  if (!terms.length) throw new Error("Ask a more specific question using at least one meaningful term.");
  const predicates = terms.map((term) => or(like(passages.text, `%${term}%`), like(collectionPages.pageTitle, `%${term}%`)));
  const rows = await db
    .select({
      passageId: passages.id,
      passageText: passages.text,
      headingPath: passages.headingPath,
      anchor: passages.anchor,
      pageTitle: collectionPages.pageTitle,
      url: collectionPages.canonicalUrl,
      officialCitationMetadata: collectionPages.officialCitationMetadata,
    })
    .from(passages)
    .innerJoin(collectionPages, eq(passages.pageId, collectionPages.id))
    .innerJoin(collections, eq(passages.collectionId, collections.id))
    .where(and(eq(collections.userId, userId), eq(collections.projectId, project.id), ne(collectionPages.sourceStatus, "retired"), or(...predicates)))
    .limit(80);
  const evidence = buildEvidenceResponse({ collection: project.name, answerMode: "extractive", question, rows });
  if (evidence.status !== "evidence" || !useOptionalSynthesis) return evidence;
  const sourcePacket = evidence.citations.map((citation, index) => `Source ${index + 1}: ${citation.title}\n${citation.excerpt}`).join("\n\n");
  return applyOptionalSynthesis(evidence, true, async () => {
    const response = await invokeLLM({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: "Write a concise, natural-language answer using only the approved excerpts. Be direct when the excerpts support a conclusion and state when they do not. Do not invent facts, fill gaps, resolve contradictions, or mention hidden metadata. Do not output JSON, arrays, bullet lists, citation markers, or bracketed source labels; Cairn displays the inspectable citations separately. Write 2–4 short paragraphs, no more than 130 words." },
        { role: "user", content: `Question: ${question}\n\nApproved excerpts:\n${sourcePacket}` },
      ],
    });
    return readableModelAnswer(response.choices[0]?.message.content) ?? undefined;
  });
}
