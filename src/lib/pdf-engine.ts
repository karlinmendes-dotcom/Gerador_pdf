import { generate } from "@pdfme/generator";
import type { Template } from "@pdfme/common";

// ─── Document types metadata ──────────────────────────────────────────

export interface DocType {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

export const DOC_TYPES: DocType[] = [
  { id: "compra-venda-veiculo", name: "Contrato de Compra e Venda de Veículo", description: "Contrato completo para compra e venda de veículos automotores.", icon: "🚗", category: "Veículos" },
  { id: "recibo-pagamento", name: "Recibo de Pagamento", description: "Recibo para comprovação de pagamentos diversos.", icon: "💰", category: "Financeiro" },
  { id: "declaracao-residencia", name: "Declaração de Residência", description: "Declaração formal de residência para fins diversos.", icon: "🏠", category: "Pessoal" },
];

export function getDocType(id: string): DocType | undefined {
  return DOC_TYPES.find((d) => d.id === id);
}

/** Preço por documento em BRL — paywall acionado apenas no download. */
export const PRICES: Record<string, number> = {
  "compra-venda-veiculo": 9.9,
  "recibo-pagamento": 5.0,
  "declaracao-residencia": 5.0,
};

export function getPrice(id: string): number {
  return PRICES[id] ?? 5.0;
}

// ─── Form fields per document type ────────────────────────────────────

export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export function getFields(documentType: string): FieldDef[] {
  switch (documentType) {
    case "compra-venda-veiculo":
      return [
        { key: "comprador_nome", label: "Nome do Comprador", required: true },
        { key: "comprador_cpf", label: "CPF do Comprador", placeholder: "000.000.000-00", required: true },
        { key: "comprador_endereco", label: "Endereço do Comprador", required: true },
        { key: "vendedor_nome", label: "Nome do Vendedor", required: true },
        { key: "vendedor_cpf", label: "CPF do Vendedor", placeholder: "000.000.000-00", required: true },
        { key: "vendedor_endereco", label: "Endereço do Vendedor", required: true },
        { key: "veiculo_descricao", label: "Descrição do Veículo", placeholder: "Marca, Modelo, Ano, Cor", required: true },
        { key: "veiculo_placa", label: "Placa", placeholder: "ABC-1234", required: true },
        { key: "veiculo_renavam", label: "RENAVAM", required: true },
        { key: "valor_total", label: "Valor Total (R$)", placeholder: "20.000,00", required: true },
        { key: "valor_por_extenso", label: "Valor por Extenso", placeholder: "Vinte mil reais", required: true },
        { key: "data_venda", label: "Data da Venda", placeholder: "DD/MM/AAAA", required: true },
        { key: "local_venda", label: "Local da Venda", placeholder: "Cidade/UF", required: true },
        { key: "forma_pagamento", label: "Forma de Pagamento", placeholder: "À vista / Parcelado em 12x", required: true },
      ];
    case "recibo-pagamento":
      return [
        { key: "recibo_pagador", label: "Nome do Pagador", required: true },
        { key: "recibo_cpf_pagador", label: "CPF do Pagador", placeholder: "000.000.000-00", required: true },
        { key: "recibo_recebedor", label: "Nome do Recebedor", required: true },
        { key: "recibo_cnpj_recebedor", label: "CNPJ/CPF do Recebedor", required: true },
        { key: "recibo_valor", label: "Valor (R$)", placeholder: "1.500,00", required: true },
        { key: "recibo_valor_extenso", label: "Valor por Extenso", placeholder: "Mil e quinhentos reais", required: true },
        { key: "recibo_referencia", label: "Referência do Pagamento", required: true },
        { key: "recibo_data", label: "Data", placeholder: "DD/MM/AAAA", required: true },
        { key: "recibo_local", label: "Local (Cidade/UF)", required: true },
      ];
    case "declaracao-residencia":
      return [
        { key: "declarante_nome", label: "Nome Completo", required: true },
        { key: "declarante_cpf", label: "CPF", placeholder: "000.000.000-00", required: true },
        { key: "declarante_rg", label: "RG", required: true },
        { key: "declarante_endereco", label: "Endereço Completo", required: true },
        { key: "declarante_cidade", label: "Cidade", required: true },
        { key: "declarante_estado", label: "Estado (UF)", placeholder: "SP", required: true },
        { key: "declarante_cep", label: "CEP", placeholder: "00000-000", required: true },
        { key: "declarante_data", label: "Data", placeholder: "DD/MM/AAAA", required: true },
        { key: "declarante_local", label: "Local (Cidade/UF)", required: true },
      ];
    default:
      return [];
  }
}

// ─── PDF Templates ────────────────────────────────────────────────────

function replaceVars(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] ?? `{{${k}}}`);
}

