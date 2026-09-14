import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, type Document } from "@/lib/store";
import { DOC_TYPES, getDocType, getPrice, downloadPdf } from "@/lib/pdf-engine";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentForm } from "@/components/DocumentForm";
import { AiTextInput } from "@/components/AiTextInput";
import { PaymentModal } from "@/components/PaymentModal";
import { ReceiptBook } from "@/components/ReceiptBook";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, Trash2, Plus, BookOpen, LayoutDashboard, Menu, X } from "lucide-react";

type View = "dashboard" | "new" | "receipts";

export default function DashboardPage() {
  const nav = useNavigate();
  const addDocument = useStore((s) => s.addDocument);
  const updateDocument = useStore((s) => s.updateDocument);
  const removeDocument = useStore((s) => s.removeDocument);
  const addReceipts = useStore((s) => s.addReceipts);
  const userDocs = useStore((s) => s.getUserDocuments());

  const [view, setView] = useState<View>("dashboard");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payDoc, setPayDoc] = useState<string | null>(null);
  const [receiptsDoc, setReceiptsDoc] = useState<Document | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const total = userDocs.length;
  const done = userDocs.filter((d) => d.status === "paid").length;
  const pending = total - done;

  /** Detecta parcelamento no campo forma_pagamento (ex: "12x", "12 parcelas"). */
  const detectInstallments = (data: Record<string, string>): number => {
    const text = `${data.forma_pagamento ?? ""} ${data.recibo_referencia ?? ""}`.toLowerCase();
    const m = text.match(/(\d{1,2})\s*x\b|(\d{1,2})\s*parcelas?|parcelado em (\d{1,2})/);
    if (!m) return 1;
    const n = Number(m[1] ?? m[2] ?? m[3] ?? 1);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 60) : 1;
  };

  const handleFormSubmit = (data: Record<string, string>) => {
    if (!selectedType) return;
    setLoading(true);
    setTimeout(() => {
      const doc = addDocument({
        userId: useStore.getState().userId,
        documentType: selectedType,
        title: `${getDocType(selectedType)?.name ?? selectedType} — ${new Date().toLocaleDateString("pt-BR")}`,
        dataJson: JSON.stringify(data),
        status: "draft",
      });

      const n = detectInstallments(data);
      if (n > 1) {
        const value = Number((data.valor_total ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
        const perInstallment = n > 0 ? value / n : 0;
        const today = new Date();
        addReceipts(
          Array.from({ length: n }, (_, i) => {
            const due = new Date(today.getFullYear(), today.getMonth() + i + 1, 10);
            return {
              documentId: doc._id,
              installmentNumber: i + 1,
              amount: perInstallment,
              dueDate: due.toLocaleDateString("pt-BR"),
              status: "pending" as const,
            };
          })
        );
      }

      setLoading(false);
      setView("dashboard");
      setSelectedType(null);
    }, 400);
  };

  const handleAiGenerated = (data: Record<string, string>) => handleFormSubmit(data);

  const handleDownload = (doc: Document) => {
    if (doc.status !== "paid") {
      setPayDoc(doc._id); // paywall — cobra só no download
      return;
    }
    downloadPdf(doc.documentType, JSON.parse(doc.dataJson), `${doc.title}.pdf`);
  };

  const handlePaymentConfirmed = (paymentId: string) => {
    if (payDoc) {
      updateDocument(payDoc, { status: "paid", paymentId });
      const doc = useStore.getState().getDocument(payDoc);
      if (doc) {
        setTimeout(() => {
          downloadPdf(doc.documentType, JSON.parse(doc.dataJson), `${doc.title}.pdf`);
        }, 450);
      }
    }
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
            onClick={() => { setView(item.id as View); setSidebarOpen(false); setMobileMenuOpen(false); }}
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

      <div className="border-t border-white/5 p-4">
        <button onClick={() => nav("/")} className="text-xs text-slate-500 transition-colors hover:text-slate-300">
          ← Voltar ao site
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      {/* ─── Sidebar desktop ────────────────────────────────────── */}
      <div className="fixed inset-y-0 left-0 z-40 hidden md:block">{sidebar}</div>

      {/* ─── Sidebar mobile (drawer) ────────────────────────────── */}
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

      {/* ─── Conteúdo ───────────────────────────────────────────── */}
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
            <Button size="sm" onClick={() => setView("new")} className="hidden sm:inline-flex">
              <Plus className="h-4 w-4 mr-1.5" /> Novo
            </Button>
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
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total", value: total, icon: "📄" },
                    { label: "Concluídos", value: done, icon: "✅" },
                    { label: "Pendentes", value: pending, icon: "⏳" },
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

                {/* Document list */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Histórico</CardTitle>
                    <CardDescription>Formulário → gerar → pagar no download → PDF</CardDescription>
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
                          transition={{ delay: i * 0.04 }}
                          className="group flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 transition-all hover:border-purple-500/30 hover:bg-white/[0.05] hover:shadow-[0_0_24px_-10px_rgba(139,92,246,0.5)] sm:p-4"
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
                              {doc.status === "paid" ? "Concluído" : "Rascunho"}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setReceiptsDoc(doc)} title="Livro de Recibos">
                              <BookOpen className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleDownload(doc)} title="Baixar PDF">
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
                              Pix R$ {getPrice(d.id).toFixed(2).replace(".", ",")}
                            </Badge>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>← Trocar tipo</Button>
                    <AiTextInput documentType={selectedType} onGenerated={handleAiGenerated} onError={(e) => alert(e)} />
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
                      <div className="relative flex justify-center">
                        <span className="bg-background px-3 text-[11px] uppercase tracking-widest text-slate-500">ou preencha manualmente</span>
                      </div>
                    </div>
                    <DocumentForm documentType={selectedType} onSubmit={handleFormSubmit} isLoading={loading} submitLabel="💾 Salvar na Conta (grátis)" />
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
                className="space-y-6"
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Selecione um contrato</CardTitle>
                    <CardDescription>Acompanhe parcelas e envie comprovantes Pix</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {userDocs.filter((d) => d.documentType === "compra-venda-veiculo").length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-400">
                        Nenhum contrato parcelado ainda. Crie um contrato informando "12x" na forma de pagamento.
                      </p>
                    ) : (
                      userDocs
                        .filter((d) => d.documentType === "compra-venda-veiculo")
                        .map((doc) => (
                          <button
                            key={doc._id}
                            onClick={() => setReceiptsDoc(doc)}
                            className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition-all hover:border-purple-500/30 hover:bg-white/[0.05]"
                          >
                            <span className="flex items-center gap-3">
                              <span className="text-xl">🚗</span>
                              <span>
                                <span className="block text-sm font-medium">{doc.title}</span>
                                <span className="block text-xs text-slate-400">{new Date(doc.createdAt).toLocaleDateString("pt-BR")}</span>
                              </span>
                            </span>
                            <Badge variant="secondary">Abrir →</Badge>
                          </button>
                        ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ─── Bottom nav (mobile) ────────────────────────────────── */}
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

      {/* ─── Dialogs ────────────────────────────────────────────── */}
      <Dialog open={!!receiptsDoc} onOpenChange={() => setReceiptsDoc(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0d1220] sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>📒</span> {receiptsDoc?.title}
            </DialogTitle>
            <DialogDescription>Livro de Recibos — progresso das parcelas</DialogDescription>
          </DialogHeader>
          {receiptsDoc && <ReceiptBook documentId={receiptsDoc._id} />}
        </DialogContent>
      </Dialog>

      {payDoc && (
        <PaymentModal
          open={!!payDoc}
          onOpenChange={(o) => { if (!o) setPayDoc(null); }}
          documentId={payDoc}
          amount={getPrice(useStore.getState().getDocument(payDoc)?.documentType ?? "")}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}
    </div>
  );
}
