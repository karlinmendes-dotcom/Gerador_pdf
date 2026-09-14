import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { getDocType } from "@/lib/pdf-engine";
import { createPixCheckout, checkPaymentStatus, MOCK_QR_DATA_URI, type PixCheckout } from "@/lib/payments";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => boolean | void;
  documentId: string;
  amount: number;
  title?: string;
  /** Disparado quando o pagamento é aprovado — recebe o paymentId. */
  onPaymentConfirmed: (paymentId: string) => void;
}

type Flow = "idle" | "creating" | "waiting" | "approved" | "error";

export function PaymentModal({
  open,
  onOpenChange,
  documentId,
  amount,
  title: titleProp,
  onPaymentConfirmed,
}: PaymentModalProps) {
  const { getDocument, updateDocument } = useStore();
  const doc = getDocument(documentId);
  const docType = doc ? getDocType(doc.documentType) : undefined;
  const title = titleProp ?? doc?.title ?? docType?.name ?? "Documento";

  const [flow, setFlow] = useState<Flow>("idle");
  const [pix, setPix] = useState<PixCheckout | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [polls, setPolls] = useState(0);

  const createCharge = useCallback(async () => {
    setFlow("creating");
    setError("");
    try {
      const checkout = await createPixCheckout({
        documentId: doc?._id ?? documentId,
        amount,
        title,
      });
      setPix(checkout);
      if (doc) updateDocument(doc._id, { paymentId: String(checkout.paymentId) });
      setFlow("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cobrança");
      setFlow("error");
    }
  }, [doc, documentId, amount, title, updateDocument]);

  // Poll until approved (mock: aprova automaticamente após ~8s)
  useEffect(() => {
    if (flow !== "waiting" || !pix) return;

    const timeout = setTimeout(() => {
      checkPaymentStatus(pix.paymentId)
        .then(({ status }) => {
          if (status === "approved") {
            if (doc) updateDocument(doc._id, { status: "paid", paymentId: String(pix.paymentId) });
            setFlow("approved");
            onPaymentConfirmed(String(pix.paymentId));
          } else if (status === "rejected" || status === "cancelled") {
            setError("Pagamento recusado ou cancelado.");
            setFlow("error");
          } else {
            setPolls((p) => {
              if (p >= 60) {
                setError("Tempo esgotado. Gere um novo PIX.");
                setFlow("error");
              }
              return p + 1;
            });
          }
        })
        .catch(() => setPolls((p) => p + 1));
    }, 2500);

    return () => clearTimeout(timeout);
  }, [flow, pix, polls, doc, updateDocument, onPaymentConfirmed]);

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
      setPolls(0);
      setCopied(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md border-white/10 bg-[#0d1220] sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-500 text-sm">⚡</span>
            Pagamento via PIX
          </DialogTitle>
          <DialogDescription>
            {title} — <span className="font-bold text-white">R$ {amount.toFixed(2).replace(".", ",")}</span>
          </DialogDescription>
        </DialogHeader>

        {flow === "idle" && (
          <div className="space-y-4 py-4 text-center">
            <div className="text-4xl">💳</div>
            <p className="text-sm text-slate-400">
              Pagamento único de <span className="font-bold text-white">R$ {amount.toFixed(2).replace(".", ",")}</span> via PIX.
              O PDF é liberado imediatamente após a confirmação.
            </p>
            <Button onClick={createCharge} size="lg" className="w-full">
              Gerar QR Code PIX
            </Button>
          </div>
        )}

        {flow === "creating" && (
          <div className="py-10 text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="mx-auto h-10 w-10 rounded-full border-2 border-purple-500/30 border-t-purple-500" />
            <p className="mt-4 text-sm text-slate-400">Gerando cobrança PIX...</p>
          </div>
        )}

        {flow === "waiting" && pix && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <motion.img
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src={pix.qrCodeBase64 ? `data:image/png;base64,${pix.qrCodeBase64}` : MOCK_QR_DATA_URI}
                alt="QR Code PIX"
                className="h-48 w-48 rounded-xl bg-white p-2 ring-1 ring-white/20"
              />
            </div>

            {pix.mock && (
              <p className="text-center text-[11px] text-amber-400/80">
                🧪 Modo de teste local — o pagamento é aprovado automaticamente em ~8s
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">PIX Copia e Cola</p>
              <div className="flex gap-2">
                <div className="max-h-20 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.04] p-3 font-mono text-[10px] leading-relaxed text-slate-300">
                  {pix.qrCode ?? "—"}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                  {copied ? "✅" : "📋"}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 py-2">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]"
              />
              <span className="text-sm text-slate-400">Aguardando confirmação do pagamento...</span>
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={close}>
              Cancelar
            </Button>
          </div>
        )}

        {flow === "approved" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 py-4 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-4xl ring-2 ring-emerald-500/40"
            >
              ✅
            </motion.div>
            <h3 className="text-lg font-bold text-emerald-400">Pagamento Aprovado!</h3>
            <Badge variant="success">PIX confirmado · PDF liberado</Badge>
            <Button onClick={close} className="w-full">
              📥 Baixar Documento
            </Button>
          </motion.div>
        )}

        {flow === "error" && (
          <div className="space-y-4 py-4 text-center">
            <div className="text-5xl">⚠️</div>
            <p className="text-sm text-red-400">{error}</p>
            <Button onClick={createCharge} className="w-full">🔄 Tentar novamente</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
