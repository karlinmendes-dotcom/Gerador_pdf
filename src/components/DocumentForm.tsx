import React, { useState } from "react";
import { getFields, getDocType, type DocType } from "@/lib/pdf-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DocumentFormProps {
  documentType: string;
  onSubmit: (data: Record<string, string>) => void;
  isLoading?: boolean;
}

export function DocumentForm({ documentType, onSubmit, isLoading }: DocumentFormProps) {
  const fields = getFields(documentType);
  const docType = getDocType(documentType);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    const missing = fields.filter((f) => f.required && !formData[f.key]?.trim());
    if (missing.length > 0) {
      alert(`Preencha os campos obrigatórios: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    onSubmit(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {docType?.icon && <span className="text-2xl">{docType.icon}</span>}
          {docType?.name ?? documentType}
        </CardTitle>
        <CardDescription>Preencha os campos abaixo para gerar o documento.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  id={field.key}
                  placeholder={field.placeholder}
                  value={formData[field.key] ?? ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  required={field.required}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isLoading} size="lg">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Gerando...
                </span>
              ) : (
                "📄 Gerar Documento"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
