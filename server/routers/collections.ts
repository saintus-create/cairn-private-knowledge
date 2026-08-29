import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { answerFromCollection, createCollection, ensureDefaultProject, getCollection, getLatestImportBatch, getLatestSourceArchive, importUploadedDocument, listCollections, listPageSnapshots, listPages, refreshCollection, runNextImportBatch, startImport, updateProfile } from "../knowledgeDb";
import { converseWithCairn } from "../agent/cairnConversation";
import { assertPublicWebsiteUrl, previewWebsiteScope } from "../websiteSafety";
import { protectedProcedure, router } from "../_core/trpc";

const collectionInput = z.object({
  name: z.string().trim().min(2).max(80),
  rootUrl: z.string().trim().url().max(1024),
  scope: z.string().trim().min(2).max(220),
  audience: z.string().trim().min(2).max(120),
  tone: z.string().trim().min(2).max(120),
  answerMode: z.enum(["extractive", "source-backed", "labeled-synthesis"]),
  includePaths: z.string().max(1000).default("/"),
  excludePaths: z.string().max(1000).default(""),
  pageLimit: z.number().int().min(1).max(50),
});

const conversationHistory = z.array(z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8_000),
})).max(12).default([]);

function error(message: string) {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

export const collectionsRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listCollections(ctx.user.id, input?.projectId)),
  get: protectedProcedure.input(z.object({ collectionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const collection = await getCollection(ctx.user.id, input.collectionId);
    if (!collection) throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found." });
    const [pages, batch, sourceArchive] = await Promise.all([
      listPages(ctx.user.id, input.collectionId),
      getLatestImportBatch(ctx.user.id, input.collectionId),
      getLatestSourceArchive(ctx.user.id, input.collectionId),
    ]);
    return { collection, pages, batch, sourceArchive };
  }),
  history: protectedProcedure
    .input(z.object({ collectionId: z.number().int().positive(), pageId: z.number().int().positive() }))
    .query(({ ctx, input }) => listPageSnapshots(ctx.user.id, input.collectionId, input.pageId)),
  preview: protectedProcedure
    .input(collectionInput.pick({ rootUrl: true, includePaths: true, excludePaths: true, pageLimit: true }))
    .mutation(async ({ input }) => {
      try {
        return await previewWebsiteScope({ seedUrl: input.rootUrl, includePaths: input.includePaths, excludePaths: input.excludePaths, pageLimit: input.pageLimit });
      } catch (cause) {
        throw error(cause instanceof Error ? cause.message : "The website scope could not be previewed.");
      }
    }),
  create: protectedProcedure.input(collectionInput.extend({ projectId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    try {
      const url = await assertPublicWebsiteUrl(input.rootUrl);
      const { projectId, ...collection } = input;
      const project = projectId ? { id: projectId } : await ensureDefaultProject(ctx.user.id);
      return { collectionId: await createCollection({ ...collection, projectId: project.id, rootUrl: url.toString(), userId: ctx.user.id }) };
    } catch (cause) {
      throw error(cause instanceof Error ? cause.message : "The collection could not be created.");
    }
  }),
  uploadDocument: protectedProcedure.input(z.object({
    projectId: z.number().int().positive().optional(),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().max(120),
    base64: z.string().min(4).max(28_000_000),
  })).mutation(async ({ ctx, input }) => {
    try {
      const { projectId, ...document } = input;
      const project = projectId ? { id: projectId } : await ensureDefaultProject(ctx.user.id);
      return await importUploadedDocument({ ...document, projectId: project.id, userId: ctx.user.id });
    } catch (cause) {
      throw error(cause instanceof Error ? cause.message : "The document could not be imported.");
    }
  }),
  updateProfile: protectedProcedure
    .input(z.object({ collectionId: z.number().int().positive(), profile: collectionInput.omit({ rootUrl: true }).partial().extend({ aiSynthesisEnabled: z.boolean().optional() }) }))
    .mutation(async ({ ctx, input }) => updateProfile(ctx.user.id, input.collectionId, input.profile)),
  startImport: protectedProcedure
    .input(z.object({ collectionId: z.number().int().positive(), urls: z.array(z.string().url()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await startImport(ctx.user.id, input.collectionId, input.urls);
      } catch (cause) {
        throw error(cause instanceof Error ? cause.message : "The import could not be started.");
      }
    }),
  continueImport: protectedProcedure
    .input(z.object({ batchId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await runNextImportBatch(ctx.user.id, input.batchId);
      } catch (cause) {
        throw error(cause instanceof Error ? cause.message : "The import batch could not continue.");
      }
    }),
  refresh: protectedProcedure
    .input(z.object({ collectionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await refreshCollection(ctx.user.id, input.collectionId);
      } catch (cause) {
        throw error(cause instanceof Error ? cause.message : "The collection could not be refreshed.");
      }
    }),
  answer: protectedProcedure
    .input(z.object({
      collectionId: z.number().int().positive(),
      question: z.string().trim().min(4).max(600),
      useOptionalSynthesis: z.boolean().default(false),
      history: conversationHistory,
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!input.useOptionalSynthesis) {
          return await answerFromCollection(ctx.user.id, input.collectionId, input.question, false);
        }

        return await converseWithCairn({
          userId: ctx.user.id,
          collectionId: input.collectionId,
          question: input.question,
          history: input.history,
          synthesize: true,
        });
      } catch (cause) {
        throw error(cause instanceof Error ? cause.message : "The collection could not answer that question.");
      }
    }),
});
