import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, type TargetAndTransition, type Transition } from "framer-motion";
import { useStore, type Document } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { GOOGLE_CLIENT_ID } from "@/lib/env";
import { DOC_TYPES, getDocType, getPrice, downloadPdf } from "@/lib/pdf-engine";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentForm } from "@/components/DocumentForm";
import { AiTextInput } from "@/components/AiTextInput";
import { CheckoutModal } from "@/components/CheckoutModal";
import { AuthModal } from "@/components/AuthModal";
import { ReceiptBook } from "@/components/ReceiptBook";
import { GovBrGuide } from "@/components/GovBrGuide";
import { QrCodeGenerator } from "@/components/QrCodeGenerator";
import { LogoMark } from "@/components/Logo";
import { ProfileMenu } from "@/components/ProfileMenu";
import { DocIcon } from "@/components/DocIcon";
import { TrashTarget } from "@/components/TrashTarget";
import { StorageBar } from "@/components/StorageBar";
import { AnimatedDownloadButton } from "@/components/AnimatedDownloadButton";
import { DocumentCardSkeleton, StatsSkeleton } from "@/components/Skeleton";
import { track } from "@/lib/telemetry";
import { CONVEX_URL } from "@/lib/env";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Trash2,
  Plus,
  BookOpen,
  LayoutDashboard,
  LogOut,
  LogIn,
  Wallet,
  Settings,
  FileSignature,
  Clock,
  Banknote,
  FileStack,
  QrCode,
  Search,
} from "lucide-react";

type View = "dashboard" | "docs" | "new" | "receipts" | "pix" | "settings";

