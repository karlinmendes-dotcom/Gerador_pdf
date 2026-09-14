import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByDocument = query({
  args: { documentId: v.id("documents") },
  handler: (ctx, args) =>
    ctx.db
      .query("receipts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect(),
});

export const create = mutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    installmentNumber: v.number(),
    amount: v.number(),
    dueDate: v.string(),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("overdue")),
  },
  handler: (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("receipts", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    id: v.id("receipts"),
    paidDate: v.optional(v.string()),
    receiptFileId: v.optional(v.id("_storage")),
    status: v.optional(v.union(v.literal("pending"), v.literal("paid"), v.literal("overdue"))),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const fields: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.paidDate !== undefined) fields.paidDate = updates.paidDate;
    if (updates.receiptFileId !== undefined) fields.receiptFileId = updates.receiptFileId;
    if (updates.status !== undefined) fields.status = updates.status;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("receipts") },
  handler: (ctx, args) => ctx.db.delete(args.id),
});
