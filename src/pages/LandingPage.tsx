import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DocumentForm } from "@/components/DocumentForm";
import { PaymentModal } from "@/components/PaymentModal";
import { useStore } from "@/lib/store";
import { DOC_TYPES, getDocType, getPrice, generatePdf } from "@/lib/pdf-engine";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

export default function LandingPage() {
  const nav = useNavigate();
  const addDocument = useStore((s) => s.addDocument);

  const [quickType, setQuickType] = useState<string | null>(null);
  const [pendingData, setPendingData] = useState<Record<string, string> | null>(null);
  const [payDocId, setPayDocId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  /** Paywall: preencheu de graça — cobra só no "Gerar e Baixar PDF Oficial". */
  const handleQuickGenerate = (data: Record<string, string>) => {
    setPendingData(data);
    setQuickType(null);
    setPayDocId("quick");
  };

  const handlePaymentConfirmed = async (paymentId: string) => {
    if (!pendingData || !quickTypeRef(pendingData)) return;
    setGenerating(true);
    try {
      const type = pendingData.__type as string;
      const { __type, ...form } = pendingData;
      const blob = await generatePdf(type, form);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${getDocType(type)?.name ?? "documento"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addDocument({
        userId: useStore.getState().userId,
        documentType: type,
        title: `${getDocType(type)?.name ?? type} — ${new Date().toLocaleDateString("pt-BR")}`,
        dataJson: JSON.stringify(form),
        status: "paid",
        paymentId,
      });
    } finally {
      setGenerating(false);
      setPendingData(null);
    }
  };

  // helper kept local to avoid stale closure over quickType
  const quickTypeRef = (data: Record<string, string> | null) => data?.__type;

  return (
    <div className="min-h-screen">
      {/* ─── Navbar ─────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-xl"
      >
        <div className="container mx-auto flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-500 text-lg shadow-lg shadow-purple-600/30">
              📄
            </div>
            <div className="leading-tight">
              <span className="block text-base font-bold tracking-tight">PDFForge Brasil</span>
              <span className="block text-[11px] text-slate-400">Gerador de Documentos Express</span>
            </div>
          </div>
          <Button onClick={() => nav("/app")} size="sm">Acessar Plataforma</Button>
        </div>
      </motion.header>

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-28">
        <div className="grid-backdrop absolute inset-0" />
        <motion.div
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[120px]"
        />
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <Badge variant="secondary" className="mb-6 border-purple-500/25 bg-purple-500/10 px-4 py-1.5 text-purple-300">
                ⚡ Motor único de formulários e PDF
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="mb-6 text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl"
            >
              Documentos Jurídicos
              <span className="text-gradient block pb-2">em Segundos</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="mx-auto mb-10 max-w-2xl text-base text-silver md:text-xl"
            >
              Preencha grátis, pague só na hora de baixar. Contratos, recibos e declarações
              profissionais gerados por IA — direto do navegador.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button size="lg" onClick={() => setQuickType("compra-venda-veiculo")} className="w-full sm:w-auto">
                📝 Gerar Documento Grátis
              </Button>
              <Button size="lg" variant="outline" onClick={() => nav("/app")} className="w-full sm:w-auto">
                Abrir Dashboard →
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 text-xs text-slate-500"
            >
              Grátis para preencher • Pix R$ 5–9 só no download • PDF pronto em segundos
            </motion.p>
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <motion.h2 {...fadeUp} className="mb-12 text-center text-3xl font-bold md:text-4xl">
          Tudo que você precisa, <span className="text-gradient">nada a mais</span>
        </motion.h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            { icon: "🤖", title: "IA que Entende", desc: "Descreva em texto livre — Gemini ou Llama estruturam os dados do documento." },
            { icon: "📋", title: "Formulários Dinâmicos", desc: "Motor configurável via JSON: novos documentos sem escrever código." },
            { icon: "📄", title: "PDF Profissional", desc: "Renderização instantânea com pdfme, 100% no seu navegador." },
            { icon: "📒", title: "Livro de Recibos", desc: "Parcelas, comprovantes Pix e progresso de quitação por contrato." },
            { icon: "📊", title: "Dashboard Completo", desc: "Histórico, status e download a qualquer momento, em qualquer tela." },
            { icon: "🔐", title: "Dados no Convex", desc: "Metadados e comprovantes salvos no banco em tempo real." },
          ].map((f, i) => (
            <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.07 }}>
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1.5 hover:border-purple-500/40 hover:shadow-[0_0_36px_-8px_rgba(139,92,246,0.45)]">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-2xl ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110">
                    {f.icon}
                  </div>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{f.desc}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Como funciona ──────────────────────────────────────── */}
      <section className="relative py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.h2 {...fadeUp} className="mb-12 text-center text-3xl font-bold md:text-4xl">
            Como funciona
          </motion.h2>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
            {[
              { icon: "🎯", title: "1. Escolha e preencha", desc: "Grátis, sem cadastro para testar." },
              { icon: "✨", title: "2. IA ou manual", desc: "Texto livre estruturado por IA ou digitação." },
              { icon: "⚡", title: "3. Pague e baixe", desc: "Pix R$ 5–9 no momento do download." },
            ].map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-500 text-2xl shadow-lg shadow-purple-600/30">
                  {item.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Documentos ─────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <motion.h2 {...fadeUp} className="mb-4 text-center text-3xl font-bold md:text-4xl">
          Documentos disponíveis
        </motion.h2>
        <motion.p {...fadeUp} className="mb-12 text-center text-slate-400">
          Motor extensível — novos tipos entram via schema JSON.
        </motion.p>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {DOC_TYPES.map((doc, i) => (
            <motion.div key={doc.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.07 }}>
              <Card
                className="group h-full cursor-pointer text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-cyan-500/40 hover:shadow-[0_0_36px_-8px_rgba(34,211,238,0.4)]"
                onClick={() => setQuickType(doc.id)}
              >
                <CardHeader>
                  <div className="mb-2 text-5xl transition-transform duration-300 group-hover:scale-110">{doc.icon}</div>
                  <CardTitle className="text-base">{doc.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">{doc.description}</CardDescription>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{doc.category}</Badge>
                    <Badge variant="success" className="text-[10px]">a partir de R$ {getPrice(doc.id).toFixed(2).replace(".", ",")}</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── CTA final ──────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <motion.div {...fadeUp}>
          <Card className="border-gradient mx-auto max-w-2xl overflow-hidden p-8 text-center md:p-12">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-cyan-500/10" />
            <h2 className="relative mb-3 text-2xl font-bold md:text-3xl">
              Pronto para forjar seu <span className="text-gradient">primeiro PDF?</span>
            </h2>
            <p className="relative mb-8 text-sm text-slate-400 md:text-base">
              Preenchimento gratuito. Você só paga quando baixar o documento oficial.
            </p>
            <Button size="lg" onClick={() => setQuickType("compra-venda-veiculo")} className="relative px-10">
              🚀 Começar Grátis
            </Button>
          </Card>
        </motion.div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="container mx-auto px-4 text-center text-xs text-slate-500">
          © 2026 PDFForge Brasil — React + Convex + pdfme + Vercel
        </div>
      </footer>

      {/* ─── Quick generate dialog ──────────────────────────────── */}
      <AnimatePresence>
        <Dialog open={!!quickType} onOpenChange={(o) => !o && setQuickType(null)}>
          <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-white/10 bg-[#0d1220] sm:rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{getDocType(quickType ?? "")?.icon}</span>
                {getDocType(quickType ?? "")?.name}
              </DialogTitle>
              <DialogDescription>
                Preencha grátis — o Pix é solicitado apenas no download do PDF oficial.
              </DialogDescription>
            </DialogHeader>
            <DocumentForm
              documentType={quickType ?? ""}
              onSubmit={handleQuickGenerate}
              isLoading={generating}
            />
          </DialogContent>
        </Dialog>
      </AnimatePresence>

      {/* ─── Paywall (PIX) ──────────────────────────────────────── */}
      {payDocId && pendingData && (
        <PaymentModal
          open={!!payDocId}
          onOpenChange={(o) => { if (!o) setPayDocId(null); }}
          documentId={payDocId}
          amount={getPrice(pendingData.__type)}
          title={getDocType(pendingData.__type)?.name ?? "Documento"}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}
    </div>
  );
}
