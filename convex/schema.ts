import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    externalId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"]),

  documents: defineTable({
    userId: v.id("users"),
    documentType: v.string(),
    title: v.string(),
    dataJson: v.string(),
    pdfUrl: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("paid")),
    paymentId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_type", ["userId", "documentType"])
    .index("by_paymentId", ["paymentId"]),

  /** Galeria hospedada gerada pelo Módulo Gerador de QR Code. */
  qrGalleries: defineTable({
    /** Chave curta usada na URL pública /g/:key. */
    key: v.string(),
    userId: v.optional(v.id("users")),
    title: v.string(),
    /** IDs de _storage do Convex; vazio no modo draft (data URLs no cliente). */
    fileIds: v.array(v.id("_storage")),
    /** Metadados por item: nome, mime e tamanho. */
    items: v.array(
      v.object({
        fileId: v.string(),
        name: v.string(),
        mime: v.string(),
        size: v.number(),
      })
    ),
    views: v.number(),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_userId", ["userId"]),

  receipts: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    installmentNumber: v.number(),
    amount: v.number(),
    dueDate: v.string(),
    paidDate: v.optional(v.string()),
    receiptFileId: v.optional(v.id("_storage")),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("overdue")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_documentId_and_number", ["documentId", "installmentNumber"])
    .index("by_userId", ["userId"]),
});
