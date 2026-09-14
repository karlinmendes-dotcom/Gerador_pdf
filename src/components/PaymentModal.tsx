import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { getDocType } from "@/lib/pdf-engine";
import { createPixCheckout, checkPaymentStatus, type PixCheckout } from "@/lib/payments";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  amount: number;
  title?: string;
  onPaymentConfirmed: (paymentId: string) => void;
}

type Flow = "idle" | "creating" | "waiting" | "approved" | "error";

export function PaymentModal({ open, onOpenChange, documentId, amount, title: titleProp, onPaymentConfirmed }: PaymentModalProps) {
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
    if (!doc) return;
    setFlow("creating");
    setError("");
    try {
      const checkout = await createPixCheckout({
        documentId: doc?._id ?? documentId,
        amount,
        title,
      });
      setPix(checkout);
      updateDocument(doc._id, { paymentId: String(checkout.paymentId) });
      setFlow("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cobrança");
      setFlow("error");
    }
  }, [doc, docType, amount, updateDocument]);

  // Poll /api/status until approved (max ~2 min)
  useEffect(() => {
    if (flow !== "waiting" || !pix) return;

    const timeout = setTimeout(() => {
      checkPaymentStatus(pix.paymentId)
        .then((status) => {
          if (status === "approved") {
            if (doc) {
              updateDocument(doc._id, { status: "paid", paymentId: String(pix.paymentId) });
            }
            setFlow("approved");
            onPaymentConfirmed(String(pix.paymentId));
          } else if (status === "rejected" || status === "cancelled") {
            setError("Pagamento recusado ou cancelado.");
            setFlow("error");
          } else {
            setPolls((p) => {
              if (p >= 40) {
                setError("Tempo esgotado. Gere um novo PIX.");
                setFlow("error");
              }
              return p + 1;
            });
          }
        })
        .catch(() => {
          setPolls((p) => p + 1);
        });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [flow, pix, polls, doc?._id, updateDocument, onPaymentConfirmed]);

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento via PIX</DialogTitle>
          <DialogDescription>
            {title} — R$ {amount.toFixed(2).replace(".", ",")}
          </DialogDescription>
        </DialogHeader>

        {flow === "idle" && (
          <div className="space-y-4 text-center py-4">
            <div className="text-4xl">💳</div>
            <p className="text-sm text-muted-foreground">
              Pagamento único de <strong>R$ {amount.toFixed(2)}</strong> via PIX (Mercado Pago).
            </p>
            <Button onClick={createCharge} size="lg" className="w-full">
              Gerar QR Code PIX
            </Button>
          </div>
        )}

        {flow === "creating" && (
          <div className="py-8 text-center">
            <svg className="animate-spin h-10 w-10 mx-auto text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-3 text-sm text-muted-foreground">Gerando cobrança PIX...</p>
          </div>
        )}

        {flow === "waiting" && pix && (
          <div className="space-y-4">
            <div className="flex justify-center">
              {pix.qrCodeBase64 ? (
                <img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code PIX" className="w-48 h-48 rounded-lg border bg-white p-2" />
              ) : (
                <div className="w-48 h-48 rounded-lg border-2 border-dashed flex items-center justify-center text-center">
                  <div>
                    <div className="text-4xl">📱</div>
                    <p className="mt-2 text-xs text-muted-foreground">Use o Pix Copia e Cola<br />no app do seu banco</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIX Copia e Cola</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted rounded-md p-3 text-xs font-mono break-all max-h-20 overflow-y-auto">
                  {pix.qrCode ?? "—"}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                  {copied ? "✅" : "📋"}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-center py-2">
              <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">Aguardando confirmação do pagamento...</span>
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={close}>
              Cancelar
            </Button>
          </div>
        )}

        {flow === "approved" && (
          <div className="space-y-4 text-center py-4">
            <div className="text-5xl">✅</div>
            <h3 className="text-lg font-bold text-emerald-600">Pagamento Aprovado!</h3>
            <Badge variant="success">PIX confirmado</Badge>
            <Button onClick={close} className="w-full">Baixar Documento</Button>
          </div>
        )}

        {flow === "error" && (
          <div className="space-y-4 text-center py-4">
            <div className="text-5xl">⚠️</div>
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={createCharge} className="w-full">🔄 Tentar novamente</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
