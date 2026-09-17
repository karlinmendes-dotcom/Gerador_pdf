import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Registra a criação da cobrança PIX no checkout (tabela `payments`).
 * O status inicial vem do provedor (Mercado Pago) e é atualizado pelo
 * webhook quando o pagamento é aprovado.
 */
export const recordCheckout = mutation({
  args: {
    paymentId: v.string(),
    documentId: v.optional(v.string()),
    userId: v.optional(v.string()),
    amount: v.number(),
    currency: v.optional(v.string()),
    status: v.string(),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // documentId/userId podem ser IDs locais (modo draft) — só convertemos
    // quando o formato bate com um ID real do Convex.
    const asId = <T extends string>(raw: string | undefined): T | undefined =>
      raw && /^[a-z0-9]{20,40}$/.test(raw) ? (raw as T) : undefined;

    const docId = asId<import("./_generated/dataModel").Id<"documents">>(args.documentId);
    const userId = asId<import("./_generated/dataModel").Id<"users">>(args.userId);

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", args.paymentId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { status: args.status, updatedAt: now });
      return existing._id;
    }

    return ctx.db.insert("payments", {
      paymentId: args.paymentId,
      documentId: docId,
      userId,
      amount: args.amount,
      currency: args.currency ?? "BRL",
      status: args.status,
      provider: args.provider ?? "mercadopago",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Called by the Mercado Pago webhook (api/webhooks/mercadopago.ts) when a PIX
 * payment transitions to "approved". Idempotent: marking an already-paid
 * document simply re-patches it with the same values.
 */
export const markPaidByPaymentId = mutation({
  args: {
    paymentId: v.string(),
    externalReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Preferred lookup: paymentId index (documents synced to Convex carry it)
    const doc = await ctx.db
      .query("documents")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", args.paymentId))
      .first();

    if (doc) {
      if (doc.status === "paid") {
        return { updated: true as const, reason: "already_paid" };
      }
      await ctx.db.patch(doc._id, {
        status: "paid",
        updatedAt: now,
      });
      // Log da transação aprovada na tabela payments.
      const paymentLog = await ctx.db
        .query("payments")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", args.paymentId))
        .first();
      if (paymentLog) {
        await ctx.db.patch(paymentLog._id, { status: "approved", updatedAt: now });
      } else {
        await ctx.db.insert("payments", {
          paymentId: args.paymentId,
          documentId: doc._id,
          userId: doc.userId,
          amount: 0,
          currency: "BRL",
          status: "approved",
          provider: "mercadopago",
          createdAt: now,
          updatedAt: now,
        });
      }
      return { updated: true as const, reason: "marked_paid" };
    }

    // 2. Fallback: the checkout may pass a Convex document id in
    //    external_reference. Local draft IDs (doc_*) are not valid Convex
    //    IDs, so guard the get() call.
    if (args.externalReference && /^[a-z0-9]{20,40}$/.test(args.externalReference)) {
      const refDoc = await ctx.db.get(
        args.externalReference as import("./_generated/dataModel").Id<"documents">
      );
      if (refDoc) {
        if (refDoc.status === "paid") {
          return { updated: true as const, reason: "already_paid" };
        }
        await ctx.db.patch(refDoc._id, {
          status: "paid",
          paymentId: args.paymentId,
          updatedAt: now,
        });
        return { updated: true as const, reason: "marked_paid" };
      }
    }

    return { updated: false as const, reason: "document_not_found" };
  },
});
