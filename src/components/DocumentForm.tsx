import React, { useState } from "react";
import { motion } from "framer-motion";
import { getFields, getDocType, getPrice } from "@/lib/pdf-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}

export function DocumentForm({
  documentType,
  onSubmit,
  onSaveDraft,
  isLoading,
  submitLabel,
  hideDraft,
}: DocumentFormProps) {
  const fields = getFields(documentType);
  const docType = getDocType(documentType);
  const price = getPrice(documentType);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const missing = fields.filter((f) => f.required && !formData[f.key]?.trim());
  const isValid = missing.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setTouched(Object.fromEntries(fields.map((f) => [f.key, true])));
      return;
    }
    onSubmit(formData);
  };

  const handleSaveDraft = () => {
    if (!onSaveDraft) return;
    if (!isValid) {
      setTouched(Object.fromEntries(fields.map((f) => [f.key, true])));
      return;
    }
    onSaveDraft(formData);
  };

  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600/30 to-cyan-500/20 text-2xl ring-1 ring-white/10">
            {docType?.icon ?? "📄"}
          </span>
          <span>
            {docType?.name ?? documentType}
            <span className="mt-0.5 block text-xs font-normal text-slate-400">
              Preenchimento gratuito · PDF oficial por R$ {price.toFixed(2).replace(".", ",")}
            </span>
          </span>
        </CardTitle>
        <CardDescription className="pt-1">
          Campos com <span className="text-purple-400">*</span> são obrigatórios. Rascunho salvo é grátis; o Pix é só no PDF oficial.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((field, i) => {
              const invalid = touched[field.key] && field.required && !formData[field.key]?.trim();
              return (
                <motion.div
                  key={field.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                  className={field.key.includes("endereco") || field.key.includes("descricao") ? "sm:col-span-2" : ""}
                >
                  <Label htmlFor={field.key} className="mb-1.5 block text-slate-300">
                    {field.label}
                    {field.required && <span className="ml-1 text-purple-400">*</span>}
                  </Label>
                  <Input
                    id={field.key}
                    placeholder={field.placeholder}
                    value={formData[field.key] ?? ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, [field.key]: true }))}
                    className={`field-neon ${invalid ? "border-red-500/60 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]" : ""}`}
                    aria-invalid={!!invalid}
                  />
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
            })}
          </div>

          <div className="flex flex-col gap-3 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-end">
            {!hideDraft && onSaveDraft && (
              <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isLoading} className="sm:mr-auto">
                💾 Salvar Rascunho (grátis)
              </Button>
            )}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className={hideDraft || !onSaveDraft ? "sm:ml-auto" : ""}>
              <Button type="submit" size="lg" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                      className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                    />
                    Processando...
                  </span>
                ) : (
                  submitLabel ?? `⚡ Gerar Documento Oficial (R$ ${price.toFixed(2).replace(".", ",")})`
                )}
              </Button>
            </motion.div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
