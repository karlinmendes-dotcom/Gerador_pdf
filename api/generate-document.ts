import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

// ─── Helpers ──────────────────────────────────────────────────────────

const str = (desc: string) => z.string().describe(desc);
const optStr = z.string().optional();

// ─── Zod Schemas (espelham os JSON Schemas de /schemas) ───────────────

const VehicleSaleSchema = z.object({
  vendedor_nome: str("Nome do vendedor"),
  vendedor_cpf_cnpj: str("CPF ou CNPJ do vendedor"),
  vendedor_rg: optStr,
  vendedor_endereco: str("Endereço do vendedor"),
  comprador_nome: str("Nome do comprador"),
  comprador_cpf_cnpj: str("CPF ou CNPJ do comprador"),
  comprador_rg: optStr,
  comprador_endereco: str("Endereço do comprador"),
  veiculo_marca: str("Marca do veículo"),
  veiculo_modelo: str("Modelo do veículo"),
  veiculo_ano_modelo: str("Ano/modelo (ex: 2018/2019)"),
  veiculo_placa: str("Placa do veículo"),
  veiculo_renavam: str("RENAVAM"),
  veiculo_cor: optStr,
  veiculo_chassi: optStr,
  valor_total: str("Valor total em formato brasileiro (20.000,00)"),
  forma_pagamento: z.enum(["À vista", "Parcelado"]),
  parcelamento_detalhe: optStr,
  data_entrega: str("Data de entrega DD/MM/AAAA"),
  local_venda: str("Cidade/UF da venda"),
  data_venda: str("Data da venda DD/MM/AAAA"),
});

const ReceiptSchema = z.object({
  pagador_nome: str("Nome do pagador"),
  pagador_cpf_cnpj: str("CPF ou CNPJ do pagador"),
  recebedor_nome: str("Nome do recebedor"),
  recebedor_cpf_cnpj: str("CPF ou CNPJ do recebedor"),
  valor: str("Valor em formato brasileiro (1.500,00)"),
  referente_a: str("Descrição do serviço ou produto"),
  parcelamento: z.boolean().optional(),
  numero_parcelas: z.number().optional(),
  valor_parcela: optStr,
  cidade: str("Cidade"),
  data: str("Data DD/MM/AAAA"),
});

const ResidenceSchema = z.object({
  declarante_nome: str("Nome completo do declarante"),
  declarante_cpf: str("CPF"),
  declarante_rg: str("RG"),
  declarante_profissao: str("Profissão"),
  endereco_rua: str("Rua/logradouro"),
  endereco_numero: str("Número"),
  endereco_bairro: str("Bairro"),
  endereco_complemento: optStr,
  endereco_cep: str("CEP"),
  endereco_cidade: str("Cidade"),
  endereco_estado: z.enum(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]),
  data: str("Data DD/MM/AAAA"),
});

const RentSchema = z.object({
  locador_nome: str("Nome do locador"),
  locador_cpf_cnpj: str("CPF ou CNPJ do locador"),
  locador_rg: optStr,
  locador_endereco: str("Endereço do locador"),
  locatario_nome: str("Nome do locatário"),
  locatario_cpf_cnpj: str("CPF ou CNPJ do locatário"),
  locatario_rg: optStr,
  locatario_endereco: str("Endereço do locatário"),
  imovel_endereco: str("Endereço do imóvel locado"),
  imovel_finalidade: z.enum(["Residencial", "Comercial"]),
  valor_aluguel: str("Valor do aluguel mensal em formato brasileiro"),
  dia_vencimento: z.number().min(1).max(31),
  duracao_meses: z.number().min(1).max(60),
  valor_caucao: optStr,
  forma_garantia: z.enum(["Caução", "Fiador", "Seguro-fiança", "Sem garantia"]).optional(),
  data_inicio: str("Data de início DD/MM/AAAA"),
  cidade: str("Cidade de assinatura"),
  data_assinatura: str("Data de assinatura DD/MM/AAAA"),
});

const SCHEMAS: Record<string, z.ZodObject<Record<string, z.ZodTypeAny>>> = {
  "compra-venda-veiculo": VehicleSaleSchema,
  "recibo-pagamento": ReceiptSchema,
  "declaracao-residencia": ResidenceSchema,
  "contrato-aluguel-simples": RentSchema,
};

const PROMPTS: Record<string, string> = {
  "compra-venda-veiculo":
    "Você é um assistente jurídico brasileiro. Extraia/gere os dados para um Contrato de Compra e Venda de Veículo a partir do texto livre. CPFs/CNPJs formatados. Valores no formato brasileiro (20.000,00). Datas em DD/MM/AAAA. Forma de pagamento apenas 'À vista' ou 'Parcelado'.",
  "recibo-pagamento":
    "Você é um assistente jurídico brasileiro. Extraia/gere os dados para um Recibo de Pagamento. Valores no formato brasileiro. Data em DD/MM/AAAA. Se houver parcelamento, marque parcelamento=true e preencha numero_parcelas e valor_parcela.",
  "declaracao-residencia":
    "Você é um assistente jurídico brasileiro. Extraia/gere os dados para uma Declaração de Residência. Estado em sigla UF (2 letras). Data em DD/MM/AAAA.",
  "contrato-aluguel-simples":
    "Você é um assistente jurídico brasileiro. Extraia/gere os dados para um Contrato de Aluguel Residencial Simples. Valores no formato brasileiro. Datas em DD/MM/AAAA. dia_vencimento e duracao_meses são números.",
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
    });

    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(object as Record<string, unknown>)) {
      data[k] = v === undefined || v === null ? "" : String(v);
    }

    return res.status(200).json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar documento";
    return res.status(500).json({ error: message });
  }
}
