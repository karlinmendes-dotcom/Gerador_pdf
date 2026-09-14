import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: (ctx, args) =>
    ctx.db.query("users").withIndex("by_externalId", (q) => q.eq("externalId", args.externalId)).first(),
});

export const getOrCreate = mutation({
  args: { externalId: v.string(), email: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .first();
    if (existing) return existing._id;

    return ctx.db.insert("users", {
      externalId: args.externalId,
      email: args.email,
      name: args.name,
      createdAt: Date.now(),
    });
  },
});
