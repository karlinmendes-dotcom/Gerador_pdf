/**
 * Client for the serverless payment routes.
 * - POST /api/checkout  → creates a PIX charge (QR code + Copia e Cola)
 * - GET  /api/status    → polls payment status until approved
 */

export interface PixCheckout {
  paymentId: number | string;
  status: string;
  qrCodeBase64?: string;
  qrCode?: string;
  ticketUrl?: string;
}

export async function createPixCheckout(params: {
  documentId: string;
  amount: number;
  title: string;
}): Promise<PixCheckout> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Erro ${res.status} ao criar cobrança`);
  }

  return res.json();
}

export async function checkPaymentStatus(paymentId: string | number): Promise<string> {
  const res = await fetch(`/api/status?paymentId=${encodeURIComponent(String(paymentId))}`);

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Erro ${res.status} ao consultar status`);
  }

  const body = (await res.json()) as { status: string };
  return body.status;
}
