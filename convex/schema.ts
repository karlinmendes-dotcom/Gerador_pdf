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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_type", ["userId", "documentType"]),

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
    .index("by_documentId_and_number", ["documentId", "installmentNumber"]),
});
