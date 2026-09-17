"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
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
