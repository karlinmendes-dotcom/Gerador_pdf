import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DOC_TYPES } from "@/lib/pdf-engine";

export default function LandingPage() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="text-xl font-bold tracking-tight">PDFForge Brasil</span>
          </div>
          <Button onClick={() => nav("/app")} size="sm">Acessar Plataforma</Button>
        </div>
      </header>

      {/* Hero */}
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
              Pagamento único via PIX — sem assinatura, sem mensalidade.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => nav("/app")} className="text-lg px-8">
                📝 Criar Documento Agora
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })} className="text-lg px-8">
                Como Funciona
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              ⚡ Pagamento via PIX • 🤖 IA para preenchimento • 📄 PDF profissional
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Tudo que você precisa</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "🤖", title: "IA que Entende", desc: "Descreva em texto livre. Gemini ou Llama estruturam os dados automaticamente." },
            { icon: "📋", title: "Formulários Dinâmicos", desc: "Motor configurável via JSON. Novos tipos de documento sem código." },
            { icon: "📄", title: "PDF Profissional", desc: "Geração instantânea com pdfme. Contratos formatados perfeitamente." },
            { icon: "💳", title: "PIX Instantâneo", desc: "Pagamento único via Mercado Pago. QR code + Copia e Cola." },
            { icon: "📒", title: "Livro de Recibos", desc: "Acompanhe parcelas, faça upload de comprovantes Pix." },
            { icon: "📊", title: "Dashboard", desc: "Histórico completo, status e download a qualquer momento." },
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

      {/* How it works */}
      <section id="como-funciona" className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Como Funciona</h2>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", icon: "🎯", title: "Escolha o documento", desc: "Contrato, recibo, declaração e mais." },
              { step: "2", icon: "✨", title: "Preencha ou use a IA", desc: "Dados manuais ou IA estrutura tudo." },
              { step: "3", icon: "💳", title: "Pague via PIX", desc: "R$ 9,90 a R$ 19,90. Liberação instantânea." },
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

      {/* Document types */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Documentos Disponíveis</h2>
        <p className="text-center text-muted-foreground mb-12">Motor extensível — novos tipos via schema JSON.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {DOC_TYPES.map((doc) => (
            <Card key={doc.id} className="text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => nav("/app")}>
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

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <Card className="max-w-2xl mx-auto text-center p-8 bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-2xl text-primary-foreground">Pronto para gerar?</CardTitle>
            <CardDescription className="text-primary-foreground/80">É rápido, seguro e sem complicação.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" variant="secondary" onClick={() => nav("/app")} className="text-lg px-8">
              🚀 Começar Agora
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2026 PDFForge Brasil — React + Convex + pdfme + Mercado Pago
        </div>
      </footer>
    </div>
  );
}
