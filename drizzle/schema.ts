import { boolean, index, int, json, longtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  description: varchar("description", { length: 220 }).notNull().default(""),
  projectKind: mysqlEnum("projectKind", ["general", "primary_law"]).notNull().default("general"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("projects_user_idx").on(table.userId),
  uniqueIndex("projects_user_name_unique").on(table.userId, table.name),
]);

export const collections = mysqlTable("collections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  rootUrl: varchar("rootUrl", { length: 1024 }).notNull(),
  scope: text("scope").notNull(),
  audience: varchar("audience", { length: 120 }).notNull(),
  tone: varchar("tone", { length: 120 }).notNull(),
  answerMode: mysqlEnum("answerMode", ["extractive", "source-backed", "labeled-synthesis"]).notNull().default("extractive"),
  aiSynthesisEnabled: boolean("aiSynthesisEnabled").notNull().default(false),
  sourceAuthority: mysqlEnum("sourceAuthority", ["general", "official_primary", "official_procedural", "user_reference"]).notNull().default("general"),
  publisher: varchar("publisher", { length: 180 }).notNull().default(""),
  sourceMapUrl: varchar("sourceMapUrl", { length: 1024 }),
  includePaths: text("includePaths").notNull(),
  excludePaths: text("excludePaths").notNull(),
  pageLimit: int("pageLimit").notNull().default(20),
  importStatus: mysqlEnum("importStatus", ["idle", "importing", "ready", "attention"]).notNull().default("idle"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("collections_user_idx").on(table.userId), index("collections_project_idx").on(table.projectId)]);

export const importBatches = mysqlTable("import_batches", {
  id: int("id").autoincrement().primaryKey(),
  collectionId: int("collectionId").notNull(),
  status: mysqlEnum("status", ["running", "paused", "complete", "failed"]).notNull().default("running"),
  requestedCount: int("requestedCount").notNull(),
  processedCount: int("processedCount").notNull().default(0),
  unchangedCount: int("unchangedCount").notNull().default(0),
  failedCount: int("failedCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => [index("import_batches_collection_idx").on(table.collectionId)]);

export const sourceArchives = mysqlTable("source_archives", {
  id: int("id").autoincrement().primaryKey(),
  collectionId: int("collectionId").notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  archiveSha256: varchar("archiveSha256", { length: 64 }).notNull(),
  observedEtag: varchar("observedEtag", { length: 128 }),
  observedLastModified: timestamp("observedLastModified"),
  acquiredAt: timestamp("acquiredAt").notNull(),
  recordCount: int("recordCount").notNull(),
  sourceFileStorageKey: varchar("sourceFileStorageKey", { length: 1024 }),
  sourceFileStorageUrl: varchar("sourceFileStorageUrl", { length: 1024 }),
  sourceFileSha256: varchar("sourceFileSha256", { length: 64 }),
  sourceFileBytes: int("sourceFileBytes"),
  extractStorageKey: varchar("extractStorageKey", { length: 1024 }).notNull(),
  extractStorageUrl: varchar("extractStorageUrl", { length: 1024 }).notNull(),
  extractSha256: varchar("extractSha256", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("source_archives_collection_idx").on(table.collectionId),
  uniqueIndex("source_archives_collection_hash_unique").on(table.collectionId, table.archiveSha256),
]);

export const collectionPages = mysqlTable("collection_pages", {
  id: int("id").autoincrement().primaryKey(),
  collectionId: int("collectionId").notNull(),
  importBatchId: int("importBatchId"),
  canonicalUrl: varchar("canonicalUrl", { length: 1024 }).notNull(),
  officialRecordKey: varchar("officialRecordKey", { length: 255 }),
  officialTextSha256: varchar("officialTextSha256", { length: 64 }),
  officialCitationMetadata: json("officialCitationMetadata"),
  pageTitle: text("pageTitle").notNull(),
  headings: json("headings").notNull(),
  cleanText: longtext("cleanText"),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  sourceStatus: mysqlEnum("sourceStatus", ["queued", "ready", "unchanged", "failed", "skipped", "retired"]).notNull().default("queued"),
  importError: text("importError"),
  fetchedAt: timestamp("fetchedAt"),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("collection_page_url_unique").on(table.collectionId, table.canonicalUrl),
  uniqueIndex("collection_page_official_record_unique").on(table.collectionId, table.officialRecordKey),
  index("collection_pages_batch_idx").on(table.importBatchId),
]);

export const passages = mysqlTable("passages", {
  id: int("id").autoincrement().primaryKey(),
  collectionId: int("collectionId").notNull(),
  pageId: int("pageId").notNull(),
  position: int("position").notNull(),
  headingPath: text("headingPath").notNull(),
  anchor: varchar("anchor", { length: 180 }).notNull(),
  text: longtext("text").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("passages_collection_idx").on(table.collectionId), index("passages_page_idx").on(table.pageId)]);

export const pageSnapshots = mysqlTable("page_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  pageId: int("pageId").notNull(),
  importBatchId: int("importBatchId"),
  sourceArchiveId: int("sourceArchiveId"),
  version: int("version").notNull(),
  pageTitle: text("pageTitle").notNull(),
  headings: json("headings").notNull(),
  officialCitationMetadata: json("officialCitationMetadata"),
  cleanText: longtext("cleanText").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  fetchedAt: timestamp("fetchedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("page_snapshot_version_unique").on(table.pageId, table.version),
  index("page_snapshots_page_idx").on(table.pageId),
  index("page_snapshots_batch_idx").on(table.importBatchId),
  index("page_snapshots_archive_idx").on(table.sourceArchiveId),
]);

export const uploadedDocuments = mysqlTable("uploaded_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  collectionId: int("collectionId").notNull(),
  pageId: int("pageId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  byteSize: int("byteSize").notNull(),
  storageKey: varchar("storageKey", { length: 1024 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  status: mysqlEnum("status", ["processing", "ready", "failed"]).notNull().default("processing"),
  importError: text("importError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uploaded_documents_storage_key_unique").on(table.storageKey),
  index("uploaded_documents_user_idx").on(table.userId),
  index("uploaded_documents_collection_idx").on(table.collectionId),
]);
