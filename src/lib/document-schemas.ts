import veiculo from "../../schemas/compra-venda-veiculo.json";
import recibo from "../../schemas/recibo-pagamento.json";
import residencia from "../../schemas/declaracao-residencia.json";
import aluguel from "../../schemas/contrato-aluguel-simples.json";

// ─── Tipos ────────────────────────────────────────────────────────────

export type FieldType = "string" | "number" | "boolean" | "enum";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
  min?: number;
  max?: number;
  /** Campo texto longo → textarea */
  long?: boolean;
  /** Largura total no grid (campos de endereço/descrição) */
  full?: boolean;
}

export interface DocumentSchema {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  fields: FieldDef[];
}

// ─── Metadados visuais por documento ──────────────────────────────────

const META: Record<string, { icon: string; category: string }> = {
  "compra-venda-veiculo": { icon: "🚗", category: "Veículos" },
  "recibo-pagamento": { icon: "💰", category: "Financeiro" },
  "declaracao-residencia": { icon: "🏠", category: "Pessoal" },
  "contrato-aluguel-simples": { icon: "🔑", category: "Imóveis" },
};

/** Campos renderizados em largura total (endereços, descrições). */
const FULL_WIDTH_KEYS = new Set([
  "vendedor_endereco",
  "comprador_endereco",
  "locador_endereco",
  "locatario_endereco",
  "imovel_endereco",
  "referente_a",
  "parcelamento_detalhe",
]);

/** Campos que renderizam como textarea. */
const LONG_KEYS = new Set(["referente_a", "parcelamento_detalhe"]);

// ─── Conversão JSON Schema → FieldDefs ────────────────────────────────

interface RawSchema {
  id?: string;
  title: string;
  description: string;
  properties: Record<string, RawProperty>;
  required?: string[];
}

interface RawProperty {
  type: string;
  title: string;
  description?: string;
  placeholder?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

function toFieldDefs(raw: RawSchema): FieldDef[] {
  const required = new Set(raw.required ?? []);
  return Object.entries(raw.properties).map(([key, prop]) => ({
    key,
    label: prop.title,
    type: prop.enum ? "enum" : (prop.type as FieldType),
    required: required.has(key),
    placeholder: prop.placeholder,
    description: prop.description,
    options: prop.enum,
    min: prop.minimum,
    max: prop.maximum,
    long: LONG_KEYS.has(key),
    full: FULL_WIDTH_KEYS.has(key),
  }));
}

// ─── Registro de documentos ───────────────────────────────────────────

function build(id: string, raw: RawSchema): DocumentSchema {
  const meta = META[id] ?? { icon: "📄", category: "Geral" };
  return {
    id: raw.id ?? id,
    title: raw.title,
    description: raw.description,
    icon: meta.icon,
    category: meta.category,
    fields: toFieldDefs(raw),
  };
}

export const DOCUMENT_SCHEMAS: Record<string, DocumentSchema> = {
  "compra-venda-veiculo": build("compra-venda-veiculo", veiculo as RawSchema),
  "recibo-pagamento": build("recibo-pagamento", recibo as RawSchema),
  "declaracao-residencia": build("declaracao-residencia", residencia as RawSchema),
  "contrato-aluguel-simples": build("contrato-aluguel-simples", aluguel as RawSchema),
};

export const DOC_IDS = Object.keys(DOCUMENT_SCHEMAS);

export function getSchema(id: string): DocumentSchema {
  return DOCUMENT_SCHEMAS[id] ?? DOCUMENT_SCHEMAS["compra-venda-veiculo"];
}

/** Lista de chaves de campos de um documento (para normalizar saída de IA). */
export function getSchemaFieldKeys(id: string): string[] {
  return getSchema(id).fields.map((f) => f.key);
}
