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
  "contrato-compra-venda-imovel": 9.9,
  "contrato-prestacao-servicos": 7.9,
  "contrato-empreitada": 9.9,
  "acordo-confidencialidade": 7.9,
  "termo-vistoria-imovel": 5.0,
  "declaracao-quitacao": 5.0,
  "declaracao-renda-autonomo": 5.0,
  "contrato-redes-sociais": 7.9,
  "acordo-parceria-comercial": 9.9,
  "termo-rescisao-quitacao": 5.0,
  "recibo-aluguel-encargos": 5.0,
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

  "declaracao-renda-autonomo": (d) => `DECLARAÇÃO DE TRABALHO / RENDA — AUTÔNOMO(A)

Eu, ${fill(d.prestador_nome)}, inscrito(a) no CPF sob nº ${fill(d.prestador_cpf)},${d.cnpj_mei ? ` titular do CNPJ/MEI nº ${d.cnpj_mei},` : ""} exerço a atividade de ${fill(d.profissao_atividade)} de forma autônoma, declaro para os devidos fins${d.finalidade ? ` (${d.finalidade.toLowerCase()})` : ""} que:

1. Minha renda mensal média é de R$ ${brl(fill(d.renda_mensal_media))}, apurada no período de ${fill(d.periodo_referencia, "ativação recente")}.
2. Atendo habitualmente os seguintes clientes/empregadores: ${fill(d.clientes_principais, "____________________________________________")}.
3. Não mantenho vínculo empregatício formal com os contratantes, prestando serviços com autonomia técnica e financeira.

DECLARAÇÃO SOB AS PENAS DA LEI
Declaro estar ciente de que a falsidade desta declaração configura crime previsto no Art. 299 do Código Penal, sem prejuízo das sanções civis e administrativas cabíveis.

Por ser expressão da verdade, firmo a presente declaração.`,

  "declaracao-quitacao": (d) => `DECLARAÇÃO DE QUITAÇÃO DE DÉBITOS

Eu, ${fill(d.credor_nome)}, inscrito(a) no CPF/CNPJ sob nº ${fill(d.credor_cpf_cnpj)}, DECLARO, para os devidos fins de direito, ter recebido de ${fill(d.devedor_nome)}, inscrito(a) no CPF/CNPJ sob nº ${fill(d.devedor_cpf_cnpj)}, a importância de R$ ${brl(fill(d.valor_quitado))}${d.forma_pagamento ? ` (${d.forma_pagamento})` : ""}, referente a ${fill(d.divida_descricao, LONG_BLANK)}.

Declaro, assim, o débito total e definitivamente QUITADO, dando plena, geral e irrevogável quitação, nada mais tendo a reclamar, a qualquer título, presente ou futuro, em razão do objeto acima.

A presente declaração é feita por ato voluntário, na presença das testemunhas abaixo (opcional), e produz efeitos legais a partir de sua assinatura.`,

  "termo-vistoria-imovel": (d) => `TERMO DE VISTORIA DE IMÓVEL${d.tipo_vistoria ? ` — ${d.tipo_vistoria.toUpperCase()}` : ""}

Realizei, na data indicada abaixo, vistoria${d.tipo_vistoria ? ` de ${d.tipo_vistoria.toLowerCase()}` : ""} no imóvel situado em ${fill(d.imovel_endereco, LONG_BLANK)}, com a presença de ${fill(d.locador_nome, "________________")} (Locador) e ${fill(d.locatario_nome, "________________")} (Locatário)${d.vistoriador_nome ? `, conduzida por ${d.vistoriador_nome}` : ""}.

CHECKLIST DE CONSERVAÇÃO
• Paredes / Pintura: ${fill(d.estado_paredes)}
• Piso: ${fill(d.estado_piso)}
• Instalação elétrica: ${fill(d.estado_eletrica)}
• Instalação hidráulica: ${fill(d.estado_hidraulica)}
• Móveis e equipamentos entregues: ${fill(d.moveis_equipamentos, LONG_BLANK)}
• Chaves entregues: ${fill(d.chaves_entregues)}
• Observações / avarias: ${fill(d.observacoes, LONG_BLANK)}

As partes declaram que as informações acima refletem o estado real do imóvel no momento da vistoria, servindo como parâmetro comparativo para a vistoria de saída e para a devolução da caução, nos termos da Lei nº 8.245/91.

${d.tipo_vistoria === "Saída" ? "Com a vistoria de saída, declaro ainda RECEBER AS CHAVES do imóvel, encerrando a posse direta pelo(a) locatário(a)." : "Ficam formalmente entregues as chaves descritas acima ao(à) locatário(a), que passa a deter a posse direta do imóvel."}`,

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

  "contrato-compra-venda-imovel": (d) => `CONTRATO PARTICULAR DE COMPRA E VENDA DE IMÓVEL

Aos ${fill(d.data_assinatura)}, na cidade de ${fill(d.cidade)}, as partes qualificadas abaixo celebram o presente Contrato de Compra e Venda de Imóvel, regido pelo Código Civil Brasileiro.

CLÁUSULA 1ª — DAS PARTES
VENDEDOR(A): ${fill(d.vendedor_nome)}, ${fill(d.vendedor_estado_civil, "estado civil ______________")}, CPF/CNPJ nº ${fill(d.vendedor_cpf_cnpj)}, residente em ${fill(d.vendedor_endereco, LONG_BLANK)}.
COMPRADOR(A): ${fill(d.comprador_nome)}, ${fill(d.comprador_estado_civil, "estado civil ______________")}, CPF/CNPJ nº ${fill(d.comprador_cpf_cnpj)}, residente em ${fill(d.comprador_endereco, LONG_BLANK)}.

CLÁUSULA 2ª — DO OBJETO
O(A) VENDEDOR(A) vende ao(à) COMPRADOR(A), que declara aceitar, o imóvel urbano situado em ${fill(d.imovel_endereco, LONG_BLANK)}, inscrito na Matrícula nº ${fill(d.imovel_matricula)} do respectivo Registro de Imóveis, com área/descrição: ${fill(d.imovel_area, "a conferir por ocasião da escritura")}.

CLÁUSULA 3ª — DO PREÇO E DA FORMA DE PAGAMENTO
O preço total da venda é de R$ ${brl(fill(d.valor_venda))}, pago da seguinte forma: ${fill(d.forma_pagamento, "________________________________")}.

CLÁUSULA 4ª — DA ENTREGA
A entrega das chaves e da posse do imóvel ocorrerá em ${fill(d.data_entrega_chaves)}, acompanhada dos documentos de propriedade e comprovantes de quitação de tributos e condomínio.

CLÁUSULA 5ª — DAS GARANTIAS
O(A) VENDEDOR(A) declara que o imóvel está livre de ônus, hipotecas, ações e dívidas, respondendo civilmente por eventuais informações inverídicas. A escritura definitiva será lavrada em cartório, correndo as despesas conforme acordo entre as partes.

Parágrafo único: ficam as partes cientes de que o presente contrato obriga exclusivamente as partes signatárias, nos termos do Código Civil Brasileiro.`,

  "contrato-prestacao-servicos": (d) => `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Aos ${fill(d.data_assinatura)}, na cidade de ${fill(d.cidade)}, as partes celebram o presente Contrato de Prestação de Serviços, regido pelos Arts. 593 a 609 do Código Civil.

CLÁUSULA 1ª — DAS PARTES
PRESTADOR(A): ${fill(d.prestador_nome)}, CPF/CNPJ nº ${fill(d.prestador_cpf_cnpj)}, residente em ${fill(d.prestador_endereco, LONG_BLANK)}.
CONTRATANTE: ${fill(d.contratante_nome)}, CPF/CNPJ nº ${fill(d.contratante_cpf_cnpj)}, residente em ${fill(d.contratante_endereco, LONG_BLANK)}.

CLÁUSULA 2ª — DO OBJETO E DO ESCOPO
O(A) PRESTADOR(A) obriga-se a executar, com autonomia técnica e sem subordinação, os seguintes serviços: ${fill(d.servico_descricao, LONG_BLANK)}
Local de execução: ${fill(d.local_execucao, "a combinar entre as partes")}.

CLÁUSULA 3ª — DA REMUNERAÇÃO
pelos serviços descritos, o(A) CONTRATANTE pagará R$ ${brl(fill(d.valor_total))}, conforme a forma combinada: ${fill(d.forma_pagamento, "a definir entre as partes")}. A ausência de pagamento na data pactuada sujeita o valor à correção e multa legal.

CLÁUSULA 4ª — DO PRAZO
A execução deverá ser concluída no prazo de ${fill(d.prazo_entrega, "____ dias corridos")}, contados da assinatura, prorrogável por acordo escrito entre as partes.

CLÁUSULA 5ª — DAS OBRIGAÇÕES
O(A) PRESTADOR(A) responde pela qualidade e pela confidencialidade das informações acessadas; o(A) CONTRATANTE fornecerá as informações e o acesso necessários à execução. Este contrato não gera vínculo empregatício (Art. 594, CC).`,

  "contrato-empreitada": (d) => `CONTRATO DE EMPREITADA (OBRA / REFORMA)

Aos ${fill(d.data_assinatura)}, na cidade de ${fill(d.cidade)}, as partes celebram o presente Contrato de Empreitada por preço certo, regido pelos Arts. 610 a 620 do Código Civil.

CLÁUSULA 1ª — DAS PARTES
EMPREITEIRO(A): ${fill(d.empreiteiro_nome)}, CPF/CNPJ nº ${fill(d.empreiteiro_cpf_cnpj)}.
CONTRATANTE (PROPRIETÁRIO): ${fill(d.contratante_nome)}, CPF/CNPJ nº ${fill(d.contratante_cpf_cnpj)}.

CLÁUSULA 2ª — DO OBJETO
O(A) EMPREITEIRO(A) executará, por sua conta e risco, com material e mão de obra, a obra/reforma no imóvel situado em ${fill(d.obra_endereco, LONG_BLANK)}, compreendendo: ${fill(d.obra_descricao, LONG_BLANK)}

CLÁUSULA 3ª — DO PREÇO E DAS MEDIÇÕES
O preço global da empreitada é de R$ ${brl(fill(d.valor_global))}, pago conforme: ${fill(d.forma_pagamento, "medições a combinar")}. O pagamento de cada medição estará condicionado à conferência da etapa executada pelo(A) CONTRATANTE.

CLÁUSULA 4ª — DO PRAZO E DO INÍCIO
O início dos serviços ocorrerá em ${fill(d.data_inicio)}, com execução no prazo de ${fill(d.prazo_dias, "____ dias corridos")}. Atrasos imputáveis ao(A) EMPREITEIRO(A) sujeitam-no às penalidades da Cláusula 6ª.

CLÁUSULA 5ª — DA GARANTIA
O(A) EMPREITEIRO(A) garante a solidez e segurança da obra pelo prazo legal de 5 anos (Art. 618, CC), respondendo ainda pela conservação dos materiais entregues.

CLÁUSULA 6ª — DAS PENALIDADES E RESCISÃO
Atrazo injustificado sujeita o(A) EMPREITEIRO(A) a multa de 2% sobre o valor global por mês de atraso, além de perdas e danos. A rescisão unilateral sem culpa não dará direito a indenização por lucros cessantes (Art. 612, CC).`,

  "acordo-confidencialidade": (d) => `ACORDO DE CONFIDENCIALIDADE (NDA — NON-DISCLOSURE AGREEMENT)

Aos ${fill(d.data_assinatura)}, na cidade de ${fill(d.cidade)}, as partes celebram o presente Acordo de Confidencialidade, regido pelo Código Civil e pela Lei nº 9.279/96.

CLÁUSULA 1ª — DAS PARTES
PARTE REVELADORA: ${fill(d.parte_reveladora)}, inscrito(a) no CPF/CNPJ sob nº ${fill(d.parte_reveladora_doc)}.
PARTE RECEPTORA: ${fill(d.parte_receptora)}, inscrito(a) no CPF/CNPJ sob nº ${fill(d.parte_receptora_doc)}.

CLÁUSULA 2ª — DO OBJETO E DA FINALIDADE
Considera-se informação confidencial toda informação técnica, comercial, financeira ou de outra natureza relacionada a ${fill(d.objeto_confidencialidade, LONG_BLANK)}, compartilhada para a finalidade de ${fill(d.finalidade_uso, "avaliação entre as partes")}.

CLÁUSULA 3ª — DAS OBRIGAÇÕES DA PARTE RECEPTORA
A PARTE RECEPTORA compromete-se a: (i) manter sigilo absoluto sobre as Informações; (ii) utilizá-las exclusivamente para a finalidade acima; (iii) restringir o acesso a colaboradores sob igual dever; (iv) devolver ou destruir todo material quando solicitado.

CLÁUSULA 4ª — DAS EXCEÇÕES
Não se considera confidencial a informação que: seja de domínio público; já fosse lícitamente detida anteriormente; seja desenvolvida de forma independente; ou sua divulgação seja exigida por lei ou ordem judicial.

CLÁUSULA 5ª — DO PRAZO E DA MULTA
O dever de sigilo permanece por ${fill(d.prazo_anos, "____ anos")} contados da assinatura. O descumprimento sujeita a parte infratora à multa não compensatória de R$ ${brl(fill(d.multa_valor, "valor a arbitrar judicialmente"))}, sem prejuízo de perdas e danos.

CLÁUSULA 6ª — DO FORO
Fica eleito o foro da comarca de ${fill(d.foro_cidade, "________________")}, para dirimir controvérsias decorrentes deste acordo.`,

  "contrato-redes-sociais": (d) => `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DIGITAIS — REDES SOCIAIS E TRÁFEGO

Aos ${fill(d.data_assinatura)}, na cidade de ${fill(d.cidade)}, as partes celebram o presente Contrato de Prestação de Serviços Digitais, regido pelo Código Civil.

CLÁUSULA 1ª — DAS PARTES
PRESTADOR(A): ${fill(d.agencia_nome)}, CPF/CNPJ nº ${fill(d.agencia_cpf_cnpj)}.
CLIENTE: ${fill(d.cliente_nome)}, CPF/CNPJ nº ${fill(d.cliente_cpf_cnpj)}.

CLÁUSULA 2ª — DO OBJETO E DO ESCOPO
O(A) PRESTADOR(A) prestará serviços de gestão de conteúdo e tráfego para as redes ${fill(d.redes_atendidas, "a definir")}, compreendendo: ${fill(d.escopo_servicos, LONG_BLANK)}

CLÁUSULA 3ª — DA VERBA DE MÍDIA
A verba de anúncios (mídia paga) é de R$ ${brl(fill(d.verba_midia, "a definir"))} mensais, paga diretamente pelo CLIENTE às plataformas, não compondo os honorários do prestador.

CLÁUSULA 4ª — DOS HONORÁRIOS E DO VENCIMENTO
pelos serviços descritos, o CLIENTE pagará honorários mensais de R$ ${brl(fill(d.honorarios_mensais))}, vencíveis em ${fill(d.dia_vencimento, "data a combinar")}, mediante nota/recibo.

CLÁUSULA 5ª — DO PRAZO E DAS METAS
O contrato vigorará por ${fill(d.prazo_contrato, "prazo a combinar")}. ${d.meta_kpi ? `Metas de desempenho pactuadas (informativas, salvo disposição em contrário): ${d.meta_kpi}.` : "As partes poderão pactuar metas de desempenho em aditivo."} Resultados de plataformas digitais dependem de fatores externos à gestão (algoritmos, verba, mercado).

CLÁUSULA 6ª — DA PROPRIEDADE E DA CONFIDENCIALIDADE
Perfis, senhas e verbas pertencem ao CLIENTE; os conteúdos criados e aprovados poderão ser reutilizados pelo cliente em suas canais. O prestador manterá sigilo sobre dados de acesso e métricas do negócio.`,

  "acordo-parceria-comercial": (d) => `ACORDO DE PARCERIA COMERCIAL / SOCIEDADE SIMPLES

Aos ${fill(d.data_assinatura)}, na cidade de ${fill(d.cidade)}, os parceiros celebram o presente Acordo, regido pelos Arts. 986 a 990 do Código Civil.

CLÁUSULA 1ª — DOS PARCEIROS
1º PARCEIRO(A): ${fill(d.parceiro1_nome)}, CPF/CNPJ nº ${fill(d.parceiro1_cpf_cnpj)}.
2º PARCEIRO(A): ${fill(d.parceiro2_nome)}, CPF/CNPJ nº ${fill(d.parceiro2_cpf_cnpj)}.

CLÁUSULA 2ª — DO OBJETO
Os parceiros unem esforços e recursos para a exploração comum de: ${fill(d.objeto_parceria, LONG_BLANK)}

CLÁUSULA 3ª — DAS CONTRIBUIÇÕES
• 1º Parceiro: ${fill(d.contribuicao_parceiro1, "a registrar")}
• 2º Parceiro: ${fill(d.contribuicao_parceiro2, "a registrar")}
As contribuições podem ser em capital, bens ou trabalho, conforme arts. 986 e 1.056 do CC.

CLÁUSULA 4ª — DOS LUCROS E DOS PREJUÍZOS
Divisão de lucros: ${fill(d.divisao_lucros, "proporcional às contribuições")}. Divisão de prejuízos: ${fill(d.divisao_prejuizos, "proporcional às contribuições")}.

CLÁUSULA 5ª — DA ADMINISTRAÇÃO
A administração do negócio caberá: ${fill(d.administracao, "forma a ser definida pelos parceiros")}. Atos de disposição sobre bens comuns dependerão da aprovação de todos os parceiros (Art. 1.023, CC).

CLÁUSULA 6ª — DO PRAZO, DO FORO E DA DISSOLUÇÃO
Prazo: ${fill(d.prazo_duracao, "indeterminado")}. Na dissolução, apurar-se-á o acervo e ratear-se-ão resultados na proporção das contribuições. Foro de eleição: ${fill(d.foro_cidade, "comarca a eleger")}.`,

  "termo-rescisao-quitacao": (d) => `TERMO DE RESCISÃO CONTRATUAL E QUITAÇÃO MÚTUA

Aos ${fill(d.data_assinatura)}, na cidade de ${fill(d.cidade)}, as partes celebram o presente Termo de Rescisão, por mútuo e expresso acordo, observado o princípio da liberdade contratual (Art. 421 do CC).

CLÁUSULA 1ª — DO CONTRATO RESCINDIDO
Fica RESCINDIDO, em todos os seus termos, o contrato: ${fill(d.contrato_original, "contrato firmado entre as partes")}, celebrado entre ${fill(d.parte1_nome)} (CPF/CNPJ nº ${fill(d.parte1_cpf_cnpj)}) e ${fill(d.parte2_nome)} (CPF/CNPJ nº ${fill(d.parte2_cpf_cnpj)}).

CLÁUSULA 2ª — DO MOTIVO E DOS EFEITOS
A rescisão decorre de: ${fill(d.motivo_rescisao, "comum acordo entre as partes")}, produzindo efeitos a partir de ${fill(d.data_efetivacao, "data da assinatura")}.

CLÁUSULA 3ª — DO ACERTO FINANCEIRO E DAS OBRIGAÇÕES
• Acerto financeiro: ${fill(d.acerto_financeiro, "nada a acertar entre as partes")}
• Obrigações pendentes: ${fill(d.obrigacoes_restantes, "nenhuma pendência restante")}
• Multa rescisória: ${fill(d.multa_rescitoria, "isenta, por acordo")}

CLÁUSULA 4ª — DA QUITAÇÃO MÚTUA
Com o cumprimento do disposto acima, as partes outorgam-se RECIPROCAMENTE PLENA, GERAL E IRREVOGÁVEL QUITAÇÃO referente ao contrato rescindido, nada mais tendo a reclamar, a qualquer título, presente ou futuro.

CLÁUSULA 5ª — DAS TESTEMUNHAS
As partes elegem 2 (duas) testemunhas para firmar o presente instrumento, recomendando-se o registro em cartório para maior robustez probatória.`,

  "recibo-aluguel-encargos": (d) => {
    const num = (v?: string) => {
      const n = Number(String(v ?? "").replace(/\\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    const aluguel = num(d.valor_aluguel);
    const total = aluguel + num(d.valor_iptu) + num(d.valor_condominio) + num(d.valor_agua) + num(d.outros_encargos) - num(d.descontos);
    const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const linha = (label: string, v?: string) => ({ label, v: num(v) });
    const encargos = [
      linha("Aluguel", d.valor_aluguel),
      linha("IPTU", d.valor_iptu),
      linha("Condomínio", d.valor_condominio),
      linha("Água/Energia", d.valor_agua),
      linha("Outros encargos", d.outros_encargos),
    ].filter((e) => e.v > 0);

    return `RECIBO DE ALUGUEL COM ENCARGOS

Recebi de ${fill(d.locatario_nome)}, inscrito(a) no CPF/CNPJ sob nº ${fill(d.locatario_cpf_cnpj)}, a importância apurada abaixo, referente à locação do imóvel situado em ${fill(d.imovel_endereco, LONG_BLANK)}, competência ${fill(d.mes_referencia, "mês corrente")}.

DEMONSTRATIVO${d.descontos && num(d.descontos) > 0 ? " (com descontos)" : ""}
${encargos.length > 0 ? encargos.map((e) => `• ${e.label}: R$ ${fmt(e.v)}`).join("\n") : `• Aluguel: R$ ${fmt(aluguel)}`}${num(d.descontos) > 0 ? `\n• Descontos: - R$ ${fmt(num(d.descontos))}` : ""}

TOTAL RECEBIDO: R$ ${fmt(total > 0 ? total : aluguel)}${d.forma_pagamento ? ` — via ${d.forma_pagamento}` : ""}, dando plena, geral e irrevogável quitação das importâncias relativas à competência acima.

Local e data: ${fill(d.cidade)}, ${fill(d.data_pagamento)}.

Declarações do recebedor: este recibo não substitui nota fiscal; encargos não discriminados acima não foram objeto deste pagamento.`;
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
    case "contrato-compra-venda-imovel":
      return [`${d.vendedor_nome ?? "Vendedor(a)"} — Vendedor(a)`, `${d.comprador_nome ?? "Comprador(a)"} — Comprador(a)`];
    case "contrato-prestacao-servicos":
      return [`${d.prestador_nome ?? "Prestador(a)"} — Prestador(a)`, `${d.contratante_nome ?? "Contratante"} — Contratante`];
    case "contrato-empreitada":
      return [`${d.empreiteiro_nome ?? "Empreiteiro(a)"} — Empreiteiro(a)`, `${d.contratante_nome ?? "Contratante"} — Contratante`];
    case "acordo-confidencialidade":
      return [`${d.parte_reveladora ?? "Parte Reveladora"} — Reveladora`, `${d.parte_receptora ?? "Parte Receptora"} — Receptora`];
    case "termo-vistoria-imovel":
      return [`${d.locador_nome ?? "Locador(a)"} — Locador(a)`, `${d.locatario_nome ?? "Locatário(a)"} — Locatário(a)`];
    case "declaracao-quitacao":
      return [`${d.credor_nome ?? "Credor(a)"} — Credor(a)`, `${d.devedor_nome ?? "Devedor(a)"} — Devedor(a)`];
    case "declaracao-renda-autonomo":
      return [`${d.prestador_nome ?? "Declarante"} — Declarante`];
    case "contrato-redes-sociais":
      return [`${d.agencia_nome ?? "Prestador(a)"} — Prestador(a)`, `${d.cliente_nome ?? "Cliente"} — Cliente`];
    case "acordo-parceria-comercial":
      return [`${d.parceiro1_nome ?? "1º Parceiro(a)"} — 1º Parceiro(a)`, `${d.parceiro2_nome ?? "2º Parceiro(a)"} — 2º Parceiro(a)`];
    case "termo-rescisao-quitacao":
      return [`${d.parte1_nome ?? "1ª Parte"} — 1ª Parte`, `${d.parte2_nome ?? "2ª Parte"} — 2ª Parte`];
    case "recibo-aluguel-encargos":
      return [`${d.locador_nome ?? "Locador(a)"} — Locador(a) Recebedor(a)`];
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
