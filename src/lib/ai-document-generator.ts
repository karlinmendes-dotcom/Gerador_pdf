import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

// ─── Zod Schemas ──────────────────────────────────────────────────────

const VehicleSaleSchema = z.object({
  comprador_nome: z.string(),
  comprador_cpf: z.string(),
  comprador_endereco: z.string(),
  vendedor_nome: z.string(),
  vendedor_cpf: z.string(),
  vendedor_endereco: z.string(),
  veiculo_descricao: z.string(),
  veiculo_placa: z.string(),
  veiculo_renavam: z.string(),
  valor_total: z.string(),
  valor_por_extenso: z.string(),
  data_venda: z.string(),
  local_venda: z.string(),
  forma_pagamento: z.string(),
});

const ReceiptSchema = z.object({
  recibo_pagador: z.string(),
  recibo_cpf_pagador: z.string(),
  recibo_recebedor: z.string(),
  recibo_cnpj_recebedor: z.string(),
  recibo_valor: z.string(),
  recibo_valor_extenso: z.string(),
  recibo_referencia: z.string(),
  recibo_data: z.string(),
  recibo_local: z.string(),
});

const ResidenceSchema = z.object({
  declarante_nome: z.string(),
  declarante_cpf: z.string(),
  declarante_rg: z.string(),
  declarante_endereco: z.string(),
  declarante_cidade: z.string(),
  declarante_estado: z.string(),
  declarante_cep: z.string(),
  declarante_data: z.string(),
  declarante_local: z.string(),
});

const SCHEMAS: Record<string, z.ZodObject<any>> = {
  "compra-venda-veiculo": VehicleSaleSchema,
  "recibo-pagamento": ReceiptSchema,
  "declaracao-residencia": ResidenceSchema,
};

const PROMPTS: Record<string, string> = {
  "compra-venda-veiculo": `Você é um assistente jurídico brasileiro. Extraia/gere os dados para um Contrato de Compra e Venda de Veículo a partir do texto livre. CPFs no formato XXX.XXX.XXX-XX. Valores no formato brasileiro (20.000,00). Datas em DD/MM/AAAA. Valor_por_extenso em português.`,
  "recibo-pagamento": `Você é um assistente jurídico brasileiro. Extraia/gere os dados para um Recibo de Pagamento. Valor_extenso em português.`,
  "declaracao-residencia": `Você é um assistente jurídico brasileiro. Extraia/gere os dados para uma Declaração de Residência. Estado em sigla UF.`,
};

// ─── Provider types ───────────────────────────────────────────────────

export type AiProvider = "gemini" | "groq";

interface GenerateParams {
  freeText: string;
  documentType: string;
  provider: AiProvider;
  apiKey?: string;
}

export async function generateDocumentData({ freeText, documentType, provider, apiKey }: GenerateParams): Promise<Record<string, string>> {
  const schema = SCHEMAS[documentType] ?? SCHEMAS["compra-venda-veiculo"];
  const prompt = PROMPTS[documentType] ?? PROMPTS["compra-venda-veiculo"];

  const resolved =
    apiKey ||
    (provider === "gemini"
      ? import.meta.env.VITE_GEMINI_API_KEY
      : import.meta.env.VITE_GROQ_API_KEY);

  if (!resolved) {
    throw new Error(
      provider === "gemini"
        ? "Configure GEMINI_API_KEY no painel da Vercel ou no .env.local"
        : "Configure GROQ_API_KEY no painel da Vercel ou no .env.local"
    );
  }

  let model;
  if (provider === "gemini") {
    const google = createGoogleGenerativeAI({ apiKey: resolved });
    model = google("gemini-1.5-flash");
  } else {
    const groq = createGroq({ apiKey: resolved });
    model = groq("llama-3.3-70b-versatile");
  }

  const { object } = await generateObject({
    model,
    schema,
    prompt: `${prompt}\n\nTexto do usuário:\n${freeText}`,
    output: "object",
  } as any);

  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(object as Record<string, unknown>)) {
    result[k] = String(v ?? "");
  }
  return result;
}

export function getProviderInfo() {
  return {
    gemini: { name: "Google Gemini", model: "gemini-1.5-flash" },
    groq: { name: "Groq (Llama)", model: "llama-3.3-70b-versatile" },
  };
}
