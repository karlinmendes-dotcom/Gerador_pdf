import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Galeria pública hospedada pelo Gerador de QR Code.
 * O cliente envia os arquivos via Convex Storage (uploadUrl/generateUploadUrl)
 * e registra aqui os metadados; a chave curta aponta para /g/:key.
 */

function shortKey(): string {
  // 10 chars URL-safe (62^10 ≈ 8.4e17 combinações).
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Devolve a URL de upload para o cliente enviar o arquivo ao Convex Storage. */
export const requestUploadUrl = mutation({
  args: {},
  handler: (ctx) => ctx.storage.generateUploadUrl(),
});

/** Busca a galeria pelo id interno (usado logo após o create). */
export const getById = query({
  args: { id: v.id("qrGalleries") },
  handler: (ctx, args) => ctx.db.get(args.id),
});

/** Dados públicos da galeria (sem userId). */
export const getByKey = query({
  args: { key: v.string() },
  handler: (ctx, args) =>
    ctx.db.query("qrGalleries").withIndex("by_key", (q) => q.eq("key", args.key)).first(),
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: (ctx, args) =>
    ctx.db
      .query("qrGalleries")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect(),
});

export const create = mutation({
  args: {
    userId: v.optional(v.id("users")),
    title: v.string(),
    fileIds: v.array(v.id("_storage")),
    items: v.array(
      v.object({
        fileId: v.string(),
        name: v.string(),
        mime: v.string(),
        size: v.number(),
      })
    ),
  },
  handler: (ctx, args) =>
    ctx.db.insert("qrGalleries", {
      key: shortKey(),
      userId: args.userId,
      title: args.title.slice(0, 120) || "Galeria PDFForge",
      fileIds: args.fileIds,
      items: args.items.slice(0, 30),
      views: 0,
      createdAt: Date.now(),
    }),
});

/** Incrementa o contador de visitas ao abrir /g/:key. */
export const incrementViews = mutation({
  args: { id: v.id("qrGalleries") },
  handler: async (ctx, args) => {
    const g = await ctx.db.get(args.id);
    if (!g) return 0;
    const views = g.views + 1;
    await ctx.db.patch(args.id, { views });
    return views;
  },
});

export const remove = mutation({
  args: { id: v.id("qrGalleries") },
  handler: (ctx, args) => ctx.db.delete(args.id),
});
