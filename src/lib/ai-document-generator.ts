import { getSchemaFieldKeys } from "./document-schemas";

export type AiProvider = "gemini" | "groq";

/**
 * Calls the serverless route /api/generate-document, which uses the
 * GEMINI_API_KEY or GROQ_API_KEY server-side env vars (never exposed
 * to the browser).
 */
export async function generateDocumentData({
  freeText,
  documentType,
  provider,
}: {
  freeText: string;
  documentType: string;
  provider: AiProvider;
}): Promise<Record<string, string>> {
  const res = await fetch("/api/generate-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ freeText, documentType, provider }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Erro ${res.status} ao gerar documento`);
  }

  const body = (await res.json()) as { data: Record<string, string> };

  // Normaliza: garante todas as chaves do schema (string vazia quando ausente)
  const keys = getSchemaFieldKeys(documentType);
  const data: Record<string, string> = {};
  for (const key of keys) {
    data[key] = String(body.data?.[key] ?? "");
  }
  return { ...data, ...body.data };
}
