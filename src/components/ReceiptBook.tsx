import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStore, type Receipt } from "@/lib/store";
import { Check, Clock, AlertCircle, Upload } from "lucide-react";

interface ReceiptBookProps {
  documentId: string;
}

/**
 * Livro de Recibos — consumes the `receipts` table (via the store)
 * and updates installment progress when the user uploads a Pix proof.
 */
export function ReceiptBook({ documentId }: ReceiptBookProps) {
  const receipts = useStore((s) => s.getReceiptsForDocument(documentId));
  const updateReceipt = useStore((s) => s.updateReceipt);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  if (receipts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Nenhuma parcela registrada para este contrato.</p>
          <p className="text-sm text-muted-foreground mt-1">
            As parcelas aparecem aqui automaticamente para contratos parcelados.
          </p>
        </CardContent>
      </Card>
    );
  }

  const paid = receipts.filter((r) => r.status === "paid").length;
  const total = receipts.length;
  const progress = (paid / total) * 100;

  /** Reads the Pix proof file and registers it against the installment. */
  const handleUpload = (receipt: Receipt) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingId(receipt._id);

      // In production: upload the file to Convex Storage and store the
      // returned storage id. In draft mode we keep a local reference.
      const localRef = `local_${receipt.installmentNumber}_${file.name}`;

      // Simulated latency for upload feedback
      await new Promise((r) => setTimeout(r, 600));

      updateReceipt(receipt._id, {
        status: "paid",
        paidDate: new Date().toLocaleDateString("pt-BR"),
        receiptFileId: localRef,
      });
      setUploadingId(null);
    };
    input.click();
  };

  const icon = (s: Receipt["status"]) => {
    if (s === "paid") return <Check className="h-4 w-4 text-emerald-600" />;
    if (s === "overdue") return <AlertCircle className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-amber-600" />;
  };

  const badge = (s: Receipt["status"]) => {
    if (s === "paid") return <Badge variant="success">Pago</Badge>;
    if (s === "overdue") return <Badge variant="destructive">Atrasado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">📒 Livro de Recibos</span>
          <span className="text-sm font-normal text-muted-foreground">
            {paid}/{total} parcelas
          </span>
        </CardTitle>
        <div className="mt-2">
          <Progress value={progress} className="h-3" />
          <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(0)}% quitado</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <div
              key={receipt._id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                receipt.status === "paid"
                  ? "bg-emerald-50 border-emerald-200"
                  : receipt.status === "overdue"
                  ? "bg-red-50 border-red-200"
                  : "bg-background"
              }`}
            >
              <div className="flex items-center gap-3">
                {icon(receipt.status)}
                <div>
                  <p className="font-medium text-sm">
                    Parcela {receipt.installmentNumber}/{total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Venc: {receipt.dueDate}
                    {receipt.paidDate && ` • Pago: ${receipt.paidDate}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">
                  R$ {receipt.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                {badge(receipt.status)}
                {receipt.status !== "paid" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpload(receipt)}
                    disabled={uploadingId === receipt._id}
                  >
                    {uploadingId === receipt._id ? (
                      "Enviando..."
                    ) : (
                      <span className="flex items-center gap-1">
                        <Upload className="h-3 w-3" /> Pix
                      </span>
                    )}
                  </Button>
                )}
                {receipt.status === "paid" && receipt.receiptFileId && (
                  <span className="text-xs text-emerald-600" title={receipt.receiptFileId}>
                    📎 Comprovante
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-secondary rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total do contrato:</span>
            <span className="font-semibold">
              R$ {receipts.reduce((sum, r) => sum + r.amount, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
