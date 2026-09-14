import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth";
import { track, captureError } from "@/lib/telemetry";

// Motor de QR (dep. pesada `qrcode`) carregado sob demanda.
const qrEnginePromise = import("@/lib/qr-engine");
type QrEngine = typeof import("@/lib/qr-engine");
import type { QrStyle, CreatedGallery } from "@/lib/qr-engine";

function useQrEngine() {
  const [engine, setEngine] = useState<QrEngine | null>(null);
  useEffect(() => {
    let cancelled = false;
    void qrEnginePromise.then((m) => {
      if (!cancelled) setEngine(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return engine;
}

type Tab = "text" | "gallery";

const PRESET_COLORS: { name: string; dark: string; light: string }[] = [
  { name: "Forja", dark: "#0b0f17", light: "#ffffff" },
  { name: "Roxo", dark: "#6d28d9", light: "#faf5ff" },
  { name: "Ciano", dark: "#0e7490", light: "#ecfeff" },
  { name: "Esmeralda", dark: "#065f46", light: "#ecfdf5" },
  { name: "Rosa", dark: "#9d174d", light: "#fdf2f8" },
];

interface QrCodeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Módulo Gerador de QR Code:
 * - Aba Texto/Link: QR instantâneo com customização de cores + PNG/SVG.
 * - Aba Galeria: upload de múltiplos arquivos (Convex Storage; draft local
 *   offline) e QR exclusivo apontando para a galeria hospedada em /g/:key.
 */
export function QrCodeGenerator({ open, onOpenChange }: QrCodeGeneratorProps) {
  const [tab, setTab] = useState<Tab>("text");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto border-white/10 bg-zinc-900/80 shadow-2xl shadow-purple-950/40 backdrop-blur-2xl sm:rounded-2xl">
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-gradient-to-r from-purple-600/25 via-indigo-600/15 to-cyan-500/20 blur-3xl" />
        <DialogHeader className="relative">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 via-indigo-500 to-pink-500 text-lg shadow-lg shadow-purple-600/40">
              ⬛
            </span>
            Gerador de QR Code
          </DialogTitle>
          <DialogDescription>
            Textos, links ou uma galeria de arquivos hospedada — personalize e baixe em alta qualidade.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="relative grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(
            [
              { id: "text", label: "Texto / Link" },
              { id: "gallery", label: "Galeria de Arquivos" },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative rounded-lg py-2 text-sm font-medium transition-colors ${
                tab === t.id ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === t.id && (
                <motion.div
                  layoutId="qr-tab"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-600/60 to-indigo-600/40 ring-1 ring-purple-500/40"
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "text" ? (
            <motion.div key="text" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.22 }}>
              <TextQrTab />
            </motion.div>
          ) : (
            <motion.div key="gallery" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
              <GalleryQrTab />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// ─── Aba: Texto / Link ────────────────────────────────────────────────

function TextQrTab() {
  const engine = useQrEngine();
  const [text, setText] = useState("");
  const [style, setStyle] = useState<QrEngine["DEFAULT_QR_STYLE"] extends infer S ? S : never>(
    // Valor padrão sintetizado sem importar o módulo de forma síncrona:
    { dark: "#0b0f17", light: "#ffffff", ecc: "M", margin: 2 }
  );
  const [png, setPng] = useState("");
  const [busy, setBusy] = useState(false);

  const trimmed = text.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 1000;

  useEffect(() => {
    if (!valid || !engine) {
      if (!engine) return;
      setPng("");
      return;
    }
    setBusy(true);
    let cancelled = false;
    engine
      .makeQrDataUrl(trimmed, style)
      .then((url) => {
        if (!cancelled) setPng(url);
      })
      .catch((err) => captureError(err, { where: "qr_text" }))
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed, valid, style, engine]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="qr-text" className="text-slate-300">
          Conteúdo do QR Code
        </Label>
        <Input
          id="qr-text"
          placeholder="https://exemplo.com ou qualquer texto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="field-neon"
        />
      </div>

      <ColorPicker style={style} onChange={setStyle} />

      <QrPreview png={png} busy={busy || !engine} emptyHint="Digite um texto ou link acima para gerar o QR." />

      <DownloadRow
        disabled={!png}
        onPng={() => png && engine?.downloadDataUrl(png, "pdfforge-qrcode.png")}
        onSvg={async () => {
          if (!valid || !engine) return;
          const svg = await engine.makeQrSvg(trimmed, style);
          engine.downloadSvg(svg, "pdfforge-qrcode.svg");
        }}
      />
    </div>
  );
}

// ─── Aba: Galeria de arquivos ─────────────────────────────────────────

function GalleryQrTab() {
  const engine = useQrEngine();
  const user = useAuth((s) => s.user);
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedGallery | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 30));
    setError("");
  };

  const handleCreate = async () => {
    if (!engine) return;
    setError("");
    setBusy(true);
    try {
      const gallery = await engine.createGallery(files, title.trim() || "Galeria PDFForge", {
        userId: user?.id,
      });
      setCreated(gallery);
      track("gallery_created", { mode: gallery.mode, items: gallery.items.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar galeria.");
      captureError(err, { where: "qr_gallery" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="qr-gallery-title" className="text-slate-300">
          Título da galeria
        </Label>
        <Input
          id="qr-gallery-title"
          placeholder="Ex.: Fotos do evento"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field-neon"
        />
      </div>

      {/* Dropzone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center transition-all hover:border-purple-500/50 hover:bg-white/[0.06]"
      >
        <span className="text-2xl">🖼️</span>
        <span className="text-sm text-slate-300">
          Clique para adicionar fotos e documentos
        </span>
        <span className="text-[11px] text-slate-500">Até 30 arquivos · salvo no Convex Storage</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <motion.div
              key={`${f.name}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
            >
              <span className="min-w-0 truncate text-slate-300">
                {f.name} <span className="text-slate-500">({Math.ceil(f.size / 1024)} KB)</span>
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-slate-500 transition-colors hover:text-red-400"
                aria-label={`Remover ${f.name}`}
              >
                ✕
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      {!created ? (
        <Button className="w-full" size="lg" disabled={files.length === 0 || busy} onClick={handleCreate}>
          {busy ? (
            <span className="flex items-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
              />
              Enviando arquivos…
            </span>
          ) : (
            `⚡ Criar Galeria + QR (${files.length} arquivo${files.length === 1 ? "" : "s"})`
          )}
        </Button>
      ) : (
        <GalleryResult gallery={created} />
      )}
    </div>
  );
}

function GalleryResult({ gallery }: { gallery: CreatedGallery }) {
  const engine = useQrEngine();
  const [png, setPng] = useState("");
  const url = engine ? engine.galleryUrl(gallery.key) : "";

  useEffect(() => {
    if (!engine || !url) return;
    engine.makeQrDataUrl(url).then(setPng).catch(() => setPng(""));
  }, [engine, url]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
        ✅ Galeria criada ({gallery.mode === "convex" ? "hospedada no Convex" : "modo teste local"}) — aponte a câmera para o QR.
      </div>

      <QrPreview png={png} busy={false} />

      <div className="space-y-1.5">
        <Label className="text-slate-300">Link da galeria</Label>
        <div className="flex items-center gap-2">
          <Input readOnly value={url} className="field-neon text-xs" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void navigator.clipboard?.writeText(url).catch(() => undefined)}
          >
            Copiar
          </Button>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-block pt-1 text-xs text-purple-300 underline-offset-2 hover:underline"
        >
          Abrir galeria em nova aba →
        </a>
      </div>

      <DownloadRow
        disabled={!png}
        onPng={() => png && engine?.downloadDataUrl(png, "pdfforge-galeria-qr.png")}
        onSvg={async () => {
          if (!engine || !url) return;
          const svg = await engine.makeQrSvg(url);
          engine.downloadSvg(svg, "pdfforge-galeria-qr.svg");
        }}
      />
    </motion.div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────

function ColorPicker({ style, onChange }: { style: QrStyle; onChange: (s: QrStyle) => void }) {
  // `QrStyle` é reexportado como type-only — ver abaixo.
  return (
    <div className="space-y-2">
      <Label className="text-slate-300">Personalização</Label>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => onChange({ ...style, dark: c.dark, light: c.light })}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
              style.dark === c.dark
                ? "border-purple-500/60 bg-purple-500/10 text-white"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25"
            }`}
          >
            <span className="h-4 w-4 rounded-sm" style={{ background: c.dark }} />
            {c.name}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Cor dos módulos
          <input
            type="color"
            value={style.dark}
            onChange={(e) => onChange({ ...style, dark: e.target.value })}
            className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Fundo
          <input
            type="color"
            value={style.light}
            onChange={(e) => onChange({ ...style, light: e.target.value })}
            className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent"
          />
        </label>
      </div>
    </div>
  );
}

function QrPreview({
  png,
  busy,
  emptyHint,
}: {
  png: string;
  busy: boolean;
  emptyHint?: string;
}) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-4">
      {busy ? (
        <Skeleton className="h-44 w-44" />
      ) : png ? (
        <motion.img
          key={png.slice(-24)}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          src={png}
          alt="QR Code gerado"
          className="h-44 w-44 rounded-lg shadow-[0_0_28px_-8px_rgba(139,92,246,0.55)]"
        />
      ) : (
        <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-dashed border-white/10 text-center text-xs text-slate-500">
          {emptyHint ?? "O QR aparecerá aqui"}
        </div>
      )}
    </div>
  );
}

function DownloadRow({
  disabled,
  onPng,
  onSvg,
}: {
  disabled: boolean;
  onPng: () => void;
  onSvg: () => void | Promise<void>;
}) {
  const onPngCb = useCallback(() => onPng(), [onPng]);
  const onSvgCb = useCallback(() => void onSvg(), [onSvg]);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" disabled={disabled} onClick={onPngCb}>
        ⬇ PNG (alta qualidade)
      </Button>
      <Button variant="outline" disabled={disabled} onClick={onSvgCb}>
        ⬇ SVG vetorial
      </Button>
    </div>
  );
}
