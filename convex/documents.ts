import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: (ctx, args) =>
    ctx.db.query("documents").withIndex("by_userId", (q) => q.eq("userId", args.userId)).order("desc").collect(),
});

export const get = query({
  args: { id: v.id("documents") },
  handler: (ctx, args) => ctx.db.get(args.id),
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    documentType: v.string(),
    title: v.string(),
    dataJson: v.string(),
    pdfUrl: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("paid")),
  },
  handler: (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("documents", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    id: v.id("documents"),
    dataJson: v.optional(v.string()),
    title: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("paid"))),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const fields: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.dataJson !== undefined) fields.dataJson = updates.dataJson;
    if (updates.title !== undefined) fields.title = updates.title;
    if (updates.pdfUrl !== undefined) fields.pdfUrl = updates.pdfUrl;
    if (updates.status !== undefined) fields.status = updates.status;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: (ctx, args) => ctx.db.delete(args.id),
});