/** Deleção real no Convex (documents:remove remove também recibos vinculados). */
async function deleteDocumentInConvex(id: string): Promise<void> {
  if (!CONVEX_URL) return;
  try {
    await fetch(`${CONVEX_URL}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "documents:remove", args: { id } }),
    });
  } catch {
    // A UI já removeu localmente; o Convex é a fonte remota em modo conectado.
  }
}

/**
 * Animação "Crumple & Toss" — o card amassa (escala/rotação), faz uma curva
 * parabólica até a lixeira no canto da tela e some.
 */
const TOSS_ANIM: TargetAndTransition = {
  scale: [1, 0.88, 0.5],
  rotate: [0, 14, -26],
  x: [0, "16vw", "38vw"],
  y: [0, -70, 330],
  opacity: [1, 1, 0],
  filter: ["blur(0px)", "blur(0.5px)", "blur(2px)"],
};

const TOSS_TRANSITION: Transition = {
  duration: 0.9,
  times: [0, 0.35, 1],
  ease: ["easeOut", "easeIn"],
};

/** Badge de status no padrão Projuris (pastéis com borda fina). */
function StatusBadge({ status }: { status: "draft" | "paid" }) {
  if (status === "paid") {
    return (
      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
        ● Concluído
      </Badge>
    );
  }
  return <Badge className="border-amber-200 bg-amber-100 text-amber-800">● Em Revisão</Badge>;
}

export default function DashboardPage() {
  const nav = useNavigate();
  const addDocument = useStore((s) => s.addDocument);
  const removeDocument = useStore((s) => s.removeDocument);
  const addReceipts = useStore((s) => s.addReceipts);
  const userDocs = useStore((s) => s.getUserDocuments());

  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  const [view, setView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading] = useState(false);
  const [payDoc, setPayDoc] = useState<string | null>(null);
  const [receiptsDoc, setReceiptsDoc] = useState<Document | null>(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);
  const [qrOpen, setQrOpen] = useState(false);
  const [pendingForm, setPendingForm] = useState<{ type: string; data: Record<string, string> } | null>(null);
  const [toast, setToast] = useState("");
  const [tossing, setTossing] = useState<string | null>(null);
  const [trashWiggle, setTrashWiggle] = useState(false);
  const trashRef = useRef<HTMLDivElement>(null);
  const allReceipts = useStore((s) => s.receipts);

  const hydrating = useStore((s) => s.hydrating);
  const offline = useStore((s) => s.offline);

  const total = userDocs.length;
  const done = userDocs.filter((d) => d.status === "paid").length;
  const open = total - done;
  const paidDocs = userDocs.filter((d) => d.status === "paid" && d.paymentId);
  const installmentDocs = userDocs.filter((d) =>
    ["compra-venda-veiculo", "contrato-aluguel-simples", "recibo-pagamento"].includes(d.documentType)
  );
  const pendingInstallments = allReceipts.filter((r) => r.status === "pending").length;
  const totalMoved = paidDocs.reduce((sum, d) => sum + getPrice(d.documentType), 0);

  /** Busca global do header: título, parte envolvida ou código. */
  const normalizedQuery = query.trim().toLowerCase();
  const filteredDocs = normalizedQuery
    ? userDocs.filter((d) =>
        d.title.toLowerCase().includes(normalizedQuery) ||
        getCounterpart(d).toLowerCase().includes(normalizedQuery) ||
        d._id.toLowerCase().includes(normalizedQuery)
      )
    : userDocs;
  const hasPendingInstallments = (docId: string) =>
    allReceipts.some((r) => r.documentId === docId && r.status === "pending");
  /** Corpo principal: documentos organizados por colunas de status. */
  const kanban = {
    review: filteredDocs.filter((d) => d.status === "draft"),
    processing: filteredDocs.filter((d) => d.status === "paid" && hasPendingInstallments(d._id)),
    done: filteredDocs.filter((d) => d.status === "paid" && !hasPendingInstallments(d._id)),
  };

  /** Rota desbloqueada: nenhum gate bloqueia o carregamento — o dashboard
   * funciona sempre (modo visitante usa os dados locais do dispositivo). */

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
    showToast("Rascunho salvo com sucesso!");
    setSelectedType(null);
    setView("dashboard");
  };

  // ─── Fluxo: pagamento confirmado → PDF ──────────────────────────

  const handlePaymentConfirmed = async (paymentId: string) => {
    if (!pendingForm) return;
    const { type, data } = pendingForm;
    const doc = persistDocument(type, data, "paid", paymentId);
    setPendingForm(null);
    track("pix_paid", { type });

    setTimeout(async () => {
      try {
        await downloadPdf(doc.documentType, JSON.parse(doc.dataJson), `${doc.title}.pdf`);
        track("pdf_generated", { type: doc.documentType });
        showToast("Pagamento aprovado · PDF baixado");
      } catch {
        showToast("Documento salvo como Pago — baixe pelo histórico.");
      }
    }, 500);
  };

  /** Exclusão "Crumple & Toss": o card voa até a lixeira enquanto a mutation do Convex deleta do banco (recibos vinculados inclusos). */
  const handleDelete = (id: string) => {
    if (tossing) return;
    setTossing(id);
    // Deleção real no Convex dispara imediatamente (fire-and-forget):
    // o banco remove documento + parcelas; a UI anima em paralelo.
    void deleteDocumentInConvex(id);
    setTimeout(() => setTrashWiggle(true), 620);
    setTimeout(() => {
      removeDocument(id);
      setTossing(null);
      setTrashWiggle(false);
      showToast("Documento excluído");
    }, 920);
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

  const NAV_ITEMS = [
    { id: "dashboard", label: "Painel", icon: LayoutDashboard },
    { id: "new", label: "Novo Documento", icon: Plus },
    { id: "docs", label: "Meus Documentos", icon: FileStack },
    { id: "receipts", label: "Livro de Recibos", icon: BookOpen },
    { id: "pix", label: "Histórico de Pix", icon: Wallet },
    { id: "qr", label: "QR Codes", icon: QrCode, action: "qr" },
    { id: "settings", label: "Configurações", icon: Settings },
  ] as const;

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-[#0066FF] text-blue-50">
      <div className="border-b border-white/10 px-5 py-4">
        <button type="button" onClick={() => nav("/")} aria-label="Início" className="flex items-center gap-2.5">
          <LogoMark size={34} />
          <span className="text-left leading-tight">
            <span className="block text-sm font-bold tracking-tight text-white">PDFForge</span>
            <span className="block text-[10px] text-blue-200/70">Painel de Gestão</span>
          </span>
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if ("action" in item && item.action === "qr") {
                setQrOpen(true);
                return;
              }
              setView(item.id as View);
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              view === item.id
                ? "bg-white text-blue-700 shadow-md shadow-blue-950/30"
                : "text-blue-100/85 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className={cn("h-4 w-4", view === item.id ? "text-blue-600" : "text-blue-100/70")} />
            {item.label}
            {view === item.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />}
          </button>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/10 p-4">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-medium text-white">{user.name}</p>
                <p className="truncate text-[10px] text-blue-200/60">{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-blue-100/60 transition-colors hover:bg-white/5 hover:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair da conta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="px-1 text-[10px] leading-relaxed text-blue-200/60">
              Entre para salvar seus documentos na nuvem e emitir PDFs oficiais.
            </p>
            <Button size="sm" className="w-full" onClick={() => { setAuthReason(undefined); setAuthOpen(true); }}>
              <LogIn className="mr-1.5 h-3.5 w-3.5" /> Entrar / Cadastrar
            </Button>
          </div>
        )}
        <button onClick={() => nav("/")} className="text-xs text-blue-200/60 transition-colors hover:text-white">
          ← Voltar ao site
        </button>
      </div>
    </aside>
  );

  const KPIS = [
    { label: "Total de Documentos", value: String(total), icon: FileText, tone: "bg-blue-50 text-blue-600" },
    { label: "Contratos em Aberto", value: String(open), icon: FileSignature, tone: "bg-amber-50 text-amber-600" },
    { label: "Parcelas Pendentes", value: String(pendingInstallments), icon: Clock, tone: "bg-purple-50 text-purple-600" },
    { label: "Valor Movimentado", value: `R$ ${totalMoved.toFixed(2).replace(".", ",")}`, icon: Banknote, tone: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <div className="fixed inset-y-0 left-0 z-40 hidden md:block">{sidebar}</div>

      <div className="md:pl-64">
        {/* Header do sistema: logo reduzido · busca central · usuário autenticado */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 md:px-8">
            <button type="button" onClick={() => nav("/")} aria-label="Início" className="flex items-center gap-2 md:hidden">
              <LogoMark size={30} />
              <span className="text-sm font-bold text-slate-900">PDFForge</span>
            </button>
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-sm font-semibold text-slate-900">
                {NAV_ITEMS.find((i) => i.id === view)?.label ?? "Painel"}
              </span>
              {!user && (
                <Badge variant="secondary" className="text-[10px]">
                  Modo visitante — dados locais
                </Badge>
              )}
            </div>

            {/* Busca central */}
            <div className="relative mx-auto hidden w-full max-w-md sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por documento, parte envolvida ou código…"
                className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Área do usuário */}
            <div className="ml-auto flex items-center gap-2">
              {user ? (
                <ProfileMenu onNavigate={(v) => setView(v === "documents" ? "docs" : "pix")} />
              ) : (
                <>
                  <Badge variant="secondary" className="text-[10px] sm:hidden">Visitante</Badge>
                  <Button size="sm" onClick={() => { setAuthReason("Crie sua conta grátis para salvar seus documentos na nuvem."); setAuthOpen(true); }}>
                    <LogIn className="mr-1.5 h-3.5 w-3.5" /> Entrar / Cadastrar
                  </Button>
                </>
              )}
            </div>
          </div>
          {/* Busca mobile */}
          <div className="border-t border-slate-100 px-4 py-2 sm:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar documentos…"
                className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-10">
          <AnimatePresence mode="wait">
            {/* ─── VIEW: Painel ─────────────────────────────────── */}
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
                  <Card className="border-blue-200 bg-blue-50/60 p-4">
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Você está no modo visitante</p>
                        <p className="text-xs text-slate-600">
                          Navegue livremente — os rascunhos ficam salvos neste dispositivo. Conecte sua conta para acessar de qualquer lugar.
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {GOOGLE_CLIENT_ID && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-300 bg-white"
                            onClick={() => { setAuthReason("Conecte sua conta Google para salvar tudo na nuvem."); setAuthOpen(true); }}
                          >
                            <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
                              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 5.9 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 5.9 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
                            </svg>
                            Google
                          </Button>
                        )}
                        <Button size="sm" onClick={() => { setAuthReason("Entre para salvar seus documentos na conta."); setAuthOpen(true); }}>
                          {GOOGLE_CLIENT_ID ? "E-mail" : "Criar conta grátis"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {offline && !hydrating && (
                  <Card className="border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-800">
                      Modo local — sem conexão com o banco. Seus dados ficam salvos neste dispositivo.
                    </p>
                  </Card>
                )}

                {hydrating ? (
                  <StatsSkeleton />
                ) : (
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {KPIS.map((s, i) => (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                      >
                        <Card className="p-5 transition-all hover:shadow-md">
                          <div className="flex items-center gap-3">
                            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", s.tone)}>
                              <s.icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xl font-bold leading-none text-slate-900">{s.value}</p>
                              <p className="mt-1 truncate text-[11px] text-slate-500">{s.label}</p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}

                <StorageBar documents={userDocs} receipts={allReceipts} />

                {/* Painel de gestão: documentos organizados por colunas de status */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <KanbanColumn
                    title="Em Revisão"
                    hint="Rascunhos aguardando pagamento"
                    dot="bg-amber-500"
                    docs={kanban.review}
                    onOpen={(doc) => setReceiptsDoc(doc)}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                  />
                  <KanbanColumn
                    title="Aprovação"
                    hint="Pagos com parcelas em aberto"
                    dot="bg-purple-500"
                    docs={kanban.processing}
                    onOpen={(doc) => setReceiptsDoc(doc)}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                  />
                  <KanbanColumn
                    title="Concluído"
                    hint="Quitados e liberados para download"
                    dot="bg-emerald-500"
                    docs={kanban.done}
                    onOpen={(doc) => setReceiptsDoc(doc)}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                  />
                </div>

                {/* Tabela de documentos (padrão corporativo) */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Últimos Documentos</CardTitle>
                        <CardDescription>Rascunhos grátis · PDF oficial após Pix</CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setView("new")}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Criar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {hydrating ? (
                      <>
                        <DocumentCardSkeleton />
                        <DocumentCardSkeleton />
                        <DocumentCardSkeleton />
                      </>
                    ) : filteredDocs.length === 0 ? (
                      <div className="py-12 text-center">
                        <FileText className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                        <p className="mb-4 text-sm text-slate-500">
                          {query.trim() ? `Nenhum resultado para “${query.trim()}”.` : "Nenhum documento ainda."}
                        </p>
                        {!query.trim() && (
                          <Button onClick={() => setView("new")}>
                            <Plus className="mr-2 h-4 w-4" /> Criar primeiro documento
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                              <th className="py-2.5 pr-4 font-semibold">Documento</th>
                              <th className="hidden py-2.5 pr-4 font-semibold md:table-cell">Código/Nº</th>
                              <th className="hidden py-2.5 pr-4 font-semibold lg:table-cell">Parte Envolvida</th>
                              <th className="py-2.5 pr-4 font-semibold">Status</th>
                              <th className="hidden py-2.5 pr-4 font-semibold sm:table-cell">Data</th>
                              <th className="py-2.5 text-right font-semibold">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDocs.slice(0, 8).map((doc, i) => {
                              const counterpart = getCounterpart(doc);
                              return (
                                <motion.tr
                                  key={doc._id}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={tossing === doc._id ? TOSS_ANIM : { opacity: 1, y: 0 }}
                                  transition={tossing === doc._id ? TOSS_TRANSITION : { delay: Math.min(i * 0.04, 0.4) }}
                                  className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                                >
                                  <td className="py-3 pr-4">
                                    <div className="flex items-center gap-3">
                                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                                        <DocIcon documentType={doc.documentType} />
                                      </span>
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-900">{doc.title}</p>
                                        <p className="truncate text-xs text-slate-500">{getDocType(doc.documentType)?.name}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="hidden py-3 pr-4 font-mono text-xs text-slate-500 md:table-cell">
                                    {doc._id.slice(-8).toUpperCase()}
                                  </td>
                                  <td className="hidden py-3 pr-4 text-slate-600 lg:table-cell">{counterpart}</td>
                                  <td className="py-3 pr-4"><StatusBadge status={doc.status} /></td>
                                  <td className="hidden py-3 pr-4 text-slate-600 sm:table-cell">
                                    {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                                  </td>
                                  <td className="py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Livro de Recibos"
                                        onClick={() => setReceiptsDoc(doc)}
                                      >
                                        <BookOpen className="h-4 w-4 text-slate-500" />
                                      </Button>
                                      <AnimatedDownloadButton
                                        className="h-8 w-8"
                                        title={doc.status === "paid" ? "Baixar PDF" : "Pagar e baixar"}
                                        onDownload={() => handleDownload(doc)}
                                      >
                                        <Download className="h-4 w-4 text-slate-500" />
                                      </AnimatedDownloadButton>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Excluir"
                                        onClick={() => handleDelete(doc._id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500/80" />
                                      </Button>
                                    </div>
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {filteredDocs.length > 8 && (
                          <p className="pt-3 text-center text-xs text-slate-500">
                            Exibindo 8 de {filteredDocs.length} documentos — use "Meus Documentos" para ver todos.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ─── VIEW: Meus Documentos ────────────────────────── */}
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
                          className="h-full cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
                          onClick={() => setSelectedType(d.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-blue-50">
                              <DocIcon documentType={d.id} className="h-6 w-6" />
                            </div>
                            <CardTitle className="text-base text-slate-900">{d.name}</CardTitle>
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
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
                      <div className="relative flex justify-center">
                        <span className="bg-slate-50 px-3 text-[11px] uppercase tracking-widest text-slate-500">ou preencha manualmente</span>
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

            {/* ─── VIEW: Meus Documentos (lista completa) ───────── */}
            {view === "docs" && (
              <motion.div
                key="docs"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Meus Documentos</CardTitle>
                        <CardDescription>{userDocs.length} documento(s) · histórico completo</CardDescription>
                      </div>
                      <Button size="sm" onClick={() => setView("new")}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Criar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {userDocs.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-500">Nenhum documento ainda.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {userDocs.map((doc) => {
                          const counterpart = getCounterpart(doc);
                          return (
                            <div
                              key={doc._id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 transition-colors hover:bg-slate-50"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                                  <DocIcon documentType={doc.documentType} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-slate-900">{doc.title}</p>
                                  <p className="truncate text-xs text-slate-500">
                                    {counterpart !== "—" ? counterpart : getDocType(doc.documentType)?.name} ·{" "}
                                    {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <StatusBadge status={doc.status} />
                                <AnimatedDownloadButton
                                  className="h-8 w-8"
                                  title={doc.status === "paid" ? "Baixar PDF" : "Pagar e baixar"}
                                  onDownload={() => handleDownload(doc)}
                                >
                                  <Download className="h-4 w-4 text-slate-500" />
                                </AnimatedDownloadButton>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Excluir" onClick={() => handleDelete(doc._id)}>
                                  <Trash2 className="h-4 w-4 text-red-500/80" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ─── VIEW: Histórico de Pix ───────────────────────── */}
            {view === "pix" && (
              <motion.div
                key="pix"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Pagamentos via Pix (Mercado Pago)</CardTitle>
                    <CardDescription>Todos os documentos liberados após confirmação do pagamento</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {paidDocs.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-500">Nenhum pagamento registrado ainda.</p>
                    ) : (
                      paidDocs.map((doc, i) => (
                        <motion.div
                          key={doc._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.05, 0.4) }}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
                              <QrCode className="h-5 w-5 text-emerald-600" />
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-medium text-slate-900">{doc.title}</h3>
                              <p className="truncate text-[11px] text-slate-500">
                                {new Date(doc.updatedAt).toLocaleString("pt-BR")}
                                {doc.paymentId ? ` · MP ${doc.paymentId}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">Pago</Badge>
                            <Badge variant="secondary" className="hidden sm:inline-flex">
                              R$ {getPrice(doc.documentType).toFixed(2).replace(".", ",")}
                            </Badge>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ─── VIEW: Livro de Recibos ───────────────────────── */}
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
                      <p className="py-8 text-center text-sm text-slate-500">
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

            {/* ─── VIEW: Configurações ──────────────────────────── */}
            {view === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Configurações</CardTitle>
                    <CardDescription>Conta e preferências da plataforma</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {user ? (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Conta {user.provider === "convex" ? "sincronizada no Convex" : "local (dispositivo)"}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm text-slate-600">Você não está logado — os dados ficam apenas neste dispositivo.</p>
                        <Button size="sm" className="mt-3" onClick={() => { setAuthReason(undefined); setAuthOpen(true); }}>
                          Entrar / Criar conta grátis
                        </Button>
                      </div>
                    )}
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">Pagamentos</p>
                      <p className="text-xs text-slate-500">Pix via Mercado Pago · liberação automática após confirmação.</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">Armazenamento</p>
                      <p className="text-xs text-slate-500">
                        {CONVEX_URL ? "Convex conectado — sincronização em tempo real." : "Modo local — os dados ficam no navegador."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {[
            { id: "dashboard", label: "Painel", icon: LayoutDashboard },
            { id: "new", label: "Novo", icon: Plus },
            { id: "receipts", label: "Recibos", icon: BookOpen },
            { id: "pix", label: "Pix", icon: Wallet },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as View)}
              className={`flex flex-col items-center gap-1 py-3 text-[10px] transition-colors ${
                view === item.id ? "font-semibold text-blue-600" : "text-slate-500"
              }`}
            >
              <item.icon className="h-5 w-5" />
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
            className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-md md:bottom-8"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Livro de Recibos dialog */}
      <Dialog open={!!receiptsDoc} onOpenChange={() => setReceiptsDoc(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-slate-200 bg-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <BookOpen className="h-5 w-5 text-blue-600" /> {receiptsDoc?.title}
            </DialogTitle>
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
        <CheckoutModal
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

      {/* Alvo da animação Crumple & Toss */}
      <TrashTarget ref={trashRef} wiggle={trashWiggle} />

      {/* Gerador de QR Code */}
      <QrCodeGenerator open={qrOpen} onOpenChange={setQrOpen} />
    </div>
  );
}

/** Coluna do painel de status com cards de gerenciamento rápido. */
function KanbanColumn({
  title,
  hint,
  dot,
  docs,
  onOpen,
  onDownload,
  onDelete,
}: {
  title: string;
  hint: string;
  dot: string;
  docs: Document[];
  onOpen: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
          <p className="truncate text-[10px] text-slate-400">{hint}</p>
        </div>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {docs.length}
        </span>
      </div>
      <div className="flex-1 space-y-2.5 p-3">
        {docs.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">Nenhum documento</p>
        ) : (
          docs.map((doc, i) => (
            <motion.div
              key={doc._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="group rounded-lg border border-slate-200 p-3 transition-all hover:border-blue-300 hover:shadow-sm"
            >
              <button type="button" onClick={() => onOpen(doc)} className="flex w-full items-center gap-2.5 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                  <DocIcon documentType={doc.documentType} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                    {doc.title}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {getCounterpart(doc) !== "—" ? getCounterpart(doc) : getDocType(doc.documentType)?.name}
                  </span>
                </span>
              </button>
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                <StatusBadge status={doc.status} />
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir Livro de Recibos" onClick={() => onOpen(doc)}>
                    <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                  </Button>
                  <AnimatedDownloadButton
                    className="h-7 w-7"
                    title={doc.status === "paid" ? "Baixar PDF" : "Pagar e baixar"}
                    onDownload={() => onDownload(doc)}
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                  </AnimatedDownloadButton>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Excluir" onClick={() => onDelete(doc._id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500/80" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

/** Nome da contraparte do documento (parte envolvida) a partir dos dados. */
function getCounterpart(doc: Document): string {
  try {
    const data = JSON.parse(doc.dataJson) as Record<string, string>;
    return (
      data.comprador_nome ||
      data.locatario_nome ||
      data.pagador_nome ||
      data.declarante_nome ||
      data.locador_nome ||
      data.recebedor_nome ||
      data.vendedor_nome ||
      "—"
    );
  } catch {
    return "—";
  }
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
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition-all hover:border-blue-300 hover:shadow-sm"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <DocIcon documentType={doc.documentType} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-900">{doc.title}</span>
          <span className="mt-1 block h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7 }}
              className="block h-full rounded-full bg-blue-600"
            />
          </span>
          <span className="mt-1 block text-[10px] text-slate-500">{paid} de {total} parcelas pagas</span>
        </span>
      </span>
      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
        Abrir →
      </Badge>
    </motion.button>
  );
}
