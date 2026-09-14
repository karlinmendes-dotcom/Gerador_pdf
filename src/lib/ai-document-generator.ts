import { getSchemaFieldKeys } from "./document-schemas";

export type AiProvider = "gemini" | "groq";

/**
 * Chama a rota serverless /api/generate-document (chaves ficam no servidor).
 * Fallback offline: se a rota não existir (npm run dev puro, sem Vercel),
 * sem chaves configuradas ou com rede indisponível, retorna dados mock
 * para que a interface siga 100% funcional em modo de teste local.
 */

export interface GenerationResult {
  data: Record<string, string>;
  /** true quando os dados vieram do fallback mock local (sem IA real). */
  mock: boolean;
}

// ─── Mocks offline por documento ─────────────────────────────────────

const MOCK_VEICULO: Record<string, string> = {
  vendedor_nome: "Maria Oliveira",
  vendedor_cpf_cnpj: "987.654.321-00",
  vendedor_rg: "34.567.890-1",
  vendedor_endereco: "Av. Paulista, 1000 — São Paulo/SP",
  comprador_nome: "João da Silva",
  comprador_cpf_cnpj: "123.456.789-09",
  comprador_rg: "12.345.678-9",
  comprador_endereco: "Rua das Flores, 123 — São Paulo/SP",
  veiculo_marca: "Volkswagen",
  veiculo_modelo: "Gol 1.0",
  veiculo_ano: "2018/2018",
  veiculo_placa: "ABC-1234",
  veiculo_renavam: "12345678901",
  veiculo_cor: "Prata",
  veiculo_chassi: "9BWZZZ377VT004251",
  valor_total: "R$ 15.000,00",
  forma_pagamento: "Parcelado",
  forma_pagamento_detalhe: "12 parcelas de R$ 1.250,00",
  data_entrega: "14/09/2026",
};

const MOCK_RECIBO: Record<string, string> = {
  pagador_nome: "Pedro Santos",
  pagador_cpf_cnpj: "111.222.333-44",
  recebedor_nome: "Imobiliária ABC LTDA",
  recebedor_cpf_cnpj: "12.345.678/0001-99",
  valor: "R$ 1.500,00",
  referente: "Aluguel do apartamento — mês de setembro/2026",
  cidade: "São Paulo",
  data: "10/09/2026",
  parcelado: "true",
  numero_parcelas: "3",
  valor_parcela: "R$ 500,00",
};

const MOCK_RESIDENCIA: Record<string, string> = {
  declarante_nome: "Carlos Mendes",
  declarante_cpf: "555.666.777-88",
  declarante_rg: "12.345.678-9",
  declarante_profissao: "Analista de sistemas",
  endereco_rua: "Rua Augusta, 500 — Apto 42",
  endereco_bairro: "Consolação",
  endereco_cep: "01305-100",
  endereco_cidade: "São Paulo",
  endereco_estado: "SP",
};

const MOCK_ALUGUEL: Record<string, string> = {
  locador_nome: "Ana Ferreira",
  locador_cpf_cnpj: "222.333.444-55",
  locador_endereco: "Rua do Comércio, 45 — Campinas/SP",
  locatario_nome: "Bruno Costa",
  locatario_cpf_cnpj: "333.444.555-66",
  locatario_endereco: "Rua das Palmeiras, 210 — Campinas/SP",
  imovel_endereco: "Rua das Acácias, 78 — Campinas/SP",
  imovel_finalidade: "Residencial",
  valor_aluguel: "R$ 1.800,00",
  dia_vencimento: "5",
  duracao_meses: "12",
  garantia: "Caução",
  valor_caucao: "R$ 3.600,00",
};

const MOCK_DATA: Record<string, Record<string, string>> = {
  "compra-venda-veiculo": MOCK_VEICULO,
  "recibo-pagamento": MOCK_RECIBO,
  "declaracao-residencia": MOCK_RESIDENCIA,
  "contrato-aluguel-simples": MOCK_ALUGUEL,
};

export function getMockData(documentType: string): Record<string, string> {
  const base = MOCK_DATA[documentType] ?? MOCK_VEICULO;
  // Garante todas as chaves do schema
  const keys = getSchemaFieldKeys(documentType);
  const data: Record<string, string> = {};
  for (const key of keys) {
    data[key] = String(base[key] ?? "");
  }
  return { ...data, ...base };
}

// ─── Chamada real com fallback ───────────────────────────────────────

export async function generateDocumentData({
  freeText,
  documentType,
  provider,
}: {
  freeText: string;
  documentType: string;
  provider: AiProvider;
}): Promise<GenerationResult> {
  try {
    const res = await fetch("/api/generate-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeText, documentType, provider }),
      // Se não há serverless (dev puro), falha rápido em vez de travar a UI
      signal: AbortSignal.timeout?.(15000),
    });

    if (res.ok) {
      const body = (await res.json()) as { data: Record<string, string> };
      if (body?.data && Object.keys(body.data).length > 0) {
        const keys = getSchemaFieldKeys(documentType);
        const data: Record<string, string> = {};
        for (const key of keys) {
          data[key] = String(body.data[key] ?? "");
        }
        return { data: { ...data, ...body.data }, mock: false };
      }
    }
    // 404 (sem rota serverless), 500 (sem GEMINI/GROQ_API_KEY) ou resposta vazia → mock
  } catch {
    // rede indisponível / rota inexistente → mock
  }

  return { data: getMockData(documentType), mock: true };
}
