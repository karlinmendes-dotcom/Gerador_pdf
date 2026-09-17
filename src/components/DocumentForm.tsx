import React, { useState } from "react";
import { motion } from "framer-motion";
import { getSchema, type FieldDef } from "@/lib/document-schemas";
import { getPrice } from "@/lib/pdf-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GovBrGuide } from "@/components/GovBrGuide";

interface DocumentFormProps {
  documentType: string;
  /** Chamado quando o usuário clica em "Gerar Documento Oficial (R$ X)". */
  onSubmit: (data: Record<string, string>) => void;
  /** Chamado quando o usuário salva apenas o rascunho (grátis). */
  onSaveDraft?: (data: Record<string, string>) => void;
  isLoading?: boolean;
  submitLabel?: string;
  /** Esconde o botão de rascunho (ex: quick generate na landing). */
  hideDraft?: boolean;
  /** Esconde o guia Gov.br (quando já exibido fora do form). */
  hideGovGuide?: boolean;
}

export function DocumentForm({
  documentType,
  onSubmit,
  onSaveDraft,
  isLoading,
  submitLabel,
  hideDraft,
  hideGovGuide,
}: DocumentFormProps) {
  const schema = getSchema(documentType);
  const price = getPrice(documentType);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // REGRA DE NEGÓCIO: nenhum campo é obrigatório — o PDF é gerado mesmo com
  // campos em branco (o motor desenha linhas "____" para preenchimento à
  // caneta após a impressão). Campos marcados como required no schema são
  // tratados apenas como "recomendados".
  const recommended = schema.fields.filter(
    (f) => f.required && !String(formData[f.key] ?? "").trim()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleSaveDraft = () => {
    onSaveDraft?.(formData);
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-2xl">
            {schema.icon}
          </span>
          <span>
            {schema.title}
            <span className="mt-0.5 block text-xs font-normal text-slate-400">
              Preenchimento gratuito · PDF oficial por R$ {price.toFixed(2).replace(".", ",")}
            </span>
          </span>
        </CardTitle>
        <CardDescription className="pt-1">
          {schema.description} Preencha apenas o que quiser — campos deixados em
          branco viram linhas para preenchimento à caneta no PDF.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {schema.fields.map((field, i) => (
              <FieldInput
                key={field.key}
                field={field}
                value={formData[field.key] ?? ""}
                invalid={false}
                onChange={(v) => handleChange(field.key, v)}
                onBlur={() => undefined}
                index={i}
              />
            ))}
          </div>

          {recommended.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              Dica: <strong>{recommended.length} campo{recommended.length > 1 ? "s" : ""} recomendado{recommended.length > 1 ? "s" : ""}</strong>{" "}
              {recommended.length > 1 ? "estão" : "está"} em branco ({recommended.slice(0, 3).map((f) => f.label).join(", ")}
              {recommended.length > 3 ? "…" : ""}). Você pode gerar assim mesmo e completar à caneta.
            </p>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
            {!hideDraft && onSaveDraft && (
              <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isLoading} className="sm:mr-auto">
                Salvar Rascunho (grátis)
              </Button>
            )}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={hideDraft || !onSaveDraft ? "sm:ml-auto" : ""}
            >
              <Button type="submit" size="lg" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                      className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-blue-600"
                    />
                    Processando...
                  </span>
                ) : (
                  submitLabel ?? `Gerar Documento Oficial (R$ ${price.toFixed(2).replace(".", ",")})`
                )}
              </Button>
            </motion.div>
          </div>

          {!hideGovGuide && <GovBrGuide compact />}
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Campo individual com microinterações ─────────────────────────────

function FieldInput({
  field,
  value,
  invalid,
  onChange,
  onBlur,
  index,
}: {
  field: FieldDef;
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
  index: number;
}) {
  const id = `field-${field.key}`;
  const spanClass = field.full ? "sm:col-span-2" : "";

  const inputClass = `field-neon ${invalid ? "border-red-500/60 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]" : ""}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.025, 0.3) }}
      className={spanClass}
    >
      <Label htmlFor={id} className="mb-1.5 flex items-center justify-between text-slate-600">
        <span>
          {field.label}
          {field.required && <span className="ml-1 text-blue-600">*</span>}
        </span>
        {field.type === "boolean" && (
          <span className="text-[10px] font-normal text-slate-500">opcional</span>
        )}
      </Label>

      {field.type === "boolean" ? (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-blue-400">
          <input
            id={id}
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            onBlur={onBlur}
            className="h-4 w-4 accent-blue-600"
          />
          <span className="text-sm text-slate-600">{field.description ?? "Sim"}</span>
        </label>
      ) : field.type === "enum" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`${inputClass} h-10 w-full rounded-md px-3 text-sm`}
        >
          <option value="">Selecione…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt} className="bg-white text-slate-900">
              {opt}
            </option>
          ))}
        </select>
      ) : field.long ? (
        <Textarea
          id={id}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          rows={2}
          className={inputClass}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={inputClass}
          aria-invalid={invalid}
        />
      )}

      {field.description && field.type !== "boolean" && (
        <p className="pt-1 text-[11px] text-slate-500">{field.description}</p>
      )}

      <motion.div
        initial={false}
        animate={{ height: invalid ? "auto" : 0, opacity: invalid ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <p className="pt-1 text-xs text-red-400">Informe {field.label.toLowerCase()}.</p>
      </motion.div>
    </motion.div>
  );
}
