import React, { useState } from "react";
import { motion } from "framer-motion";
import { getFields, getDocType, getPrice } from "@/lib/pdf-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DocumentFormProps {
  documentType: string;
  onSubmit: (data: Record<string, string>) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function DocumentForm({ documentType, onSubmit, isLoading, submitLabel }: DocumentFormProps) {
  const fields = getFields(documentType);
  const docType = getDocType(documentType);
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
              Preenchimento gratuito · Pix {getPrice(documentType).toFixed(2).replace(".", ",")} só no download
            </span>
          </span>
        </CardTitle>
        <CardDescription className="pt-1">
          Preencha os campos abaixo. Campos com <span className="text-purple-400">*</span> são obrigatórios.
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

          <div className="flex flex-col-reverse items-stretch justify-end gap-3 border-t border-white/5 pt-5 sm:flex-row sm:items-center">
            <p className="text-xs text-slate-500 sm:mr-auto">
              🔒 Pagamento único via Pix · liberado na hora
            </p>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Button type="submit" size="lg" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Gerando...
                  </span>
                ) : (
                  submitLabel ?? "⚡ Gerar e Baixar PDF Oficial"
                )}
              </Button>
            </motion.div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
