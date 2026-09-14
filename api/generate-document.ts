import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

// ─── Zod Schemas (same shape as the PDF templates) ────────────────────

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
  "compra-venda-veiculo":
    "Você é um assistente jurídico brasileiro. Extraia/gere os dados para um Contrato de Compra e Venda de Veículo a partir do texto livre. CPFs no formato XXX.XXX.XXX-XX. Valores no formato brasileiro (20.000,00). Datas em DD/MM/AAAA. Gere valor_por_extenso em português do Brasil.",
  "recibo-pagamento":
    "Você é um assistente jurídico brasileiro. Extraia/gere os dados para um Recibo de Pagamento. Gere valor_extenso em português do Brasil.",
  "declaracao-residencia":
    "Você é um assistente jurídico brasileiro. Extraia/gere os dados para uma Declaração de Residência. Estado em sigla UF (2 letras).",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { freeText, documentType, provider } = req.body as {
      freeText?: string;
      documentType?: string;
      provider?: "gemini" | "groq";
    };

    if (!freeText || !documentType) {
      return res.status(400).json({ error: "freeText e documentType são obrigatórios" });
    }

    const schema = SCHEMAS[documentType] ?? SCHEMAS["compra-venda-veiculo"];
    const prompt = PROMPTS[documentType] ?? PROMPTS["compra-venda-veiculo"];

    const useGroq = provider === "groq";
    const apiKey = useGroq ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: useGroq
          ? "GROQ_API_KEY não configurada no ambiente"
          : "GEMINI_API_KEY não configurada no ambiente",
      });
    }

    const model = useGroq
      ? createGroq({ apiKey })("llama-3.3-70b-versatile")
      : createGoogleGenerativeAI({ apiKey })("gemini-1.5-flash");

    const { object } = await generateObject({
      model,
      schema,
      prompt: `${prompt}\n\nTexto do usuário:\n${freeText}`,
      output: "object",
    } as any);

    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(object as Record<string, unknown>)) {
      data[k] = String(v ?? "");
    }

    return res.status(200).json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar documento";
    return res.status(500).json({ error: message });
  }
}
