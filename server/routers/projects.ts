import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { answerFromProject, bootstrapCaliforniaFamilyCodeExpert, bootstrapCongressGovExpert, createProject, listProjects } from "../knowledgeDb";
import { converseWithProject } from "../cairnAgent";
import { protectedProcedure, router } from "../_core/trpc";

const projectInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(220).default(""),
});

const conversationMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listProjects(ctx.user.id)),
  create: protectedProcedure.input(projectInput).mutation(async ({ ctx, input }) => {
    try {
      return { projectId: await createProject({ ...input, userId: ctx.user.id }) };
    } catch (cause) {
      throw new TRPCError({ code: "BAD_REQUEST", message: cause instanceof Error ? cause.message : "Cairn could not create that project." });
    }
  }),
  bootstrapCaliforniaFamilyCode: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await bootstrapCaliforniaFamilyCodeExpert(ctx.user.id);
    } catch (cause) {
      throw new TRPCError({ code: "BAD_REQUEST", message: cause instanceof Error ? cause.message : "Cairn could not prepare the California Family Code expert." });
    }
  }),
  bootstrapCongressGov: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await bootstrapCongressGovExpert(ctx.user.id);
    } catch (cause) {
      throw new TRPCError({ code: "BAD_REQUEST", message: cause instanceof Error ? cause.message : "Cairn could not prepare the Congress.gov expert." });
    }
  }),
  answer: protectedProcedure.input(z.object({
    projectId: z.number().int().positive(),
    question: z.string().trim().min(4).max(600),
    history: z.array(conversationMessage).max(10).default([]),
  })).mutation(async ({ ctx, input }) => {
    try {
      return await converseWithProject({ userId: ctx.user.id, projectId: input.projectId, question: input.question, history: input.history });
    } catch (cause) {
      throw new TRPCError({ code: "BAD_REQUEST", message: cause instanceof Error ? cause.message : "Cairn could not complete that conversation." });
    }
  }),
  evidence: protectedProcedure.input(z.object({
    projectId: z.number().int().positive(),
    question: z.string().trim().min(4).max(600),
  })).mutation(async ({ ctx, input }) => {
    try {
      return await answerFromProject(ctx.user.id, input.projectId, input.question, false);
    } catch (cause) {
      throw new TRPCError({ code: "BAD_REQUEST", message: cause instanceof Error ? cause.message : "Cairn could not retrieve that evidence." });
    }
  }),
});
