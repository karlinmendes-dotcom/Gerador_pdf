import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, QrCode, Check, Copy, AlertTriangle, Download, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { getDocType } from "@/lib/pdf-engine";
import { CONVEX_URL } from "@/lib/env";
import { createPixCheckout, checkPaymentStatus, MOCK_QR_DATA_URI, type PixCheckout } from "@/lib/payments";

/** Grava a transação na tabela `payments` do Convex (fire-and-forget seguro). */
async function recordPaymentInConvex(params: {
  paymentId: string;
  documentId: string;
  userId?: string;
  amount: number;
  status: string;
}): Promise<void> {
  if (!CONVEX_URL) return;
  try {
    await fetch(`${CONVEX_URL}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "payments:recordCheckout", args: params }),
    });
  } catch {
    // Log de pagamento é best-effort; a baixa oficial é via webhook.
  }
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => boolean | void;
  documentId: string;
  amount: number;
  title?: string;
  /** Disparado quando o pagamento é aprovado — recebe o paymentId. */
  onPaymentConfirmed: (paymentId: string) => void;
}

type Method = "pix" | "card";
type Flow = "idle" | "creating" | "waiting" | "approved" | "error";

const PIX_TTL_SECONDS = 600; // 10 min de validade do QR

/**
 * Checkout animado — cartão fosco translúcido com luzes de fundo,
 * transição entre métodos (Pix/Cartão), QR com barra de tempo regressivo
 * e confirmação satisfatória (check em mola + burst de partículas).
 */
export function CheckoutModal({
  open,
  onOpenChange,
  documentId,
  amount,
  title: titleProp,
  onPaymentConfirmed,
}: CheckoutModalProps) {
  const { getDocument, updateDocument } = useStore();
  const { user } = useAuth();
  const doc = getDocument(documentId);
  const docType = doc ? getDocType(doc.documentType) : undefined;
  const title = titleProp ?? doc?.title ?? docType?.name ?? "Documento";

  const [method, setMethod] = useState<Method>("pix");
  const [flow, setFlow] = useState<Flow>("idle");
  const [pix, setPix] = useState<PixCheckout | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(PIX_TTL_SECONDS);

  const createCharge = useCallback(async () => {
    setFlow("creating");
    setError("");
    try {
      const checkout = await createPixCheckout({
        documentId: doc?._id ?? documentId,
        amount,
        title,
        payerEmail: user?.email,
      });
      setPix(checkout);
      setSecondsLeft(PIX_TTL_SECONDS);
      if (doc) updateDocument(doc._id, { paymentId: String(checkout.paymentId) });
      // Transação registrada na tabela payments do Convex.
      void recordPaymentInConvex({
        paymentId: String(checkout.paymentId),
        documentId: doc?._id ?? documentId,
        userId: user?.id,
        amount,
        status: checkout.status || "pending",
      });
      setFlow("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cobrança");
      setFlow("error");
    }
  }, [doc, documentId, amount, title, updateDocument]);

  // Contagem regressiva do QR (barra de tempo regressivo animada).
  useEffect(() => {
    if (flow !== "waiting") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setError("Tempo esgotado. Gere um novo PIX.");
          setFlow("error");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [flow]);

  // Poll até aprovar (mock: aprova automaticamente após ~8s).
  useEffect(() => {
    if (flow !== "waiting" || !pix) return;
    const timeout = setTimeout(() => {
      checkPaymentStatus(pix.paymentId)
        .then(({ status }) => {
          if (status === "approved") {
            if (doc) updateDocument(doc._id, { status: "paid", paymentId: String(pix.paymentId) });
            // Confirmação também gravada no log de pagamentos do Convex.
            void recordPaymentInConvex({
              paymentId: String(pix.paymentId),
              documentId: doc?._id ?? documentId,
              userId: user?.id,
              amount,
              status: "approved",
            });
            setFlow("approved");
            onPaymentConfirmed(String(pix.paymentId));
          } else if (status === "rejected" || status === "cancelled") {
            setError("Pagamento recusado ou cancelado.");
            setFlow("error");
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [flow, pix, doc, updateDocument, onPaymentConfirmed]);

  const handleCopy = () => {
    if (pix?.qrCode) {
      navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setFlow("idle");
      setPix(null);
      setError("");
      setCopied(false);
      setMethod("pix");
      setSecondsLeft(PIX_TTL_SECONDS);
    }, 300);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const pct = (secondsLeft / PIX_TTL_SECONDS) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="relative max-w-md overflow-hidden border-slate-200 bg-white shadow-xl sm:rounded-3xl">
        {/* Brilho suave no fundo do cartão */}
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-blue-100 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-16 h-56 w-56 rounded-full bg-sky-100 blur-3xl" />

        <DialogHeader className="relative">
          <DialogTitle className="flex items-center gap-2">
            <motion.span
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", damping: 11, stiffness: 220 }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm text-white shadow-sm"
            >
              <Zap className="h-4 w-4" />
            </motion.span>
            Checkout — PDFForge Brasil
          </DialogTitle>
          <DialogDescription>
            {title} — <span className="font-bold text-slate-900">R$ {amount.toFixed(2).replace(".", ",")}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Alternador de método (Pix / Cartão) com transição animada */}
        {flow === "idle" && (
          <div className="relative space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  { id: "pix", label: "Pix", hint: "Aprovação em segundos" },
                  { id: "card", label: "💳 Cartão", hint: "Em breve" },
                ] as { id: Method; label: string; hint: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`relative rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    method === m.id ? "text-blue-700" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {method === m.id && (
                    <motion.div
                      layoutId="checkout-method"
                      className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-slate-200"
                      transition={{ type: "spring", damping: 26, stiffness: 300 }}
                    />
                  )}
                  <span className="relative block">{m.label}</span>
                  <span className="relative block text-[10px] font-normal text-slate-400">{m.hint}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {method === "pix" ? (
                <motion.div
                  key="pix"
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-4 text-center"
                >
                  <QrCode className="mx-auto h-10 w-10 text-blue-600" />
                  <p className="text-sm text-slate-400">
                    Pagamento único via PIX. O PDF é liberado imediatamente após a confirmação.
                  </p>
                  <Button onClick={() => void createCharge()} size="lg" className="w-full">
                    Gerar QR Code PIX
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="card"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-4 text-center"
                >
                  {/* Cartão ilustrativo com brilho */}
                  <motion.div
                    initial={{ rotateY: -14 }}
                    animate={{ rotateY: 0 }}
                    transition={{ type: "spring", damping: 14 }}
                    className="mx-auto h-24 w-40 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 p-3 text-left shadow-md shadow-blue-600/30"
                  >
                    <div className="mb-3 h-5 w-8 rounded-sm bg-amber-300/80" />
                    <p className="font-mono text-[10px] tracking-widest text-white/90">•••• •••• •••• 0000</p>
                  </motion.div>
                  <p className="text-sm text-slate-400">
                    Parcelamento no cartão chega em breve. Finalize agora com Pix — mesma liberação imediata.
                  </p>
                  <Button variant="outline" size="lg" className="w-full" onClick={() => setMethod("pix")}>
                    Usar Pix agora
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {flow === "creating" && (
          <div className="relative py-10 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="mx-auto h-10 w-10 rounded-full border-2 border-purple-500/30 border-t-purple-500"
            />
            <p className="mt-4 text-sm text-slate-400">Gerando cobrança PIX…</p>
          </div>
        )}

        {flow === "waiting" && pix && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative space-y-4"
          >
            <div className="flex justify-center">
              <motion.img
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", damping: 14 }}
                src={pix.qrCodeBase64 ? `data:image/png;base64,${pix.qrCodeBase64}` : MOCK_QR_DATA_URI}
                alt="QR Code PIX"
                className="h-44 w-44 rounded-xl bg-white p-2 ring-1 ring-slate-200 shadow-sm"
              />
            </div>

            {/* Barra de tempo regressivo animada */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>QR válido por</span>
                <motion.span
                  key={secondsLeft}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  className={`font-mono ${secondsLeft < 60 ? "text-red-600" : "text-emerald-700"}`}
                >
                  {mm}:{ss}
                </motion.span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  animate={{ width: `${pct}%` }}
                  transition={{ ease: "linear", duration: 0.6 }}
                  className={`h-full rounded-full ${
                    secondsLeft < 60
                      ? "bg-gradient-to-r from-red-500 to-amber-400"
                      : "bg-gradient-to-r from-emerald-500 to-sky-500"
                  }`}
                />
              </div>
            </div>

            {pix.mock && (
              <p className="text-center text-[11px] text-amber-700">
                Modo de teste local — o pagamento é aprovado automaticamente em ~8s
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">PIX Copia e Cola</p>
              <div className="flex gap-2">
                <div className="max-h-20 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[10px] leading-relaxed text-slate-600">
                  {pix.qrCode ?? "—"}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0" title="Copiar código Pix">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 py-1">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="h-2 w-2 rounded-full bg-amber-500"
              />
              <span className="text-sm text-slate-600">Aguardando confirmação do pagamento…</span>
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={close}>
              Cancelar
            </Button>
          </motion.div>
        )}

        {flow === "approved" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative space-y-4 py-4 text-center"
          >
            {/* Burst de partículas — confirmação satisfatória */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const dist = 70 + (i % 3) * 22;
              return (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    opacity: 0,
                    scale: 0.2,
                  }}
                  transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
                  className="pointer-events-none absolute left-1/2 top-10 h-2 w-2 rounded-full bg-gradient-to-r from-emerald-400 to-sky-300"
                />
              );
            })}

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.25, 1] }}
              transition={{ duration: 0.55, times: [0, 0.7, 1], delay: 0.05 }}
              className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-4xl ring-2 ring-emerald-500/40"
            >
              <Check className="h-8 w-8 text-emerald-600" />
              <motion.span
                animate={{ scale: [1, 1.9], opacity: [0.7, 0] }}
                transition={{ duration: 1.2, repeat: 2 }}
                className="absolute inset-0 rounded-full bg-emerald-500/25"
              />
            </motion.div>
            <h3 className="text-lg font-bold text-emerald-700">Pagamento Aprovado!</h3>
            <Badge variant="success">PIX confirmado · PDF liberado</Badge>
            <Button onClick={close} className="w-full">
              <Download className="mr-1.5 inline h-4 w-4" /> Baixar Documento
            </Button>
          </motion.div>
        )}

        {flow === "error" && (
          <div className="relative space-y-4 py-4 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <p className="text-sm text-red-700">{error}</p>
            <Button onClick={() => void createCharge()} className="w-full">
              <RotateCcw className="mr-1.5 inline h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
