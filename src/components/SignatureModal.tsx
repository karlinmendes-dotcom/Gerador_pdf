import { useCallback, useEffect, useRef, useState } from "react";
import { PenTool, Download, RotateCcw, Type, MousePointer2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { downloadDataUrl } from "@/lib/qr-engine";
import { captureError } from "@/lib/telemetry";

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Documento ao qual a assinatura será vinculada (null = uso livre/ferramenta). */
  documentId?: string | null;
  documentTitle?: string;
  /** Aviso pós-salvar (toast do chamador). */
  onSaved?: (msg: string) => void;
}

type Mode = "draw" | "type";

/**
 * Assinatura eletrônica simples (nível 1 — SES simples, LGPD ok):
 * - Desenho em canvas com pressão visual (linha suavizada, mouse + touch);
 * - Ou nome digitado renderizado em fonte cursiva;
 * - Saída: PNG transparente 900×300 embutível no PDF, salvo no histórico
 *   do documento (localStorage/Convex via store) e disponível para download.
 */
export function SignatureModal({ open, onOpenChange, documentId, documentTitle, onSaved }: SignatureModalProps) {
  const updateDocument = useStore((s) => s.updateDocument);
  const documents = useStore((s) => s.documents);

  const [mode, setMode] = useState<Mode>("draw");
  const [typedName, setTypedName] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Canvas HiDPI com fundo transparente.
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 900 * ratio;
    canvas.height = 300 * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    setHasInk(false);
  }, [open, mode]);

  const pos = (e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 900,
      y: ((e.clientY - rect.top) / rect.height) * 300,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    // ponto médio para traço suavizado (quadraticCurve)
    const mx = (last.current.x + p.x) / 2;
    const my = (last.current.y + p.y) / 2;
    ctx.quadraticCurveTo(last.current.x, last.current.y, mx, my);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };

  const endDraw = () => {
    drawing.current = false;
    last.current = null;
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }, []);

  /** Renderiza o nome digitado em fonte cursiva no canvas. */
  const renderTyped = useCallback(
    (name: string) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, 900, 300);
      const clean = name.trim();
      if (!clean) {
        setHasInk(false);
        return;
      }
      let size = 96;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0f172a";
      do {
        ctx.font = `italic ${size}px "Segoe Script", "Brush Script MT", "Comic Sans MS", cursive`;
        size -= 4;
      } while (ctx.measureText(clean).width > 840 && size > 28);
      ctx.fillText(clean, 450, 150);
      setHasInk(true);
    },
    []
  );

  useEffect(() => {
    if (mode === "type") renderTyped(typedName);
  }, [mode, typedName, renderTyped]);

  const exportPng = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return null;
    // PNG transparente para embutir no PDF ou imprimir sobre o documento.
    return canvas.toDataURL("image/png");
  };

  const handleSave = () => {
    const png = exportPng();
    if (!png) return;
    setSaving(true);
    try {
      if (documentId) {
        updateDocument(documentId, { signatureDataUrl: png });
      }
      downloadDataUrl(png, `assinatura-${(documentTitle ?? "pdfforge").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`);
      onSaved?.(
        documentId
          ? "Assinatura vinculada ao documento e baixada (PNG transparente)."
          : "Assinatura criada e baixada (PNG transparente)."
      );
      onOpenChange(false);
    } catch (err) {
      captureError(err, { where: "signature_save" });
      onSaved?.("Não foi possível salvar a assinatura. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const signed = documents.find((d) => d._id === documentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        <DialogHeader className="relative">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <PenTool className="h-5 w-5" />
            </span>
            Assinatura Eletrônica
          </DialogTitle>
          <DialogDescription>
            {documentTitle
              ? `Assine "${documentTitle}" desenhando ou digitando seu nome.`
              : "Desenhe ou digite seu nome para gerar uma assinatura em PNG transparente."}
          </DialogDescription>
        </DialogHeader>

        {/* Modo */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "draw", label: "Desenhar", icon: MousePointer2 },
              { id: "type", label: "Digitar nome", icon: Type },
            ] as { id: Mode; label: string; icon: typeof PenTool }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                mode === m.id
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>

        {mode === "type" && (
          <div className="space-y-1.5">
            <Label htmlFor="sig-name" className="text-slate-600">Seu nome completo</Label>
            <Input
              id="sig-name"
              placeholder="Ex.: Maria Aparecida da Silva"
              value={typedName}
              maxLength={60}
              onChange={(e) => setTypedName(e.target.value)}
              className="field-neon"
            />
          </div>
        )}

        {/* Área da assinatura */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={mode === "draw" ? startDraw : undefined}
            onPointerMove={mode === "draw" ? moveDraw : undefined}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className={`h-[220px] w-full touch-none rounded-xl border-2 border-dashed bg-slate-50 transition-colors ${
              hasInk ? "border-blue-400 bg-white" : "border-slate-300"
            } ${mode === "type" ? "pointer-events-none" : ""}`}
            style={{ aspectRatio: "3 / 1" }}
          />
          {!hasInk && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
              {mode === "draw" ? "Desenhe sua assinatura aqui (mouse ou dedo)" : "A prévia aparecerá aqui"}
            </span>
          )}
          {/* Linha de assinatura (estética de documento) */}
          <span className="pointer-events-none absolute inset-x-10 bottom-6 border-b border-slate-200" />
        </div>

        {signed && (signed as { signatureDataUrl?: string }).signatureDataUrl && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Este documento já possui uma assinatura vinculada — salvar novamente substitui a anterior.
          </p>
        )}

        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Button disabled={!hasInk || saving} onClick={handleSave}>
            <Download className="mr-1.5 h-4 w-4" /> Salvar e baixar PNG
          </Button>
          <Button variant="outline" onClick={mode === "draw" ? clearCanvas : () => setTypedName("")} disabled={!hasInk}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Limpar
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          Assinatura eletrônica simples (nível SES-1): identifica o signatário e data o ato. Para presunção de
          veracidade federal, valide o PDF final gratuitamente em{" "}
          <a href="https://assinador.iti.br" target="_blank" rel="noreferrer" className="text-blue-700 underline">
            assinador.iti.br
          </a>{" "}
          (Gov.br).
        </p>
      </DialogContent>
    </Dialog>
  );
}
