import { generate } from "@pdfme/generator";
import type { Template } from "@pdfme/common";
import { DOCUMENT_SCHEMAS, getSchema } from "./document-schemas";

// ─── Documentos e preços (paywall R$ 5–9) ─────────────────────────────

export interface DocType {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

/** Deriva a lista de documentos dos JSON Schemas. */
export const DOC_TYPES: DocType[] = Object.entries(DOCUMENT_SCHEMAS).map(([id, s]) => ({
  id,
  name: s.title,
  description: s.description,
  icon: s.icon,
  category: s.category,
}));

/** Preço por documento em BRL — paywall acionado apenas no download. */
export const PRICES: Record<string, number> = {
  "compra-venda-veiculo": 9.9,
  "recibo-pagamento": 5.0,
  "declaracao-residencia": 5.0,
  "contrato-aluguel-simples": 9.9,
};

export function getPrice(id: string): number {
  return PRICES[id] ?? 5.0;
}

export function getDocType(id: string): DocType | undefined {
  return DOC_TYPES.find((d) => d.id === id);
}

// ─── Layout A4 padrão (210mm × 297mm, margens 20mm) ───────────────────

const A4 = { width: 210, height: 297, padding: [20, 20, 20, 20] as [number, number, number, number] };

const FONT_BODY = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

interface A4Page {
  /** Título centralizado em negrito no topo. */
  header(title: string): unknown;
  /** Corpo tipografado legível. */
  body(content: string): unknown;
  /** Rodapé: local/data + assinaturas + marca de validação. */
  footer(fields: { local?: string; data?: string; signers: string[] }): unknown[];
}

const a4: A4Page = {
  header: (title) => ({
    type: "text",
    name: "header",
    position: { x: 20, y: 15 },
    width: 170,
    height: 14,
    fontSize: 15,
    fontColor: "#000000",
    fontName: FONT_BOLD,
    alignment: "center",
    content: title,
  }),
  body: (content) => ({
    type: "text",
    name: "body",
    position: { x: 20, y: 36 },
    width: 170,
    height: 210,
    fontSize: 10,
    fontColor: "#111111",
    fontName: FONT_BODY,
    lineHeight: 1.45,
    content,
  }),
  footer: ({ local, data, signers }): unknown[] => ([
    {
      type: "text",
      name: "footer_local_data",
      position: { x: 20, y: 252 },
      width: 170,
      height: 8,
      fontSize: 9,
      fontColor: "#333333",
      fontName: FONT_BODY,
      alignment: "center",
      content: `${local ?? "Local"}, ${data ?? "data"}`,
    },
    {
      type: "text",
      name: "footer_sign_lines",
      position: { x: 20, y: 268 },
      width: 170,
      height: 5,
      fontSize: 9,
      fontColor: "#000000",
      fontName: FONT_BODY,
      content: "_______________________________________",
    },
    {
      type: "text",
      name: "footer_signers",
      position: { x: 20, y: 274 },
      width: 170,
      height: 10,
      fontSize: 9,
      fontColor: "#000000",
      fontName: FONT_BODY,
      alignment: "center",
      content: signers.filter(Boolean).join("  •  "),
    },
    {
      type: "text",
      name: "footer_validation",
      position: { x: 20, y: 286 },
      width: 170,
      height: 5,
      fontSize: 6.5,
      fontColor: "#666666",
      fontName: FONT_BODY,
      alignment: "center",
      content:
        "Documento gerado por PDFForge Brasil · valide a assinatura digital gratuitamente em assinador.iti.br (Gov.br)",
    },
  ]),
};

/** Monta a página A4 completa: header + body + footer. */
function page(
  title: string,
  body: string,
  signers: string[],
  local?: string,
  data?: string
): unknown[] {
  return [a4.header(title), a4.body(body), ...a4.footer({ local, data, signers })];
}

// ─── Corpos dos documentos ────────────────────────────────────────────

/** Formata o valor monetário (mantém o formato brasileiro já informado pelo usuário). */
function brl(v: string): string {
  return v;
}

const BODY_BUILDERS: Record<string, (d: Record<string, string>) => string> = {
  "compra-venda-veiculo": (d) => `CONTRATO PARTICULAR DE COMPRA E VENDA DE VEÍCULO AUTOMOTOR

Aos ${d.data_venda ?? "____"}, na cidade de ${d.local_venda ?? "____"}, as partes qualificadas abaixo celebram o presente Contrato de Compra e Venda de Veículo, regido pelas cláusulas seguintes.

CLÁUSULA 1ª — DAS PARTES
VENDEDOR(A): ${d.vendedor_nome ?? "____"}, CPF/CNPJ nº ${d.vendedor_cpf_cnpj ?? "____"}, RG nº ${d.vendedor_rg ?? "____"}, residente e domiciliado(a) em ${d.vendedor_endereco ?? "____"}.
COMPRADOR(A): ${d.comprador_nome ?? "____"}, CPF/CNPJ nº ${d.comprador_cpf_cnpj ?? "____"}, RG nº ${d.comprador_rg ?? "____"}, residente e domiciliado(a) em ${d.comprador_endereco ?? "____"}.

CLÁUSULA 2ª — DO OBJETO
O(A) VENDEDOR(A) vende ao(à) COMPRADOR(A), que declara aceitar, o veículo abaixo descrito:
• Marca: ${d.veiculo_marca ?? "____"}    • Modelo: ${d.veiculo_modelo ?? "____"}
• Ano/Modelo: ${d.veiculo_ano_modelo ?? "____"}    • Cor: ${d.veiculo_cor ?? "____"}
• Placa: ${d.veiculo_placa ?? "____"}    • RENAVAM: ${d.veiculo_renavam ?? "____"}
• Chassi: ${d.veiculo_chassi ?? "____"}

CLÁUSULA 3ª — DO PREÇO E DA FORMA DE PAGAMENTO
O preço total da venda é de R$ ${brl(d.valor_total ?? "____")}, pagos da seguinte forma: ${d.forma_pagamento ?? "____"}${d.forma_pagamento === "Parcelado" && d.parcelamento_detalhe ? ` (${d.parcelamento_detalhe})` : ""}.

CLÁUSULA 4ª — DA ENTREGA
A entrega do veículo e dos documentos ocorrerá na data de ${d.data_entrega ?? "____"}, com ata de entrega assinada pelas partes.

CLÁUSULA 5ª — DAS GARANTIAS E DECLARAÇÕES
O(A) VENDEDOR(A) declara que o veículo está livre de ônus, gravames, alienação fiduciária, multas e restrições, respondendo civilmente por eventuais informações inverídicas.

CLÁUSULA 6ª — DA TRANSFERÊNCIA
O(A) COMPRADOR(A) responsabiliza-se pela transferência junto ao DETRAN no prazo legal, correndo por sua conta as respectivas despesas.

Parágrafo único: ficam as partes cientes de que o presente contrato obriga exclusivamente as partes signatárias, nos termos do Código Civil Brasileiro.`,

  "recibo-pagamento": (d) => `RECIBO DE PAGAMENTO

Recebi de ${d.pagador_nome ?? "____"}, inscrito(a) no CPF/CNPJ sob nº ${d.pagador_cpf_cnpj ?? "____"}, a importância de R$ ${brl(d.valor ?? "____")}, referente a ${d.referente_a ?? "____"}, dando plena, geral e irrevogável quitação do valor recebido.

${d.parcelamento ? `PARCELAMENTO: pagamento em ${d.numero_parcelas ?? "____"} parcelas de R$ ${d.valor_parcela ?? "____"} cada, regidas pelo Livro de Recibos vinculado a este documento.\n\n` : ""}Local e data: ${d.cidade ?? "____"}, ${d.data ?? "____"}.

Declarações do recebedor: o valor recebido não inclui tributos retidos por lei, quando aplicáveis, e este recibo não substitui nota fiscal.`,

  "declaracao-residencia": (d) => `DECLARAÇÃO DE RESIDÊNCIA

Eu, ${d.declarante_nome ?? "____"}, inscrito(a) no CPF sob nº ${d.declarante_cpf ?? "____"}, RG nº ${d.declarante_rg ?? "____"}, profissão ${d.declarante_profissao ?? "____"}, declaro, para os devidos fins e sob as penas da lei, que resido no seguinte endereço:

Rua/Logradouro: ${d.endereco_rua ?? "____"}, nº ${d.endereco_numero ?? "____"}${d.endereco_complemento ? ` — ${d.endereco_complemento}` : ""}
Bairro: ${d.endereco_bairro ?? "____"}    CEP: ${d.endereco_cep ?? "____"}
Cidade/UF: ${d.endereco_cidade ?? "____"}/${d.endereco_estado ?? "____"}

DECLARAÇÃO SOB AS PENAS DA LEI
Declaro estar ciente de que a falsidade desta declaração configura crime previsto no Art. 299 do Código Penal (falsidade ideológica), punido com reclusão e multa, além das demais sanções civis e administrativas cabíveis.

Por ser expressão da verdade, firmo a presente declaração.`,

  "contrato-aluguel-simples": (d) => `CONTRATO DE LOCAÇÃO RESIDENCIAL SIMPLES

As partes qualificadas abaixo celebram o presente Contrato de Locação do imóvel descrito, que se regerá pela Lei nº 8.245/91 (Lei do Inquilinato) e pelas cláusulas seguintes.

CLÁUSULA 1ª — DAS PARTES
LOCADOR(A): ${d.locador_nome ?? "____"}, CPF/CNPJ nº ${d.locador_cpf_cnpj ?? "____"}, RG nº ${d.locador_rg ?? "____"}, residente em ${d.locador_endereco ?? "____"}.
LOCATÁRIO(A): ${d.locatario_nome ?? "____"}, CPF/CNPJ nº ${d.locatario_cpf_cnpj ?? "____"}, RG nº ${d.locatario_rg ?? "____"}, residente em ${d.locatario_endereco ?? "____"}.

CLÁUSULA 2ª — DO IMÓVEL
O imóvel locado situa-se em ${d.imovel_endereco ?? "____"}, destinado a fins ${String(d.imovel_finalidade ?? "Residencial").toLowerCase()}.

CLÁUSULA 3ª — DO VALOR E DO VENCIMENTO
O aluguel mensal é de R$ ${brl(d.valor_aluguel ?? "____")}, vencível todo dia ${d.dia_vencimento ?? "____"} de cada mês, mediante recibo ou comprovante de pagamento.

CLÁUSULA 4ª — DA DURAÇÃO
O presente contrato terá a duração de ${d.duracao_meses ?? "____"} meses, iniciando em ${d.data_inicio ?? "____"}, prorrogável por acordo entre as partes.

CLÁUSULA 5ª — DA GARANTIA
A garantia contratada é: ${d.forma_garantia ?? "Sem garantia"}${d.valor_caucao ? `, no valor de R$ ${brl(d.valor_caucao)}` : ""}, que responderá poreventuais débitos e danos, nos termos da lei.

CLÁUSULA 6ª — DAS OBRIGAÇÕES
O(A) LOCATÁRIO(A) obriga-se a usar o imóvel conforme a finalidade pactuada, conservá-lo e pagar pontualmente os encargos; o(A) LOCADOR(A) garante o uso pacífico do imóvel durante a locação.`,
};

// ─── Geração ──────────────────────────────────────────────────────────

/** Assinaturas por documento (ordem: esquerda → direita). */
function signersFor(id: string, d: Record<string, string>): string[] {
  switch (id) {
    case "compra-venda-veiculo":
      return [`${d.vendedor_nome ?? "Vendedor(a)"} — Vendedor(a)`, `${d.comprador_nome ?? "Comprador(a)"} — Comprador(a)`];
    case "contrato-aluguel-simples":
      return [`${d.locador_nome ?? "Locador(a)"} — Locador(a)`, `${d.locatario_nome ?? "Locatário(a)"} — Locatário(a)`];
    case "recibo-pagamento":
      return [`${d.recebedor_nome ?? "Recebedor(a)"} — Recebedor(a)`];
    case "declaracao-residencia":
      return [`${d.declarante_nome ?? "Declarante"} — Declarante`];
    default:
      return ["Assinatura do(a) declarante"];
  }
}

export async function generatePdf(documentType: string, data: Record<string, string>): Promise<Blob> {
  const schema = getSchema(documentType);
  const bodyBuilder = BODY_BUILDERS[documentType] ?? BODY_BUILDERS["compra-venda-veiculo"];
  const body = bodyBuilder(data);

  const signers = signersFor(documentType, data);
  const local =
    data.local_venda ??
    data.cidade ??
    (data.endereco_cidade && data.endereco_estado
      ? `${data.endereco_cidade}/${data.endereco_estado}`
      : undefined);
  const date = data.data_venda ?? data.data ?? data.data_assinatura;

  const template = {
    basePdf: { width: A4.width, height: A4.height, padding: A4.padding },
    schemas: [page(schema.title, body, signers, local, date)],
  } as unknown as Template;

  const pdf = await generate({ template, inputs: [{}] });
  return new Blob([pdf], { type: "application/pdf" });
}

export async function downloadPdf(documentType: string, data: Record<string, string>, filename: string): Promise<void> {
  const blob = await generatePdf(documentType, data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Preview em nova aba (opcional). */
export async function openPdfPreview(documentType: string, data: Record<string, string>): Promise<void> {
  const blob = await generatePdf(documentType, data);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
