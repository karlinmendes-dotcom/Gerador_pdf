import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * POST /api/webhooks/mercadopago
 * Receives Mercado Pago payment notifications (payment.created / payment.updated).
 *
 * Flow: validate x-signature (when MERCADOPAGO_WEBHOOK_SECRET is set) →
 * fetch the payment from the MP API → when status === "approved", mark the
 * document as paid in Convex via payments:markPaidByPaymentId, using
 * external_reference as a fallback lookup.
 *
 * Always ACKs with 200 so Mercado Pago stops retrying.
 */

interface WebhookBody {
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

async function markDocumentPaid(paymentId: string, externalReference?: string): Promise<boolean> {
  const convexUrl =
    process.env.VITE_CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  if (!convexUrl) return false;

  try {
    const res = await fetch(`${convexUrl}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "payments:markPaidByPaymentId",
        args: { paymentId, externalReference },
      }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "success";
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    // ─── Signature validation ───────────────────────────────────────
    if (secret) {
      const signature = (req.headers["x-signature"] as string) ?? "";
      const requestId = (req.headers["x-request-id"] as string) ?? "";
      const dataId =
        (req.query["data.id"] as string) ??
        (req.query.id as string) ??
        ((req.body as WebhookBody | undefined)?.data?.id?.toString() ?? "");

      if (!signature || !dataId) {
        return res.status(401).json({ error: "Assinatura ausente" });
      }

      const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
        const [k, v] = part.split("=");
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const timestamp = parts["ts"] ?? "";
      const hash = parts["v1"] ?? "";

      const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
      const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

      if (hmac !== hash) {
        return res.status(401).json({ error: "Assinatura inválida" });
      }
    }

    // ─── Process notification ───────────────────────────────────────
    const body = req.body as WebhookBody;
    const paymentId = body.data?.id;

    if (body.type === "payment" && paymentId) {
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!accessToken) {
        // ACK even if unconfigured so MP stops retrying
        return res.status(200).json({ received: true, note: "token ausente" });
      }

      const { MercadoPagoConfig, Payment } = await import("mercadopago");
      const client = new MercadoPagoConfig({ accessToken });
      const payment = new Payment(client);

      const result = await payment.get({ id: Number(paymentId) });
      const status = result.status;
      const externalReference = result.external_reference;

      if (status === "approved") {
        const ok = await markDocumentPaid(String(result.id), externalReference);
        return res.status(200).json({ received: true, id: result.id, status, documentUpdated: ok });
      }

      return res.status(200).json({ received: true, id: result.id, status });
    }

    return res.status(200).json({ received: true });
  } catch {
    // Always ACK to prevent webhook retry storms
    return res.status(200).json({ received: true });
  }
}
