import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DocumentForm } from "@/components/DocumentForm";
import { useStore } from "@/lib/store";
import { DOC_TYPES, getDocType, generatePdf } from "@/lib/pdf-engine";

export default function LandingPage() {
  const nav = useNavigate();
  const addDocument = useStore((s) => s.addDocument);

  const [quickType, setQuickType] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  /** Quick generation straight from the landing page: form → pdf-engine → download. */
  const handleQuickGenerate = async (data: Record<string, string>) => {
    if (!quickType) return;
    setGenerating(true);
    try {
      const blob = await generatePdf(quickType, data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${getDocType(quickType)?.name ?? "documento"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addDocument({
        userId: useStore.getState().userId,
        documentType: quickType,
        title: `${getDocType(quickType)?.name ?? quickType} — ${new Date().toLocaleDateString("pt-BR")}`,
        dataJson: JSON.stringify(data),
        status: "draft",
      });
    } finally {
      setGenerating(false);
      setQuickType(null);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="text-xl font-bold tracking-tight">PDFForge Brasil</span>
          </div>
          <Button onClick={() => nav("/app")} size="sm">Acessar Plataforma</Button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              🚀 Motor único de formulários e PDF
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
              Documentos Jurídicos
              <span className="block text-primary">em Segundos</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Gere contratos, recibos e declarações profissionais com IA.
              Preencha o formulário e baixe o PDF na hora.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => setQuickType("compra-venda-veiculo")} className="text-lg px-8">
                📝 Gerar Contrato Agora
              </Button>
              <Button size="lg" variant="outline" onClick={() => nav("/app")} className="text-lg px-8">
                Abrir Dashboard
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              ⚡ Geração instantânea • 🤖 IA para preenchimento • 📄 PDF profissional
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Tudo que você precisa</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "🤖", title: "IA que Entende", desc: "Descreva em texto livre. Gemini ou Llama estruturam os dados." },
            { icon: "📋", title: "Formulários Dinâmicos", desc: "Motor configurável via JSON. Novos documentos sem código." },
            { icon: "📄", title: "PDF Profissional", desc: "Geração instantânea com pdfme, direto no navegador." },
            { icon: "📒", title: "Livro de Recibos", desc: "Acompanhe parcelas e comprovantes Pix por contrato." },
            { icon: "📊", title: "Dashboard", desc: "Histórico completo e download a qualquer momento." },
            { icon: "🔐", title: "Dados no Convex", desc: "Metadados e comprovantes salvos no banco Convex." },
          ].map((f, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-1">{f.icon}</div>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent><CardDescription>{f.desc}</CardDescription></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Como Funciona</h2>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "🎯", title: "1. Escolha o documento", desc: "Contrato, recibo ou declaração." },
              { icon: "✨", title: "2. Preencha ou use a IA", desc: "Manual ou por texto livre." },
              { icon: "📥", title: "3. Baixe o PDF", desc: "Gerado na hora, direto do navegador." },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Documentos Disponíveis</h2>
        <p className="text-center text-muted-foreground mb-12">Motor extensível — novos tipos via schema JSON.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {DOC_TYPES.map((doc) => (
            <Card key={doc.id} className="text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setQuickType(doc.id)}>
              <CardHeader>
                <div className="text-5xl mb-2">{doc.icon}</div>
                <CardTitle className="text-base">{doc.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{doc.description}</CardDescription>
                <div className="mt-3">
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">{doc.category}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <Card className="max-w-2xl mx-auto text-center p-8 bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-2xl text-primary-foreground">Pronto para gerar?</CardTitle>
            <CardDescription className="text-primary-foreground/80">É rápido, direto e sem complicação.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" variant="secondary" onClick={() => setQuickType("compra-venda-veiculo")} className="text-lg px-8">
              🚀 Começar Agora
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2026 PDFForge Brasil — React + Convex + pdfme + Vercel
        </div>
      </footer>

      {/* Quick generation dialog: form feeds pdf-engine directly */}
      <Dialog open={!!quickType} onOpenChange={() => setQuickType(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getDocType(quickType ?? "")?.name ?? "Gerar Documento"}</DialogTitle>
            <DialogDescription>Preencha os dados — o PDF é gerado na hora.</DialogDescription>
          </DialogHeader>
          <DocumentForm documentType={quickType ?? ""} onSubmit={handleQuickGenerate} isLoading={generating} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
