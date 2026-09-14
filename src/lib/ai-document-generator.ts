import { getDocType } from "./pdf-engine";

export type AiProvider = "gemini" | "groq";

/**
 * Calls the serverless route /api/generate-document, which uses the
 * GEMINI_API_KEY or GROQ_API_KEY server-side env vars (never exposed
 * to the browser).
 */
export async function generateDocumentData({
  freeText,
  documentType,
  provider,
}: {
  freeText: string;
  documentType: string;
  provider: AiProvider;
}): Promise<Record<string, string>> {
  const res = await fetch("/api/generate-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ freeText, documentType, provider }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Erro ${res.status} ao gerar documento`);
  }

  const body = (await res.json()) as { data: Record<string, string> };

  // Fill any missing keys with empty strings so the form renders fully
  const docType = getDocType(documentType);
  const data: Record<string, string> = {};
  if (docType) {
    for (const field of getFieldsFor(documentType)) {
      data[field] = body.data?.[field] ?? "";
    }
  }
  return { ...data, ...body.data };
}

// Minimal field lists to normalize AI output per document type
function getFieldsFor(documentType: string): string[] {
  switch (documentType) {
    case "compra-venda-veiculo":
      return ["comprador_nome", "comprador_cpf", "comprador_endereco", "vendedor_nome", "vendedor_cpf", "vendedor_endereco", "veiculo_descricao", "veiculo_placa", "veiculo_renavam", "valor_total", "valor_por_extenso", "data_venda", "local_venda", "forma_pagamento"];
    case "recibo-pagamento":
      return ["recibo_pagador", "recibo_cpf_pagador", "recibo_recebedor", "recibo_cnpj_recebedor", "recibo_valor", "recibo_valor_extenso", "recibo_referencia", "recibo_data", "recibo_local"];
    case "declaracao-residencia":
      return ["declarante_nome", "declarante_cpf", "declarante_rg", "declarante_endereco", "declarante_cidade", "declarante_estado", "declarante_cep", "declarante_data", "declarante_local"];
    default:
      return [];
  }
}
