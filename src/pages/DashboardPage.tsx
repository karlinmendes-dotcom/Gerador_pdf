import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, type Document } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { DOC_TYPES, getDocType, getPrice, downloadPdf } from "@/lib/pdf-engine";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentForm } from "@/components/DocumentForm";
import { AiTextInput } from "@/components/AiTextInput";
import { PaymentModal } from "@/components/PaymentModal";
import { Footer } from "@/components/Footer";
import { AuthModal } from "@/components/AuthModal";
import { ReceiptBook } from "@/components/ReceiptBook";
import { GovBrGuide } from "@/components/GovBrGuide";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, Trash2, Plus, BookOpen, LayoutDashboard, Menu, LogOut, LogIn } from "lucide-react";

type View = "dashboard" | "new" | "receipts";

export default function DashboardPage() {
  const nav = useNavigate();
  const addDocument = useStore((s) => s.addDocument);
  const removeDocument = useStore((s) => s.removeDocument);
  const addReceipts = useStore((s) => s.addReceipts);
  const userDocs = useStore((s) => s.getUserDocuments());

  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  const [view, setView] = useState<View>("dashboard");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading] = useState(false);
  const [payDoc, setPayDoc] = useState<string | null>(null);
  const [receiptsDoc, setReceiptsDoc] = useState<Document | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);
  const [pendingForm, setPendingForm] = useState<{ type: string; data: Record<string, string> } | null>(null);
  const [toast, setToast] = useState("");

  const total = userDocs.length;
  const done = userDocs.filter((d) => d.status === "paid").length;
  const installmentDocs = userDocs.filter((d) =>
    ["compra-venda-veiculo", "contrato-aluguel-simples", "recibo-pagamento"].includes(d.documentType)
  );

  /**
   * Detecta o número de parcelas a partir dos campos do schema:
   * - recibo-pagamento: checkbox `parcelamento` + `numero_parcelas`
   * - contrato-aluguel-simples: `duracao_meses` (1 parcela/mês)
   * - compra-venda-veiculo: "12x"/"12 parcelas" na forma_pagamento
   */
  const detectInstallments = (docType: string, data: Record<string, string>): number => {
    if (docType === "recibo-pagamento") {
      if (data.parcelamento !== "true") return 1;
      const n = Number(data.numero_parcelas ?? 1);
      return Number.isFinite(n) ? Math.min(Math.max(n, 1), 60) : 1;
    }
    if (docType === "contrato-aluguel-simples") {
      const n = Number(data.duracao_meses ?? 1);
      return Number.isFinite(n) ? Math.min(Math.max(n, 1), 60) : 1;
    }
    const text = `${data.forma_pagamento ?? ""} ${data.parcelamento_detalhe ?? ""}`.toLowerCase();
    const m = text.match(/(\d{1,2})\s*x\b|(\d{1,2})\s*parcelas?|parcelado em (\d{1,2})/);
    if (!m) return 1;
    const n = Number(m[1] ?? m[2] ?? m[3] ?? 1);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 60) : 1;
  };

  /** Valor por parcela conforme o documento. */
  const installmentAmount = (docType: string, data: Record<string, string>, n: number): number => {
    const parse = (v?: string) => Number((v ?? "").replace(/\./g, "").replace(",", ".")) || 0;
    if (docType === "recibo-pagamento") {
      const per = parse(data.valor_parcela);
      if (per > 0) return per;
      return parse(data.valor) / (n || 1);
    }
    if (docType === "contrato-aluguel-simples") {
      return parse(data.valor_aluguel);
    }
    return parse(data.valor_total) / (n || 1);
  };

  const persistDocument = (
    type: string,
    data: Record<string, string>,
    status: "draft" | "paid",
    paymentId?: string
  ): Document => {
    const doc = addDocument({
      userId: useStore.getState().userId,
      documentType: type,
      title: `${getDocType(type)?.name ?? type} — ${new Date().toLocaleDateString("pt-BR")}`,
      dataJson: JSON.stringify(data),
      status,
      paymentId,
    });

    const n = detectInstallments(type, data);
    if (n > 1) {
      const per = installmentAmount(type, data, n);
      const today = new Date();
      addReceipts(
        Array.from({ length: n }, (_, i) => {
          const due = new Date(today.getFullYear(), today.getMonth() + i + 1, 10);
          return {
            documentId: doc._id,
            installmentNumber: i + 1,
            amount: per,
            dueDate: due.toLocaleDateString("pt-BR"),
            status: "pending" as const,
          };
        })
      );
    }
    return doc;
  };

  // ─── Fluxo: gerar oficial (paywall) ─────────────────────────────

  const handleOfficialSubmit = (data: Record<string, string>) => {
    if (!selectedType) return;

    // Freemium: exige login apenas para gerar o documento final
    if (!user) {
      setPendingForm({ type: selectedType, data });
      setAuthReason("Crie sua conta grátis para salvar e gerar o PDF oficial.");
      setAuthOpen(true);
      return;
    }

    setPendingForm({ type: selectedType, data });
    setPayDoc("__form__");
  };

  const handleAiGenerated = (data: Record<string, string>) => {
    // IA preenche os campos → segue o mesmo fluxo de paywall
    if (!user) {
      setPendingForm({ type: selectedType ?? "", data });
      setAuthReason("Crie sua conta grátis para salvar e gerar o PDF oficial.");
      setAuthOpen(true);
      return;
    }
    setPendingForm({ type: selectedType ?? "", data });
    setPayDoc("__form__");
  };

  const handleSaveDraft = (data: Record<string, string>) => {
    if (!selectedType) return;
    // Rascunho é grátis e não exige login (fica no dispositivo)
    persistDocument(selectedType, data, "draft");
    showToast("Rascunho salvo com sucesso! 💾");
    setSelectedType(null);
    setView("dashboard");
  };

  // ─── Fluxo: pagamento confirmado → PDF ──────────────────────────

  const handlePaymentConfirmed = async (paymentId: string) => {
    if (!pendingForm) return;
    const { type, data } = pendingForm;
    const doc = persistDocument(type, data, "paid", paymentId);
    setPendingForm(null);

    setTimeout(async () => {
      try {
        await downloadPdf(doc.documentType, JSON.parse(doc.dataJson), `${doc.title}.pdf`);
        showToast("Pagamento aprovado · PDF baixado ✅");
      } catch {
        showToast("Documento salvo como Pago — baixe pelo histórico.");
      }
    }, 500);
  };

  const handleDownload = (doc: Document) => {
    if (doc.status !== "paid") {
      // Paywall: rascunho precisa pagar antes de baixar
      try {
        setPendingForm({ type: doc.documentType, data: JSON.parse(doc.dataJson) });
        setPayDoc(doc._id);
      } catch {
        showToast("Rascunho corrompido — exclua e crie novamente.");
      }
      return;
    }
    downloadPdf(doc.documentType, JSON.parse(doc.dataJson), `${doc.title}.pdf`);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-white/5 bg-white/[0.02] backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-500 text-lg shadow-lg shadow-purple-600/30">
          📄
        </div>
        <div className="leading-tight">
          <span className="block text-sm font-bold">PDFForge Brasil</span>
          <span className="block text-[10px] text-slate-400">Gerador Express</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {[
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "new", label: "Novo Documento", icon: Plus },
          { id: "receipts", label: "Livro de Recibos", icon: BookOpen },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => { setView(item.id as View); setSidebarOpen(false); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
              view === item.id
                ? "bg-gradient-to-r from-indigo-600/25 to-purple-600/15 text-white ring-1 ring-purple-500/30"
                : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/5 p-4">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 text-[10px] font-bold text-white">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-medium">{user.name}</p>
                <p className="truncate text-[10px] text-slate-500">{user.email}</p>
              </div>
            </div>
            <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-500 transition-colors hover:text-red-400">
              <LogOut className="h-3.5 w-3.5" /> Sair da conta
            </button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="w-full" onClick={() => { setAuthReason(undefined); setAuthOpen(true); }}>
            <LogIn className="h-3.5 w-3.5 mr-1.5" /> Entrar / Cadastrar
          </Button>
        )}
        <button onClick={() => nav("/")} className="text-xs text-slate-500 transition-colors hover:text-slate-300">
          ← Voltar ao site
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <div className="fixed inset-y-0 left-0 z-40 hidden md:block">{sidebar}</div>

      {/* Drawer mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden"
            >
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="md:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-bold">
                {view === "dashboard" && "Meus Documentos"}
                {view === "new" && "Novo Documento"}
                {view === "receipts" && "Livro de Recibos"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <div className="hidden items-center gap-2 sm:flex">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 text-[10px] font-bold text-white">
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="max-w-[120px] truncate text-xs text-slate-300">{user.name}</span>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { setAuthReason(undefined); setAuthOpen(true); }}>
                  <LogIn className="h-3.5 w-3.5 mr-1.5" /> Entrar
                </Button>
              )}
              <Button size="sm" onClick={() => setView("new")} className="hidden sm:inline-flex">
                <Plus className="h-4 w-4 mr-1.5" /> Novo
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-10">
          <AnimatePresence mode="wait">
            {/* ─── VIEW: Dashboard ─────────────────────────────── */}
            {view === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {!user && (
                  <Card className="border-purple-500/25 bg-gradient-to-r from-indigo-600/10 to-purple-600/5 p-4">
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-medium">Você está no modo visitante</p>
                        <p className="text-xs text-slate-400">Entre para salvar rascunhos na conta e gerar PDFs oficiais.</p>
                      </div>
                      <Button size="sm" onClick={() => { setAuthReason("Entre para salvar seus documentos na conta."); setAuthOpen(true); }}>
                        Criar conta grátis
                      </Button>
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total", value: total, icon: "📄" },
                    { label: "Concluídos", value: done, icon: "✅" },
                    { label: "Rascunhos", value: total - done, icon: "📝" },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                      <Card className="p-4 transition-all hover:border-purple-500/30 hover:shadow-[0_0_24px_-8px_rgba(139,92,246,0.4)]">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{s.icon}</span>
                          <div>
                            <p className="text-2xl font-bold leading-none">{s.value}</p>
                            <p className="mt-1 text-[11px] text-slate-400">{s.label}</p>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Histórico</CardTitle>
                    <CardDescription>Rascunhos grátis · PDF oficial após Pix</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {userDocs.length === 0 ? (
                      <div className="py-12 text-center">
                        <FileText className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                        <p className="mb-4 text-sm text-slate-400">Nenhum documento ainda.</p>
                        <Button variant="outline" onClick={() => setView("new")}>
                          <Plus className="h-4 w-4 mr-2" /> Criar primeiro documento
                        </Button>
                      </div>
                    ) : (
                      userDocs.map((doc, i) => (
                        <motion.div
                          key={doc._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.04, 0.4) }}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 transition-all hover:border-purple-500/30 hover:bg-white/[0.05] hover:shadow-[0_0_24px_-10px_rgba(139,92,246,0.5)] sm:p-4"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-xl ring-1 ring-white/10">
                              {getDocType(doc.documentType)?.icon ?? "📄"}
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-medium">{doc.title}</h3>
                              <p className="truncate text-xs text-slate-400">
                                {getDocType(doc.documentType)?.name} · {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Badge variant={doc.status === "paid" ? "success" : "warning"} className="hidden sm:inline-flex">
                              {doc.status === "paid" ? "Pago" : "Rascunho"}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setReceiptsDoc(doc)} title="Livro de Recibos">
                              <BookOpen className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleDownload(doc)} title={doc.status === "paid" ? "Baixar PDF" : "Pagar e baixar"}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeDocument(doc._id)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-red-400/80" />
                            </Button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ─── VIEW: Novo documento ────────────────────────── */}
            {view === "new" && (
              <motion.div
                key="new"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {!selectedType ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {DOC_TYPES.map((d, i) => (
                      <motion.div key={d.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                        <Card
                          className="h-full cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-[0_0_30px_-8px_rgba(139,92,246,0.45)]"
                          onClick={() => setSelectedType(d.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="mb-1 text-4xl">{d.icon}</div>
                            <CardTitle className="text-base">{d.name}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <CardDescription className="text-xs">{d.description}</CardDescription>
                            <Badge variant="success" className="mt-3 text-[10px]">
                              PDF R$ {getPrice(d.id).toFixed(2).replace(".", ",")}
                            </Badge>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>← Trocar tipo</Button>

                    <AiTextInput documentType={selectedType} onGenerated={handleAiGenerated} onError={(e) => showToast(e)} fillOnly />

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
                      <div className="relative flex justify-center">
                        <span className="bg-background px-3 text-[11px] uppercase tracking-widest text-slate-500">ou preencha manualmente</span>
                      </div>
                    </div>

                    <DocumentForm
                      documentType={selectedType}
                      onSubmit={handleOfficialSubmit}
                      onSaveDraft={handleSaveDraft}
                      isLoading={loading}
                    />
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ─── VIEW: Livro de Recibos ──────────────────────── */}
            {view === "receipts" && (
              <motion.div
                key="receipts"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Contratos e recibos parcelados</CardTitle>
                    <CardDescription>Envie o comprovante Pix de cada parcela</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {installmentDocs.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-400">
                        Nenhum documento parcelado ainda. Marque "Pagamento parcelado" no recibo,
                        informe a duração no contrato de aluguel ou "12x" no contrato de veículo.
                      </p>
                    ) : (
                      installmentDocs.map((doc) => <ReceiptCard key={doc._id} doc={doc} onOpen={() => setReceiptsDoc(doc)} />)
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0b0f17]/90 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-3">
          {[
            { id: "dashboard", label: "Início", icon: LayoutDashboard },
            { id: "new", label: "Novo", icon: Plus },
            { id: "receipts", label: "Recibos", icon: BookOpen },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as View)}
              className={`flex flex-col items-center gap-1 py-3 text-[10px] transition-colors ${
                view === item.id ? "text-purple-400" : "text-slate-500"
              }`}
            >
              <item.icon className={`h-5 w-5 ${view === item.id ? "drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]" : ""}`} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300 backdrop-blur-xl md:bottom-8"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Livro de Recibos dialog */}
      <Dialog open={!!receiptsDoc} onOpenChange={() => setReceiptsDoc(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0d1220] sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><span>📒</span> {receiptsDoc?.title}</DialogTitle>
            <DialogDescription>Livro de Recibos — progresso das parcelas</DialogDescription>
          </DialogHeader>
          {receiptsDoc && (
            <div className="space-y-5">
              <ReceiptBook documentId={receiptsDoc._id} />
              <GovBrGuide compact />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Auth modal */}
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        reason={authReason}
        onSuccess={() => {
          // Após login, retoma o fluxo pendente (paywall)
          if (pendingForm) {
            setTimeout(() => setPayDoc("__form__"), 250);
          }
        }}
      />

      {/* Paywall PIX */}
      {payDoc && (
        <PaymentModal
          open={!!payDoc}
          onOpenChange={(o) => { if (!o) setPayDoc(null); }}
          documentId={payDoc === "__form__" ? "form" : payDoc}
          amount={
            payDoc === "__form__"
              ? getPrice(pendingForm?.type ?? "")
              : getPrice(useStore.getState().getDocument(payDoc)?.documentType ?? "")
          }
          title={
            payDoc === "__form__"
              ? getDocType(pendingForm?.type ?? "")?.name
              : undefined
          }
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}

      <Footer />
    </div>
  );
}

/** Card de contrato parcelado com resumo do progresso. */
function ReceiptCard({ doc, onOpen }: { doc: Document; onOpen: () => void }) {
  const receipts = useStore((s) => s.getReceiptsForDocument(doc._id));
  const paid = receipts.filter((r) => r.status === "paid").length;
  const total = receipts.length;
  const progress = total > 0 ? (paid / total) * 100 : 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition-all hover:border-purple-500/30 hover:bg-white/[0.05]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-xl ring-1 ring-white/10">
          {getDocType(doc.documentType)?.icon ?? "📄"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{doc.title}</span>
          <span className="mt-1 block h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7 }}
              className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
            />
          </span>
          <span className="mt-1 block text-[10px] text-slate-400">{paid} de {total} parcelas pagas</span>
        </span>
      </span>
      <Badge variant={paid === total ? "success" : "warning"}>Abrir →</Badge>
    </motion.button>
  );
}
