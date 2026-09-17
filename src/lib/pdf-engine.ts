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
  "curriculo-profissional": 7.9,
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
      content: `${local ?? "__________________"}, ${data ?? "__________________"}`,
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

/**
 * REGRA DE NEGÓCIO — nenhum campo é obrigatório. Campo vazio vira uma linha
 * em branco (____) para preenchimento manual à caneta após a impressão.
 * Quando o campo foi preenchido, devolve o valor informado.
 */
function fill(value: string | undefined, placeholder = ""): string {
  const v = (value ?? "").trim();
  return v || placeholder || "______________________";
}

/** Linha longa para endereços/descrições deixados em branco. */
const LONG_BLANK = "___________________________________________________________";

const BODY_BUILDERS: Record<string, (d: Record<string, string>) => string> = {
  "compra-venda-veiculo": (d) => `CONTRATO PARTICULAR DE COMPRA E VENDA DE VEÍCULO AUTOMOTOR

Aos ${fill(d.data_venda)}, na cidade de ${fill(d.local_venda)}, as partes qualificadas abaixo celebram o presente Contrato de Compra e Venda de Veículo, regido pelas cláusulas seguintes.

CLÁUSULA 1ª — DAS PARTES
VENDEDOR(A): ${fill(d.vendedor_nome)}, CPF/CNPJ nº ${fill(d.vendedor_cpf_cnpj)}, RG nº ${fill(d.vendedor_rg)}, residente e domiciliado(a) em ${fill(d.vendedor_endereco, LONG_BLANK)}.
COMPRADOR(A): ${fill(d.comprador_nome)}, CPF/CNPJ nº ${fill(d.comprador_cpf_cnpj)}, RG nº ${fill(d.comprador_rg)}, residente e domiciliado(a) em ${fill(d.comprador_endereco, LONG_BLANK)}.

CLÁUSULA 2ª — DO OBJETO
O(A) VENDEDOR(A) vende ao(à) COMPRADOR(A), que declara aceitar, o veículo abaixo descrito:
• Marca: ${fill(d.veiculo_marca)}    • Modelo: ${fill(d.veiculo_modelo)}
• Ano/Modelo: ${fill(d.veiculo_ano_modelo)}    • Cor: ${fill(d.veiculo_cor)}
• Placa: ${fill(d.veiculo_placa)}    • RENAVAM: ${fill(d.veiculo_renavam)}
• Chassi: ${fill(d.veiculo_chassi)}

CLÁUSULA 3ª — DO PREÇO E DA FORMA DE PAGAMENTO
O preço total da venda é de R$ ${brl(fill(d.valor_total))}, pagos da seguinte forma: ${fill(d.forma_pagamento)}${d.forma_pagamento === "Parcelado" && d.parcelamento_detalhe ? ` (${d.parcelamento_detalhe})` : ""}.

CLÁUSULA 4ª — DA ENTREGA
A entrega do veículo e dos documentos ocorrerá na data de ${fill(d.data_entrega)}, com ata de entrega assinada pelas partes.

CLÁUSULA 5ª — DAS GARANTIAS E DECLARAÇÕES
O(A) VENDEDOR(A) declara que o veículo está livre de ônus, gravames, alienação fiduciária, multas e restrições, respondendo civilmente por eventuais informações inverídicas.

CLÁUSULA 6ª — DA TRANSFERÊNCIA
O(A) COMPRADOR(A) responsabiliza-se pela transferência junto ao DETRAN no prazo legal, correndo por sua conta as respectivas despesas.

Parágrafo único: ficam as partes cientes de que o presente contrato obriga exclusivamente as partes signatárias, nos termos do Código Civil Brasileiro.`,

  "recibo-pagamento": (d) => `RECIBO DE PAGAMENTO

Recebi de ${fill(d.pagador_nome)}, inscrito(a) no CPF/CNPJ sob nº ${fill(d.pagador_cpf_cnpj)}, a importância de R$ ${brl(fill(d.valor))}, referente a ${fill(d.referente_a, LONG_BLANK)}, dando plena, geral e irrevogável quitação do valor recebido.

${d.parcelamento === "true" ? `PARCELAMENTO: pagamento em ${fill(d.numero_parcelas)} parcelas de R$ ${fill(d.valor_parcela)} cada, regidas pelo Livro de Recibos vinculado a este documento.\n\n` : ""}Local e data: ${fill(d.cidade)}, ${fill(d.data)}.

Declarações do recebedor: o valor recebido não inclui tributos retidos por lei, quando aplicáveis, e este recibo não substitui nota fiscal.`,

  "declaracao-residencia": (d) => `DECLARAÇÃO DE RESIDÊNCIA

Eu, ${fill(d.declarante_nome)}, inscrito(a) no CPF sob nº ${fill(d.declarante_cpf)}, RG nº ${fill(d.declarante_rg)}, profissão ${fill(d.declarante_profissao)}, declaro, para os devidos fins e sob as penas da lei, que resido no seguinte endereço:

Rua/Logradouro: ${fill(d.endereco_rua)}, nº ${fill(d.endereco_numero)}${d.endereco_complemento ? ` — ${d.endereco_complemento}` : ""}
Bairro: ${fill(d.endereco_bairro)}    CEP: ${fill(d.endereco_cep)}
Cidade/UF: ${fill(d.endereco_cidade)}/${fill(d.endereco_estado)}

DECLARAÇÃO SOB AS PENAS DA LEI
Declaro estar ciente de que a falsidade desta declaração configura crime previsto no Art. 299 do Código Penal (falsidade ideológica), punido com reclusão e multa, além das demais sanções civis e administrativas cabíveis.

Por ser expressão da verdade, firmo a presente declaração.`,

  "contrato-aluguel-simples": (d) => `CONTRATO DE LOCAÇÃO RESIDENCIAL SIMPLES

As partes qualificadas abaixo celebram o presente Contrato de Locação do imóvel descrito, que se regerá pela Lei nº 8.245/91 (Lei do Inquilinato) e pelas cláusulas seguintes.

CLÁUSULA 1ª — DAS PARTES
LOCADOR(A): ${fill(d.locador_nome)}, CPF/CNPJ nº ${fill(d.locador_cpf_cnpj)}, RG nº ${fill(d.locador_rg)}, residente em ${fill(d.locador_endereco, LONG_BLANK)}.
LOCATÁRIO(A): ${fill(d.locatario_nome)}, CPF/CNPJ nº ${fill(d.locatario_cpf_cnpj)}, RG nº ${fill(d.locatario_rg)}, residente em ${fill(d.locatario_endereco, LONG_BLANK)}.

CLÁUSULA 2ª — DO IMÓVEL
O imóvel locado situa-se em ${fill(d.imovel_endereco, LONG_BLANK)}, destinado a fins ${String(d.imovel_finalidade ?? "Residencial").toLowerCase()}.

CLÁUSULA 3ª — DO VALOR E DO VENCIMENTO
O aluguel mensal é de R$ ${brl(fill(d.valor_aluguel))}, vencível todo dia ${fill(d.dia_vencimento)} de cada mês, mediante recibo ou comprovante de pagamento.

CLÁUSULA 4ª — DA DURAÇÃO
O presente contrato terá a duração de ${fill(d.duracao_meses)} meses, iniciando em ${fill(d.data_inicio)}, prorrogável por acordo entre as partes.

CLÁUSULA 5ª — DA GARANTIA
A garantia contratada é: ${fill(d.forma_garantia, "Sem garantia")}${d.valor_caucao ? `, no valor de R$ ${brl(d.valor_caucao)}` : ""}, que responderá por eventuais débitos e danos, nos termos da lei.

CLÁUSULA 6ª — DAS OBRIGAÇÕES
O(A) LOCATÁRIO(A) obriga-se a usar o imóvel conforme a finalidade pactuada, conservá-lo e pagar pontualmente os encargos; o(A) LOCADOR(A) garante o uso pacífico do imóvel durante a locação.`,

  "curriculo-profissional": (d) => {
    const skills = String(d.habilidades ?? "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const bullet = (label: string, value?: string) => (value ? `${label}: ${value}` : null);
    const exp2Lines = [
      bullet("Cargo", d.exp2_cargo),
      bullet("Empresa", d.exp2_empresa),
      bullet("Período", d.exp2_periodo),
      d.exp2_descricao ? d.exp2_descricao : null,
    ].filter(Boolean) as string[];

    return `CURRÍCULO PROFISSIONAL

${(d.nome_completo ?? "").toUpperCase()}
${d.cargo_objetivo ?? ""}

CONTATO
${[d.telefone, d.email, d.cidade_uf, d.linkedin].filter(Boolean).join("  ·  ")}

RESUMO PROFISSIONAL
${d.resumo_profissional ?? ""}

EXPERIÊNCIA PROFISSIONAL
${d.exp1_cargo ?? ""} — ${d.exp1_empresa ?? ""} (${d.exp1_periodo ?? ""})
${d.exp1_descricao ?? ""}
${exp2Lines.length > 0 ? `\n${d.exp2_cargo ?? ""} — ${d.exp2_empresa ?? ""} (${d.exp2_periodo ?? ""})\n${exp2Lines.slice(3).join("\n")}\n` : ""}FORMAÇÃO ACADÊMICA
${d.formacao_curso ?? ""} — ${d.formacao_instituicao ?? ""} (${d.formacao_periodo ?? ""})

HABILIDADES
${skills.map((s) => `• ${s}`).join("\n")}

IDIOMAS
${d.idiomas ?? "Português — Nativo"}`;
  },
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
    case "curriculo-profissional":
      return [`${d.nome_completo ?? "Candidato(a)"} — Assinatura digital`];
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
    data.cidade_uf ??
    (data.endereco_cidade && data.endereco_estado
      ? `${data.endereco_cidade}/${data.endereco_estado}`
      : undefined);
  const date = data.data_venda ?? data.data ?? data.data_assinatura ?? new Date().toLocaleDateString("pt-BR");

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
