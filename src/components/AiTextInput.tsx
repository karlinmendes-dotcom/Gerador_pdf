import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateDocumentData, type AiProvider } from "@/lib/ai-document-generator";

interface AiTextInputProps {
  documentType: string;
  onGenerated: (data: Record<string, string>) => void;
  onError: (error: string) => void;
}

const EXAMPLES: Record<string, string> = {
  "compra-venda-veiculo": "Vendi meu VW Gol 2018 prata, placa ABC-1234, RENAVAM 12345678901, pro João da Silva por 20 mil reais. João mora na Rua das Flores, 123 em SP. Eu sou Maria Oliveira, CPF 987.654.321-00, moro na Av. Paulista, 1000. Pagamento em 12x. A venda aconteceu em São Paulo no dia 14/09/2026.",
  "recibo-pagamento": "Pedro Santos pagou R$ 1.500 de aluguel do apartamento de setembro para a Imobiliária ABC (CNPJ 12.345.678/0001-99) em São Paulo, dia 10/09/2026.",
  "declaracao-residencia": "Carlos Mendes, CPF 555.666.777-88, RG 12.345.678-9 SP, mora na Rua Augusta, 500, Apto 42, São Paulo/SP, CEP 01305-100.",
};

export function AiTextInput({ documentType, onGenerated, onError }: AiTextInputProps) {
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [loading, setLoading] = useState(false);
  const info: Record<AiProvider, { name: string }> = {
    gemini: { name: "Google Gemini" },
    groq: { name: "Groq (Llama)" },
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const data = await generateDocumentData({ freeText: text, documentType, provider });
      onGenerated(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao gerar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-xl">✨</span> Gerar com IA
        </CardTitle>
        <CardDescription>Descreva em texto livre — a IA estrutura os dados automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setText(EXAMPLES[documentType] ?? "")}>
          📝 Exemplo
        </Button>

        <div className="space-y-2">
          <Label>Descreva o documento:</Label>
          <Textarea placeholder='Ex: "Vendi meu carro 2018 pro João por 20 mil..."' value={text} onChange={(e) => setText(e.target.value)} rows={4} />
        </div>

        <div className="space-y-2">
          <Label>Provedor</Label>
          <div className="flex gap-2">
            {(["gemini", "groq"] as AiProvider[]).map((p) => (
              <Button key={p} variant={provider === p ? "default" : "outline"} size="sm" onClick={() => setProvider(p)}>
                {info[p].name}
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={loading || !text.trim()} className="w-full" size="lg">
          {loading ? "Processando..." : `🤖 Gerar com ${info[provider].name}`}
        </Button>
      </CardContent>
    </Card>
  );
}
