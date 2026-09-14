/**
 * Client for the serverless payment routes.
 * - POST /api/checkout  → creates a PIX charge (QR code + Copia e Cola)
 * - GET  /api/status    → polls payment status until approved
 *
 * Dev fallback: quando /api/checkout não está disponível (npm run dev puro,
 * sem serverless), gera um PIX mock determinístico para testes locais.
 */

export interface PixCheckout {
  paymentId: number | string;
  status: string;
  qrCodeBase64?: string;
  qrCode?: string;
  ticketUrl?: string;
  mock?: boolean;
}

/** QR Code PIX estático em SVG (mock para testes locais — não escaneável). */
const MOCK_QR_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 21 21'><rect width='21' height='21' fill='white'/><path d='M0 0h7v7H0zM2 2h3v3H2zM14 0h7v7h-7zM16 2h3v3h-3zM0 14h7v7H0zM2 16h3v3H2zM9 1h1v1H9zM11 1h1v1h-1zM9 3h1v1H9zM11 3h1v1h-1zM9 5h1v1H9zM11 5h1v1h-1zM1 9h1v1H1zM3 9h1v1H3zM5 9h1v1H5zM7 9h1v1H7zM9 9h1v1H9zM11 9h1v1h-1zM13 9h1v1h-1zM15 9h1v1h-1zM17 9h1v1h-1zM19 9h1v1h-1zM9 11h1v1H9zM11 11h1v1h-1zM13 11h1v1h-1zM15 11h1v1h-1zM17 11h1v1h-1zM19 11h1v1h-1zM9 13h1v1H9zM11 13h1v1h-1zM1 13h1v1H1zM3 13h1v1H3zM9 15h1v1H9zM11 15h1v1h-1zM13 15h1v1h-1zM15 15h1v1h-1zM17 15h1v1h-1zM19 15h1v1h-1zM9 17h1v1H9zM11 17h1v1h-1zM13 17h1v1h-1zM15 17h1v1h-1zM17 17h1v1h-1zM19 17h1v1h-1zM9 19h1v1H9zM11 19h1v1h-1zM13 19h1v1h-1zM15 19h1v1h-1zM17 19h1v1h-1zM19 19h1v1h-1z' fill='black'/></svg>`;

function mockCheckout(params: {
  documentId: string;
  amount: number;
  title: string;
}): PixCheckout {
  const amountStr = params.amount.toFixed(2);
  const paymentId = `mock_${Date.now()}`;
  return {
    paymentId,
    status: "pending",
    mock: true,
    qrCodeBase64: undefined,
    qrCode: `00020126BR.GOV.BCB.PIX01PDFFORGE52040000530398654${String(amountStr.length).padStart(2, "0")}${amountStr}5802BR5919PDFFORGE BRASIL6009SAO PAULO62${String(params.documentId.length + 4).padStart(2, "0")}05${String(params.documentId.length).padStart(2, "0")}${params.documentId}6304ABCD`,
    ticketUrl: undefined,
  };
}

export const MOCK_QR_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(MOCK_QR_SVG)}`;

export async function createPixCheckout(params: {
  documentId: string;
  amount: number;
  title: string;
  /** E-mail do usuário logado — enviado como payer ao Mercado Pago. */
  payerEmail?: string;
}): Promise<PixCheckout> {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      // Vite dev server returned index.html — route not available
      return mockCheckout(params);
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Erro ${res.status} ao criar cobrança`);
    }

    return (await res.json()) as PixCheckout;
  } catch (err) {
    // Network failure (offline dev) → mock
    if (err instanceof TypeError) return mockCheckout(params);
    throw err;
  }
}

export async function checkPaymentStatus(
  paymentId: string | number
): Promise<{ status: string; mock: boolean }> {
  if (String(paymentId).startsWith("mock_")) {
    // Mock payments: first 4 polls pending, then approved automatically
    const n = Number(String(paymentId).split("_")[1] ?? "0");
    const elapsed = Date.now() - n;
    return { status: elapsed > 8000 ? "approved" : "pending", mock: true };
  }

  const res = await fetch(`/api/status?paymentId=${encodeURIComponent(String(paymentId))}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { status: "pending", mock: true };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Erro ${res.status} ao consultar status`);
  }
  const body = (await res.json()) as { status: string };
  return { status: body.status, mock: false };
}