const TEMPLATES: Record<string, Template> = {
  "compra-venda-veiculo": {
    basePdf: { width: 210, height: 297, padding: [20, 20, 20, 20] } as any,
    schemas: [[
      { type: "text", name: "header", position: { x: 20, y: 15 }, width: 170, height: 12, fontSize: 16, fontColor: "#000000", content: "CONTRATO DE COMPRA E VENDA DE VEÍCULO", fontName: "Helvetica-Bold", alignment: "center" } as any,
    ], [
      { type: "text", name: "body", position: { x: 20, y: 35 }, width: 170, height: 220, fontSize: 10, fontColor: "#000000", fontName: "Helvetica",
        content: `Aos {{data_venda}}, na cidade de {{local_venda}}, os abaixo identificados celebram entre si o presente Contrato de Compra e Venda de Veículo:

CLÁUSULA 1ª — DO OBJETO
O(A) VENDEDOR(A) vende ao(à) COMPRADOR(A) o veículo: {{veiculo_descricao}}, Placa: {{veiculo_placa}}, RENAVAM: {{veiculo_renavam}}.

CLÁUSULA 2ª — DO PREÇO
O valor total da venda é de R$ {{valor_total}} ({{valor_por_extenso}}), da seguinte forma: {{forma_pagamento}}.

CLÁUSULA 3ª — DA TRANSFERÊNCIA
O(A) VENDEDOR(A) entregará os documentos para transferência em até 15 dias corridos.

CLÁUSULA 4ª — DAS GARANTIAS
O(A) VENDEDOR(A) declara que o veículo é livre e desembaraçado de quaisquer ônus ou restrições.

E por estarem justos e acordados, assinam em 2 vias.

_____________________________          _____________________________
{{vendedor_nome}}                                     {{comprador_nome}}
VENDEDOR(A)                                           COMPRADOR(A)
CPF: {{vendedor_cpf}}                               CPF: {{comprador_cpf}}` } as any,
    ]],
  },

  "recibo-pagamento": {
    basePdf: { width: 210, height: 297, padding: [20, 20, 20, 20] } as any,
    schemas: [[
      { type: "text", name: "header", position: { x: 20, y: 15 }, width: 170, height: 12, fontSize: 16, fontColor: "#000000", content: "RECIBO DE PAGAMENTO", fontName: "Helvetica-Bold", alignment: "center" } as any,
    ], [
      { type: "text", name: "body", position: { x: 20, y: 35 }, width: 170, height: 200, fontSize: 10, fontColor: "#000000", fontName: "Helvetica",
        content: `Recebi de {{recibo_pagador}}, CPF nº {{recibo_cpf_pagador}}, a importância de R$ {{recibo_valor}} ({{recibo_valor_extenso}}), referente a {{recibo_referencia}}.

Recebedor(a): {{recibo_recebedor}}
CNPJ/CPF: {{recibo_cnpj_recebedor}}
Data: {{recibo_data}}
Local: {{recibo_local}}

_____________________________
{{recibo_recebedor}}` } as any,
    ]],
  },

  "declaracao-residencia": {
    basePdf: { width: 210, height: 297, padding: [20, 20, 20, 20] } as any,
    schemas: [[
      { type: "text", name: "header", position: { x: 20, y: 15 }, width: 170, height: 12, fontSize: 16, fontColor: "#000000", content: "DECLARAÇÃO DE RESIDÊNCIA", fontName: "Helvetica-Bold", alignment: "center" } as any,
    ], [
      { type: "text", name: "body", position: { x: 20, y: 35 }, width: 170, height: 200, fontSize: 10, fontColor: "#000000", fontName: "Helvetica",
        content: `Eu, {{declarante_nome}}, portador(a) do CPF nº {{declarante_cpf}}, RG nº {{declarante_rg}}, declaro, para os devidos fins, que resido em: {{declarante_endereco}}, {{declarante_cidade}}/{{declarante_estado}}, CEP {{declarante_cep}}.

Declaração feita de boa-fé, sob as penas da lei.

Data: {{declarante_data}}
Local: {{declarante_local}}

_____________________________
{{declarante_nome}}` } as any,
    ]],
  },
};

// ─── Generation ───────────────────────────────────────────────────────

export async function generatePdf(documentType: string, data: Record<string, string>): Promise<Blob> {
  const base = TEMPLATES[documentType] ?? TEMPLATES["compra-venda-veiculo"];

  const processed = {
    ...base,
    schemas: base.schemas.map((page) =>
      page.map((field: any) => {
        if (field.type === "text" && field.content) {
          return { ...field, content: replaceVars(field.content, data) };
        }
        return field;
      })
    ),
  };

  const pdf = await generate({ template: processed, inputs: [{}] });
  return new Blob([pdf], { type: "application/pdf" });
}

export async function downloadPdf(documentType: string, data: Record<string, string>, filename: string): Promise<void> {
  const blob = await generatePdf(documentType, data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
