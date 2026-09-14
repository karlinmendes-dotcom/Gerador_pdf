import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/checkout
 * Creates a Mercado Pago PIX payment and returns the QR code +
 * "Pix Copia e Cola" string for the checkout screen.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return res.status(500).json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" });
    }

    const { documentId, amount, title } = req.body as {
      documentId?: string;
      amount?: number;
      title?: string;
    };

    if (!documentId || !amount || !title) {
      return res.status(400).json({ error: "documentId, amount e title são obrigatórios" });
    }

    const { MercadoPagoConfig, Payment } = await import("mercadopago");
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pdfforge-brasil.vercel.app";

    const result = await payment.create({
      body: {
        transaction_amount: Number(amount.toFixed(2)),
        description: `PDFForge Brasil — ${title}`.slice(0, 256),
        payment_method_id: "pix",
        external_reference: documentId,
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
      },
    });

    const txData = (result.point_of_interaction as any)?.transaction_data ?? {};

    return res.status(200).json({
      paymentId: result.id,
      status: result.status,
      qrCodeBase64: txData.qr_code_base64,
      qrCode: txData.qr_code, // "Pix Copia e Cola"
      ticketUrl: txData.ticket_url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar cobrança PIX";
    return res.status(500).json({ error: message });
  }
}
