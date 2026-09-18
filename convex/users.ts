import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Senhas: hash FNV-1a com **pepper do Convex Dashboard**
 * (Deployment Settings → Environment Variables):
 *
 *  - PASSWORD_PEPPER  → segredo somado ao hash (obrigatório em produção)
 *  - MIN_PASSWORD_LEN → política mínima (padrão 6)
 *
 * Sem PASSWORD_PEPPER o hash usa apenas o domínio local (modo dev).
 * Para produção forte, migre para argon2/bcrypt via ação "use node".
 */
function pepper(): string {
  return process.env.PASSWORD_PEPPER ?? "pdfforge-local-dev-pepper";
}

function minPasswordLen(): number {
  const n = Number(process.env.MIN_PASSWORD_LEN ?? 6);
  return Number.isFinite(n) && n >= 4 ? n : 6;
}

function hash(email: string, password: string): string {
  let h = 0x811c9dc5;
  const input = `${email.trim().toLowerCase()}:${password}:${pepper()}`;
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

/** Perfil público por e-mail (dropdown do header / dados reais do usuário). */
export const getByEmail = query({
  args: { email: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim().toLowerCase()))
      .first(),
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

/**
 * Client ID público do Google OAuth (Convex Dashboard → GOOGLE_CLIENT_ID).
 * Valor público por natureza — exposto ao frontend para renderizar o botão.
 * Sem a variável cadastrada, retorna null e o frontend oculta o botão.
 */
export const googleClientId = query({
  args: {},
  handler: async () => ({ clientId: process.env.GOOGLE_CLIENT_ID ?? null }),
});

/** Cria ou vincula a conta Google pelo e-mail (login social). */
export const googleUpsert = mutation({
  args: { externalId: v.string(), email: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    // 1) Já existe conta Google (login recorrente)
    const googleAccount = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .first();
    if (googleAccount) return googleAccount._id;

    // 2) E-mail já cadastrado via senha → vincula o Google à mesma conta
    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (byEmail) return byEmail._id;

    // 3) Primeira entrada via Google
    return ctx.db.insert("users", {
      externalId: args.externalId,
      email,
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
    if (args.password.length < minPasswordLen()) {
      throw new Error(`A senha precisa de no mínimo ${minPasswordLen()} caracteres.`);
    }
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
