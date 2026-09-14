import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, type Document } from "@/lib/store";
import { DOC_TYPES, getDocType, downloadPdf } from "@/lib/pdf-engine";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentForm } from "@/components/DocumentForm";
import { AiTextInput } from "@/components/AiTextInput";
import { PaymentModal } from "@/components/PaymentModal";
import { ReceiptBook } from "@/components/ReceiptBook";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, Trash2, Plus, BookOpen } from "lucide-react";

const PRICES: Record<string, number> = {
  "compra-venda-veiculo": 19.9,
  "recibo-pagamento": 9.9,
  "declaracao-residencia": 9.9,
};

export default function DashboardPage() {
  const nav = useNavigate();
  const addDocument = useStore((s) => s.addDocument);
  const updateDocument = useStore((s) => s.updateDocument);
  const removeDocument = useStore((s) => s.removeDocument);
  const addReceipts = useStore((s) => s.addReceipts);
  const userDocs = useStore((s) => s.getUserDocuments());

  const [showNew, setShowNew] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [installments, setInstallments] = useState(1);
  const [loading, setLoading] = useState(false);
  const [payDoc, setPayDoc] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  const badge = (s: string) => {
    if (s === "paid") return <Badge variant="success">Concluído</Badge>;
    return <Badge variant="secondary">Rascunho</Badge>;
  };

  const total = userDocs.length;
  const done = userDocs.filter((d) => d.status === "paid").length;

  /** Extracts installment count from the forma_pagamento field when present. */
  const detectInstallments = (data: Record<string, string>): number => {
    const text = `${data.forma_pagamento ?? ""} ${data.recibo_referencia ?? ""}`.toLowerCase();
    const match = text.match(/(\d{1,2})\s*x\b|(\d{1,2})\s*parcelas?|parcelado em (\d{1,2})/);
    if (!match) return 1;
    const n = Number(match[1] ?? match[2] ?? match[3] ?? 1);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 60) : 1;
  };

  const handleFormSubmit = (data: Record<string, string>) => {
    if (!selectedType) return;
    setLoading(true);
    setTimeout(() => {
      const n = detectInstallments(data);
      const doc = addDocument({
        userId: useStore.getState().userId,
        documentType: selectedType,
        title: `${getDocType(selectedType)?.name ?? selectedType} — ${new Date().toLocaleDateString("pt-BR")}`,
        dataJson: JSON.stringify(data),
        status: "draft",
      });

      // Register installments in the receipts table for installment contracts
      if (n > 1) {
        const baseValue = 1666.67; // reference value; production: parse from data
        const today = new Date();
        addReceipts(
          Array.from({ length: n }, (_, i) => {
            const due = new Date(today.getFullYear(), today.getMonth() + i + 1, 10);
            return {
              documentId: doc._id,
              installmentNumber: i + 1,
              amount: baseValue,
              dueDate: due.toLocaleDateString("pt-BR"),
              status: "pending" as const,
            };
          })
        );
      }

      setLoading(false);
      setShowNew(false);
      setSelectedType(null);
      setInstallments(1);
    }, 400);
  };

  const handleAiGenerated = (data: Record<string, string>) => handleFormSubmit(data);

  const handleDownload = (doc: Document) => {
    if (doc.status !== "paid") {
      setPayDoc(doc._id);
      return;
    }
    const data = JSON.parse(doc.dataJson);
    downloadPdf(doc.documentType, data, `${doc.title}.pdf`);
  };

  const handlePaymentConfirmed = (paymentId: string) => {
    if (payDoc) {
      updateDocument(payDoc, { status: "paid", paymentId });
      setTimeout(() => {
        const doc = useStore.getState().getDocument(payDoc);
        if (doc) downloadPdf(doc.documentType, JSON.parse(doc.dataJson), `${doc.title}.pdf`);
      }, 400);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => nav("/")}>
            <span className="text-2xl">📄</span>
            <div>
              <h1 className="text-lg font-bold">PDFForge Brasil</h1>
              <p className="text-xs text-muted-foreground">Gerador de Documentos Express</p>
            </div>
          </div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Documento
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-2xl font-bold">{done}</p>
                <p className="text-xs text-muted-foreground">Concluídos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Meus Documentos</CardTitle>
            <CardDescription>Formulário → gerar → salvar → dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {userDocs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">Nenhum documento ainda.</p>
                <Button variant="outline" onClick={() => setShowNew(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Criar primeiro documento
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {userDocs.map((doc) => (
                  <div key={doc._id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{getDocType(doc.documentType)?.icon ?? "📄"}</span>
                      <div>
                        <h3 className="font-medium">{doc.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {getDocType(doc.documentType)?.name ?? doc.documentType} ·{" "}
                          {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {badge(doc.status)}
                      <Button variant="ghost" size="icon" onClick={() => setViewDoc(doc)} title="Livro de Recibos">
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} title="Baixar PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeDocument(doc._id)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* New document dialog */}
      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) setSelectedType(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Documento</DialogTitle>
            <DialogDescription>Selecione o tipo e preencha os dados.</DialogDescription>
          </DialogHeader>

          {!selectedType ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DOC_TYPES.map((d) => (
                <Card key={d.id} className="cursor-pointer hover:shadow-lg hover:scale-[1.02] border-2 border-border hover:border-primary/50 transition-all" onClick={() => setSelectedType(d.id)}>
                  <CardHeader className="pb-2">
                    <div className="text-4xl mb-1">{d.icon}</div>
                    <CardTitle className="text-base">{d.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs">{d.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>← Voltar</Button>
              <AiTextInput documentType={selectedType} onGenerated={handleAiGenerated} onError={(e) => alert(e)} />
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou preencha manualmente</span>
                </div>
              </div>
              <DocumentForm documentType={selectedType} onSubmit={handleFormSubmit} isLoading={loading} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipts viewer */}
      <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewDoc?.title}</DialogTitle>
            <DialogDescription>Livro de Recibos — progresso das parcelas</DialogDescription>
          </DialogHeader>
          {viewDoc && <ReceiptBook documentId={viewDoc._id} />}
        </DialogContent>
      </Dialog>

      {/* PIX payment */}
      {payDoc && (
        <PaymentModal
          open={!!payDoc}
          onOpenChange={(o) => { if (!o) setPayDoc(null); }}
          documentId={payDoc}
          amount={PRICES[useStore.getState().getDocument(payDoc)?.documentType ?? ""] ?? 9.9}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}
    </div>
  );
}
