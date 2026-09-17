import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore, type Receipt } from "@/lib/store";
import { Check, Clock, AlertCircle, Upload } from "lucide-react";

interface ReceiptBookProps {
  documentId: string;
}

/**
 * Livro de Recibos — consome a tabela `receipts` (via store) e atualiza
 * o progresso das parcelas quando o usuário envia o comprovante Pix.
 */
export function ReceiptBook({ documentId }: ReceiptBookProps) {
  const receipts = useStore((s) => s.getReceiptsForDocument(documentId));
  const updateReceipt = useStore((s) => s.updateReceipt);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  if (receipts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-slate-400">Nenhuma parcela registrada para este contrato.</p>
        </CardContent>
      </Card>
    );
  }

  const paid = receipts.filter((r) => r.status === "paid").length;
  const total = receipts.length;
  const progress = (paid / total) * 100;

  const handleUpload = (receipt: Receipt) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingId(receipt._id);
      // Produção: enviar para o Convex Storage e guardar o storageId.
      await new Promise((r) => setTimeout(r, 600));
      updateReceipt(receipt._id, {
        status: "paid",
        paidDate: new Date().toLocaleDateString("pt-BR"),
        receiptFileId: `local_${receipt.installmentNumber}_${file.name}`,
      });
      setUploadingId(null);
    };
    input.click();
  };

  const icon = (s: Receipt["status"]) => {
    if (s === "paid") return <Check className="h-4 w-4 text-emerald-400" />;
    if (s === "overdue") return <AlertCircle className="h-4 w-4 text-red-400" />;
    return <Clock className="h-4 w-4 text-amber-400" />;
  };
  void icon; // reserva para uso no modo compacto

  const badge = (s: Receipt["status"]) => {
    if (s === "paid") return <Badge variant="success">Pago</Badge>;
    if (s === "overdue") return <Badge variant="destructive">Atrasado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Progress */}
      <Card className="glow-emerald border-emerald-500/20">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Progresso de quitação</span>
            <span className="text-sm font-bold text-emerald-400">{paid}/{total} parcelas</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">{progress.toFixed(0)}% quitado · toque em "Pix" para enviar o comprovante</p>
        </CardContent>
      </Card>

      {/* Installments */}
      <div className="space-y-2.5">
        {receipts.map((receipt, i) => (
          <motion.div
            key={receipt._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
              receipt.status === "paid"
                ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                : receipt.status === "overdue"
                ? "border-red-500/25 bg-red-500/[0.06]"
                : "border-slate-200 bg-white hover:border-amber-300"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
                receipt.status === "paid" ? "bg-emerald-50 ring-emerald-200" : "bg-slate-50 ring-slate-200"
              }`}>
                {receipt.status === "paid" ? <Check className="h-4 w-4 text-emerald-400" /> : <span className="text-xs font-bold text-slate-400">{receipt.installmentNumber}</span>}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Parcela {receipt.installmentNumber}/{total}</p>
                <p className="text-xs text-slate-400">
                  Venc: {receipt.dueDate}{receipt.paidDate && ` • Pago: ${receipt.paidDate}`}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-sm font-semibold sm:block">
                R$ {receipt.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
              {badge(receipt.status)}
              {receipt.status !== "paid" && (
                <Button variant="outline" size="sm" className="h-8" onClick={() => handleUpload(receipt)} disabled={uploadingId === receipt._id}>
                  {uploadingId === receipt._id ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <span className="flex items-center gap-1"><Upload className="h-3 w-3" /> Pix</span>
                  )}
                </Button>
              )}
              {receipt.status === "paid" && receipt.receiptFileId && (
                <span className="text-xs text-emerald-400" title={receipt.receiptFileId}>📎</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <span className="text-slate-400">Total do contrato:</span>
        <span className="font-bold">
          R$ {receipts.reduce((s, r) => s + r.amount, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
