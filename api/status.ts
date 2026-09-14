import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/status?paymentId=123
 * Polls the current status of a Mercado Pago payment.
 * The frontend polls this until status === "approved".
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return res.status(500).json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" });
    }

    const paymentId = req.query.paymentId as string;
    if (!paymentId) {
      return res.status(400).json({ error: "paymentId é obrigatório" });
    }

    const { MercadoPagoConfig, Payment } = await import("mercadopago");
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    const result = await payment.get({ id: Number(paymentId) });

    return res.status(200).json({ id: result.id, status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao consultar pagamento";
    return res.status(500).json({ error: message });
  }
}
