import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Senhas: hash simples (não-criptográfico) para não depender de libs nativas
 * no runtime do Convex. Em produção recomenda-se Convex Auth (bcrypt/argon2
 * via "use node") antes de expor publicamente.
 */
function hash(email: string, password: string): string {
  let h = 0x811c9dc5;
  const input = `${email.trim().toLowerCase()}:${password}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

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

/** Cadastro (freemium). Retorna o userId para o cliente salvar na sessão. */
export const signUp = mutation({
  args: { email: v.string(), name: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) throw new Error("Este e-mail já está cadastrado. Faça login.");

    return ctx.db.insert("users", {
      externalId: `auth_${email}`,
      email,
      name: args.name.trim(),
      passwordHash: hash(email, args.password),
      createdAt: Date.now(),
    });
  },
});

/** Login. Retorna o userId quando as credenciais batem. */
export const signIn = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user || user.passwordHash !== hash(email, args.password)) {
      throw new Error("E-mail ou senha inválidos.");
    }
    return user._id;
  },
});
