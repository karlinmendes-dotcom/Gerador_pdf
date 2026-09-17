import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BotMessageSquare,
  ClipboardList,
  FileCheck2,
  BookOpen,
  LayoutDashboard,
  Database,
  Target,
  Wand2,
  Zap,
  QrCode as QrCodeIcon,
  BriefcaseBusiness,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DocumentForm } from "@/components/DocumentForm";
import { DocIcon } from "@/components/DocIcon";
import { CheckoutModal } from "@/components/CheckoutModal";
import { AuthModal } from "@/components/AuthModal";
import { QrCodeGenerator } from "@/components/QrCodeGenerator";
import { ProfileMenu } from "@/components/ProfileMenu";
import { Lottie, AnimatedIcon } from "@/components/Lottie";
import { CorporateHeader } from "@/components/CorporateHeader";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/telemetry";
import { DOC_TYPES, getDocType, getPrice, downloadPdf } from "@/lib/pdf-engine";

/** Cards da vitrine de ferramentas (inclui os dois novos módulos). */
const TOOL_CARDS = [
  {
    id: "gerador-qr",
    icon: QrCodeIcon,
    name: "Gerador de QR Code",
    desc: "Textos, links e galerias de arquivos com QR exclusivo — PNG/SVG em alta qualidade.",
    badge: "Novo",
    action: "qr" as const,
  },
  {
    id: "curriculo-profissional",
    icon: BriefcaseBusiness,
    name: "Currículo Profissional",
    desc: "Currículo elegante em 1 página, pronto para enviar em processos seletivos.",
    badge: "Novo",
    action: "doc" as const,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

export default function LandingPage() {
  const nav = useNavigate();
  const addDocument = useStore((s) => s.addDocument);
  const user = useAuth((s) => s.user);

  const [quickType, setQuickType] = useState<string | null>(null);
  const [pendingData, setPendingData] = useState<Record<string, string> | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  /** Formulário submetido → paywall (com login prévio se necessário). */
  const handleOfficialSubmit = (data: Record<string, string>) => {
    if (!quickType) return;
    if (!user) {
      setPendingData({ ...data, __type: quickType });
      setAuthOpen(true);
      return;
    }
    setPendingData({ ...data, __type: quickType });
    setQuickType(null);
    setPayOpen(true);
  };

  /** Rascunho grátis — registra no histórico sem cobrança. */
  const handleSaveDraft = (data: Record<string, string>) => {
    if (!quickType) return;
    addDocument({
      userId: useStore.getState().userId,
      documentType: quickType,
      title: `${getDocType(quickType)?.name ?? quickType} — ${new Date().toLocaleDateString("pt-BR")}`,
      dataJson: JSON.stringify(data),
      status: "draft",
    });
    track("document_saved", { type: quickType, mode: "draft" });
    setQuickType(null);
    showToast("Rascunho salvo! Veja no dashboard.");
  };

  /** Pagamento aprovado → compila PDF → registra como pago → download. */
  const handlePaymentConfirmed = async (paymentId: string) => {
    if (!pendingData) return;
    const { __type, ...form } = pendingData;
    setGenerating(true);
    try {
      await downloadPdf(__type, form, `${getDocType(__type)?.name ?? "documento"}.pdf`);
      addDocument({
        userId: useStore.getState().userId,
        documentType: __type,
        title: `${getDocType(__type)?.name ?? __type} — ${new Date().toLocaleDateString("pt-BR")}`,
        dataJson: JSON.stringify(form),
        status: "paid",
        paymentId,
      });
      track("pdf_generated", { type: __type });
      showToast("Pagamento aprovado · PDF baixado");
    } catch {
      showToast("Documento registrado como pago — baixe pelo dashboard.");
    } finally {
      setGenerating(false);
      setPendingData(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Header corporativo ─────────────────────────────────── */}
      <CorporateHeader
        onOpenAuth={() => setAuthOpen(true)}
        rightSlot={
          user ? (
            <ProfileMenu onOpenQrGenerator={() => setQrOpen(true)} onNavigate={() => nav("/app")} />
          ) : undefined
        }
      />

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="grid-backdrop absolute inset-0" />
        <motion.div
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px]"
        />
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <Badge className="mb-6 border-blue-200 bg-blue-50 px-4 py-1.5 text-blue-700">
                <Zap className="mr-1.5 inline h-3.5 w-3.5" /> Motor único de formulários e PDF
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="mb-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 md:text-6xl lg:text-7xl"
            >
              Documentos Jurídicos
              <span className="text-gradient block pb-2">em Segundos</span>
            </motion.h1>

            {/* Animação 1 (~404 KB) — entra no viewport do hero */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mx-auto mb-10 flex max-w-md justify-center"
            >
              <Lottie asset="hero" className="h-56 w-56 md:h-72 md:w-72" speed={1.1} />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="mx-auto mb-10 max-w-2xl text-base text-slate-600 md:text-xl"
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
                <PenLine className="mr-1.5 inline h-4 w-4" /> Gerar Documento Grátis
              </Button>
              <Button size="lg" variant="outline" onClick={() => nav("/app")} className="w-full sm:w-auto">
                Acessar Plataforma →
              </Button>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6 text-xs text-slate-500">
              Grátis para preencher • Pix R$ 5–9 só no download • PDF pronto em segundos
            </motion.p>
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <motion.h2 {...fadeUp} className="mb-12 text-center text-3xl font-bold text-slate-900 md:text-4xl">
          Tudo que você precisa, <span className="text-gradient">nada a mais</span>
        </motion.h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            { icon: BotMessageSquare, title: "IA que Entende", desc: "Descreva em texto livre — Gemini ou Llama estruturam os dados do documento." },
            { icon: ClipboardList, title: "Formulários Dinâmicos", desc: "Motor configurável via JSON: novos documentos sem escrever código." },
            { icon: FileCheck2, title: "PDF Profissional", desc: "Renderização instantânea com pdfme, 100% no seu navegador." },
            { icon: BookOpen, title: "Livro de Recibos", desc: "Parcelas, comprovantes Pix e progresso de quitação por contrato." },
            { icon: LayoutDashboard, title: "Dashboard Completo", desc: "Histórico, status e download a qualquer momento, em qualquer tela." },
            { icon: Database, title: "Dados no Convex", desc: "Conta, documentos e comprovantes salvos no banco em tempo real." },
          ].map((f, i) => (
            <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.07 }}>
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-blue-50 transition-transform duration-300 group-hover:scale-110">
                    <f.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg text-slate-900">{f.title}</CardTitle>
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
      <section className="relative bg-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.h2 {...fadeUp} className="mb-6 text-center text-3xl font-bold text-slate-900 md:text-4xl">
            Como funciona
          </motion.h2>
          <motion.div {...fadeUp} className="mx-auto mb-10 flex max-w-xs justify-center">
            <Lottie asset="success" className="h-44 w-44" />
          </motion.div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
            {            [
              { icon: Target, title: "1. Escolha e preencha", desc: "Grátis, sem cadastro para testar." },
              { icon: Wand2, title: "2. IA ou manual", desc: "Texto livre estruturado por IA ou digitação." },
              { icon: Zap, title: "3. Pague e baixe", desc: "Pix R$ 5–9 no momento do download." },
            ].map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-md shadow-blue-600/20">
                  <item.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Ferramentas (QR + Currículo) ───────────────────────── */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <motion.h2 {...fadeUp} className="mb-4 text-center text-3xl font-bold text-slate-900 md:text-4xl">
          Ferramentas <span className="text-gradient">Express</span>
        </motion.h2>
        <motion.p {...fadeUp} className="mb-6 text-center text-slate-600">
          Além dos documentos — QR Codes multifuncionais e currículo profissional.
        </motion.p>
        <motion.div {...fadeUp} className="mx-auto mb-10 flex max-w-sm justify-center">
          <Lottie asset="documents" className="h-48 w-48" />
        </motion.div>
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
          {TOOL_CARDS.map((tool, i) => (
            <motion.div key={tool.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
              <Card
                className="group relative h-full cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-md"
                onClick={() => (tool.action === "qr" ? setQrOpen(true) : setQuickType(tool.id))}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50 via-transparent to-sky-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <CardHeader className="relative">
                  <div className="mb-2 flex items-start justify-between">
                    {/* Micro-interação: o ícone anima ao passar o mouse no card */}
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
                      <AnimatedIcon asset="success" className="h-9 w-9" trigger="hover" />
                    </span>
                    <Badge className="border-blue-200 bg-blue-50 text-blue-700">{tool.badge}</Badge>
                  </div>
                  <CardTitle className="text-lg text-slate-900">{tool.name}</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <CardDescription className="text-xs leading-relaxed">{tool.desc}</CardDescription>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 transition-transform duration-300 group-hover:translate-x-1">
                    Experimentar agora →
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Documentos ─────────────────────────────────────────── */}
      <section className="bg-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.h2 {...fadeUp} className="mb-4 text-center text-3xl font-bold text-slate-900 md:text-4xl">
            Documentos disponíveis
          </motion.h2>
          <motion.p {...fadeUp} className="mb-12 text-center text-slate-600">
            Motor extensível — novos tipos entram via schema JSON.
          </motion.p>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
            {DOC_TYPES.map((doc, i) => (
              <motion.div key={doc.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: (i % 3) * 0.07 }}>
                <Card
                  className="group h-full cursor-pointer text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-md"
                  onClick={() => setQuickType(doc.id)}
                >
                  <CardHeader className="items-center">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-blue-50 transition-transform duration-300 group-hover:scale-110">
                      <DocIcon documentType={doc.id} className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-base text-slate-900">{doc.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs">{doc.description}</CardDescription>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{doc.category}</Badge>
                      <Badge variant="success" className="text-[10px]">
                        PDF R$ {getPrice(doc.id).toFixed(2).replace(".", ",")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA final ──────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <motion.div {...fadeUp}>
          <Card className="border-gradient relative mx-auto max-w-2xl overflow-hidden p-8 text-center md:p-12">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50 via-transparent to-sky-50" />
            <h2 className="relative mb-3 text-2xl font-bold text-slate-900 md:text-3xl">
              Pronto para forjar seu <span className="text-gradient">primeiro PDF?</span>
            </h2>
            <p className="relative mb-8 text-sm text-slate-600 md:text-base">
              Preenchimento gratuito. Você só paga quando baixar o documento oficial.
            </p>
            <Button size="lg" onClick={() => setQuickType("compra-venda-veiculo")} className="relative px-10">
              Começar Grátis →
            </Button>
          </Card>
        </motion.div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="container mx-auto px-4 text-center text-xs text-slate-500">
          © 2026 PDFForge Brasil — React + Convex + pdfme + Vercel
        </div>
      </footer>

      {/* ─── Quick generate dialog ──────────────────────────────── */}
      <AnimatePresence>
        <Dialog open={!!quickType} onOpenChange={(o) => !o && setQuickType(null)}>
          <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-slate-200 bg-white sm:rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-blue-50">
                  <DocIcon documentType={quickType ?? ""} />
                </span>
                {getDocType(quickType ?? "")?.name}
              </DialogTitle>
              <DialogDescription>
                Preencha grátis — salve como rascunho ou pague o Pix para baixar o PDF oficial.
              </DialogDescription>
            </DialogHeader>
            <DocumentForm
              documentType={quickType ?? ""}
              onSubmit={handleOfficialSubmit}
              onSaveDraft={handleSaveDraft}
              isLoading={generating}
              hideDraft={false}
            />
          </DialogContent>
        </Dialog>
      </AnimatePresence>

      {/* ─── Auth (login/cadastro) ──────────────────────────────── */}
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        reason="Crie sua conta grátis para salvar e gerar o PDF oficial."
        onSuccess={() => {
          // Retoma o paywall automaticamente após autenticação
          if (pendingData) {
            setTimeout(() => setPayOpen(true), 250);
          }
        }}
      />

      {/* ─── Paywall (PIX) — Checkout ─────────────────────────── */}
      {payOpen && pendingData && (
        <CheckoutModal
          open={payOpen}
          onOpenChange={(o) => { if (!o) setPayOpen(false); }}
          documentId="quick"
          amount={getPrice(pendingData.__type)}
          title={getDocType(pendingData.__type)?.name ?? "Documento"}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}

      {/* ─── Gerador de QR Code ────────────────────────────────── */}
      <QrCodeGenerator open={qrOpen} onOpenChange={setQrOpen} />

      {/* ─── Toast ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-md"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
