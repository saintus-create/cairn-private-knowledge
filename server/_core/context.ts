import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";
import { getVerifiedSupabaseOwnerEmail } from "../supabaseAuth";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  if (ENV.singleOwnerMode) {
    await upsertUser({ openId: ENV.singleOwnerOpenId, name: "Cairn owner", role: "admin" });
    user = (await getUserByOpenId(ENV.singleOwnerOpenId)) ?? null;
  }

  const supabaseOwnerEmail = await getVerifiedSupabaseOwnerEmail(opts.req.headers.authorization);
  if (!user && supabaseOwnerEmail && ENV.ownerOpenId) {
    user = (await getUserByOpenId(ENV.ownerOpenId)) ?? null;
  }

  try {
    user = user ?? (await sdk.authenticateRequest(opts.req));
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
