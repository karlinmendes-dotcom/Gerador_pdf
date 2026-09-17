import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Configuração lida das Environment Variables do Convex Dashboard:
 *  - MAX_DOCUMENTS_PER_USER → limite de documentos por usuário (padrão 200)
 */
function maxDocumentsPerUser(): number {
  const n = Number(process.env.MAX_DOCUMENTS_PER_USER ?? 200);
  return Number.isFinite(n) && n > 0 ? n : 200;
}

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
  handler: async (ctx, args) => {
    // Limite por usuário configurável no Convex Dashboard.
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    if (existing.length >= maxDocumentsPerUser()) {
      throw new Error(`Limite de ${maxDocumentsPerUser()} documentos atingido. Exclua antigos para criar novos.`);
    }

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
    paymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const fields: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.dataJson !== undefined) fields.dataJson = updates.dataJson;
    if (updates.title !== undefined) fields.title = updates.title;
    if (updates.pdfUrl !== undefined) fields.pdfUrl = updates.pdfUrl;
    if (updates.status !== undefined) fields.status = updates.status;
    if (updates.paymentId !== undefined) fields.paymentId = updates.paymentId;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    // Remove também as parcelas vinculadas (Livro de Recibos).
    const linked = await ctx.db
      .query("receipts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.id))
      .collect();
    for (const r of linked) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.id);
    return { deleted: true as const, receiptsDeleted: linked.length };
  },
});
