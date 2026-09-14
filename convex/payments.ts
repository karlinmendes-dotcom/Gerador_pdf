import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
