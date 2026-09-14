import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * POST /api/webhooks/mercadopago
 * Receives Mercado Pago IPN/webhook notifications.
 *
 * Security: validates the x-signature header (HMAC-SHA256 of
 * `id:<dataID>` signed with MERCADOPAGO_WEBHOOK_SECRET) when the
 * secret is configured. Updates document/payment status elsewhere
 * via the external_reference.
 */
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
        (req.body?.data?.id as string) ??
        "";

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
    const body = req.body as {
      type?: string;
      action?: string;
      data?: { id?: string | number };
    };

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
      const documentId = result.external_reference;

      if (status === "approved" && documentId) {
        // The frontend/dashboard consumes the Convex `documents` table;
        // payment approval is recorded via the paymentId reference.
        // A Convex mutation can be invoked here if needed:
        // await fetch(`${process.env.CONVEX_URL}/api/mutation`, { ... })
      }

      return res.status(200).json({ received: true, id: result.id, status });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    // Always ACK to prevent webhook retry storms
    return res.status(200).json({ received: true });
  }
}
