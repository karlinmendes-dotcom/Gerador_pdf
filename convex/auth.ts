"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Autenticação de sessão com variáveis do Convex Dashboard
 * (Deployment Settings → Environment Variables):
 *
 *  - JWT_SECRET            → segredo HMAC das sessões (obrigatório em produção)
 *  - SITE_URL              → URL pública da plataforma (aud/iss do token)
 *  - SESSION_TTL_SECONDS   → validade da sessão (padrão: 7 dias)
 *
 * Nenhum valor default sensível: sem JWT_SECRET cadastrada, as ações
 * falham com mensagem explícita em vez de emitir tokens inseguros.
 */

interface SessionPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
  iss: string;
}

function requireSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET não configurada no Convex Dashboard (Deployment Settings → Environment Variables)."
    );
  }
  return secret;
}

function siteUrl(): string {
  return process.env.SITE_URL ?? "https://pdfforge.app";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(data).digest());
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Emite um token de sessão HMAC-SHA256 para o usuário autenticado. */
export const issueSessionToken = action({
  args: { userId: v.string(), email: v.string() },
  handler: async (_ctx, args) => {
    const secret = requireSecret();
    const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 7 * 24 * 3600);
    const now = Math.floor(Date.now() / 1000);

    const payload: SessionPayload = {
      sub: args.userId,
      email: args.email,
      iat: now,
      exp: now + (Number.isFinite(ttl) ? Math.max(ttl, 300) : 7 * 24 * 3600),
      iss: siteUrl(),
    };

    const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = b64url(JSON.stringify(payload));
    const token = `${header}.${body}.${sign(`${header}.${body}`, secret)}`;

    return { token, expiresAt: payload.exp * 1000, issuer: payload.iss };
  },
});

/** Verifica um token de sessão (assinatura + expiração + issuer). */
export const verifySessionToken = action({
  args: { token: v.string() },
  handler: async (_ctx, args) => {
    const secret = requireSecret();
    const parts = args.token.split(".");
    if (parts.length !== 3) return { valid: false as const, reason: "malformed" };

    const [header, body, signature] = parts;
    if (!safeEqual(sign(`${header}.${body}`, secret), signature)) {
      return { valid: false as const, reason: "bad_signature" };
    }

    try {
      const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as SessionPayload;
      if (payload.iss !== siteUrl()) return { valid: false as const, reason: "bad_issuer" };
      if (payload.exp * 1000 < Date.now()) return { valid: false as const, reason: "expired" };
      return { valid: true as const, userId: payload.sub, email: payload.email };
    } catch {
      return { valid: false as const, reason: "bad_payload" };
    }
  },
});

// ─── Login com Google (OAuth ID token) ──────────────────────────────

interface GoogleTokenInfo {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  exp?: string;
}

/**
 * Verifica o ID token do Google server-side (tokeninfo), valida aud/iss/exp
 * e cria ou vincula a conta pelo e-mail. Retorna os dados da sessão.
 */
export const googleSignIn = action({
  args: { credential: v.string() },
  handler: async (ctx, args) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("GOOGLE_CLIENT_ID não configurada no Convex Dashboard (Deployment Settings → Environment Variables).");
    }

    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(args.credential)}`
    );
    if (!res.ok) throw new Error("Token do Google inválido.");
    const info = (await res.json()) as GoogleTokenInfo;

    if (info.aud !== clientId) throw new Error("Token emitido para outro aplicativo.");
    if (info.iss !== "accounts.google.com" && info.iss !== "https://accounts.google.com") {
      throw new Error("Emissor do token inválido.");
    }
    if (info.email_verified !== "true" && info.email_verified !== true) {
      throw new Error("O e-mail da conta Google não está verificado.");
    }
    if (!info.sub || !info.email) throw new Error("Token incompleto.");
    if (Number(info.exp) * 1000 < Date.now()) throw new Error("Token expirado.");

    const email = info.email.trim().toLowerCase();
    const userId = await ctx.runMutation(api.users.googleUpsert, {
      externalId: `google_${info.sub}`,
      email,
      name: info.name,
    });

    return { userId, email, name: info.name ?? email.split("@")[0] };
  },
});

/** Validação de webhook Mercado Pago com MERCADOPAGO_WEBHOOK_SECRET (dashboard). */
export const verifyWebhookSignature = action({
  args: { dataId: v.string(), requestId: v.string(), signature: v.string() },
  handler: async (_ctx, args) => {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return { configured: false as const, valid: false as const };

    // Formato MP: "ts=<ts>,v1=<mac>"
    const parts = Object.fromEntries(
      args.signature.split(",").map((p) => p.trim().split("=") as [string, string])
    );
    if (!parts.ts || !parts.v1) return { configured: true as const, valid: false as const };

    const manifest = `id:${args.dataId};request-id:${args.requestId};ts:${parts.ts};`;
    const expected = createHmac("sha256", secret).update(manifest).digest("hex");
    return { configured: true as const, valid: safeEqual(expected, parts.v1) };
  },
});
