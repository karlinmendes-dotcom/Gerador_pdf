import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Images, CheckCircle2, QrCode, ImagePlus, Trash2, Frame, Type, Link2, Banknote, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth";
import { track, captureError } from "@/lib/telemetry";
import { QR_TEMPLATES } from "@/lib/qr-engine";
import type { QrTemplate } from "@/lib/qr-engine";

// Motor de QR (dep. pesada `qrcode`) carregado sob demanda.
const qrEnginePromise = import("@/lib/qr-engine");
type QrEngine = typeof import("@/lib/qr-engine");
import type { CreatedGallery } from "@/lib/qr-engine";

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

/** Estado de design do QR da aba Texto/Link. */
interface QrDesign {
  templateId: string | null;
  dark: string;
  light: string;
  dotStyle: QrTemplate["dotStyle"];
  frame: QrTemplate["frame"];
  caption: string;
  logoDataUrl: string;
}

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
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-gradient-to-r from-blue-100 via-sky-50 to-indigo-100 blur-3xl" />
        <DialogHeader className="relative">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-lg text-white shadow-sm">
              <QrCode className="h-5 w-5" />
            </span>
            Gerador de QR Code
          </DialogTitle>
          <DialogDescription>
            Textos, links ou uma galeria de arquivos hospedada — personalize e baixe em alta qualidade.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="relative grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
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
                  className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-slate-200"
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

/** Tipos de conteúdo do QR (padrão mestre: Pix, Links, WhatsApp e Arquivos). */
type QrContentType = "link" | "pix" | "whatsapp";

const CONTENT_TYPES: { id: QrContentType; label: string }[] = [
  { id: "link", label: "Texto / Link" },
  { id: "pix", label: "Pix" },
  { id: "whatsapp", label: "WhatsApp" },
];

function TextQrTab() {
  const engine = useQrEngine();
  const [qrType, setQrType] = useState<QrContentType>("link");
  const [text, setText] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixName, setPixName] = useState("");
  const [pixCity, setPixCity] = useState("");
  const [pixAmount, setPixAmount] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [design, setDesign] = useState<QrDesign>({
    templateId: null,
    dark: "#0b0f17",
    light: "#ffffff",
    dotStyle: "rounded",
    frame: "none",
    caption: "",
    logoDataUrl: "",
  });
  const [png, setPng] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Payload PIX "Copia e Cola" (BR Code EMV) — escaneável em qualquer banco.
  const pixPayload = useMemo(() => {
    if (qrType !== "pix" || !engine || !pixKey.trim()) return "";
    return engine.buildPixPayload({
      key: pixKey.trim(),
      name: pixName.trim() || "Recebedor",
      city: pixCity.trim() || "BRASIL",
      amount: pixAmount.trim() || undefined,
    });
  }, [qrType, engine, pixKey, pixName, pixCity, pixAmount]);

  // Deep link wa.me — abre a conversa com mensagem pré-preenchida.
  const waPayload = useMemo(() => {
    if (qrType !== "whatsapp") return "";
    const digits = waPhone.replace(/\D/g, "");
    if (digits.length < 10) return "";
    const msg = waMessage.trim();
    return `https://wa.me/${digits}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
  }, [qrType, waPhone, waMessage]);

  const payload = qrType === "pix" ? pixPayload : qrType === "whatsapp" ? waPayload : text.trim();
  const valid = payload.length > 0 && payload.length <= 1000;

  useEffect(() => {
    if (!valid || !engine) {
      if (!engine) return;
      setPng("");
      return;
    }
    setBusy(true);
    let cancelled = false;
    engine
      .makeStyledQrDataUrl(payload, {
        dark: design.dark,
        light: design.light,
        dotStyle: design.dotStyle,
        frame: design.frame,
        caption: design.caption,
        logoDataUrl: design.logoDataUrl || undefined,
      })
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
  }, [payload, valid, design, engine]);

  const handleLogo = async (file: File | undefined) => {
    if (!file || !engine) return;
    setLogoBusy(true);
    try {
      const dataUrl = await engine.imageFileToDataUrl(file);
      setDesign((d) => ({ ...d, logoDataUrl: dataUrl }));
    } catch (err) {
      captureError(err, { where: "qr_logo" });
    } finally {
      setLogoBusy(false);
    }
  };

  const applyTemplate = (t: QrTemplate) => {
    setDesign((d) => ({
      ...d,
      templateId: t.id,
      dark: t.dark,
      light: t.light,
      dotStyle: t.dotStyle,
      frame: t.frame,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Tipo de conteúdo */}
      <div className="grid grid-cols-3 gap-2">
        {CONTENT_TYPES.map((t) => {
          const Icon = t.id === "pix" ? Banknote : t.id === "whatsapp" ? MessageCircle : Link2;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setQrType(t.id)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                qrType === t.id
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {qrType === "link" && (
        <div className="space-y-1.5">
          <Label htmlFor="qr-text" className="text-slate-600">
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
      )}

      {qrType === "pix" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="qr-pix-key" className="text-slate-600">
              Chave Pix (CPF, e-mail, telefone ou aleatória)
            </Label>
            <Input
              id="qr-pix-key"
              placeholder="Ex.: 000.000.000-00 ou chave@exemplo.com"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className="field-neon"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qr-pix-name" className="text-slate-600">
                Nome do recebedor
              </Label>
              <Input
                id="qr-pix-name"
                placeholder="Máx. 25 caracteres"
                maxLength={25}
                value={pixName}
                onChange={(e) => setPixName(e.target.value)}
                className="field-neon"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-pix-city" className="text-slate-600">
                Cidade
              </Label>
              <Input
                id="qr-pix-city"
                placeholder="Máx. 15 caracteres"
                maxLength={15}
                value={pixCity}
                onChange={(e) => setPixCity(e.target.value)}
                className="field-neon"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qr-pix-amount" className="text-slate-600">
              Valor (opcional)
            </Label>
            <Input
              id="qr-pix-amount"
              inputMode="decimal"
              placeholder="Ex.: 25,00 — vazio = valor livre"
              value={pixAmount}
              onChange={(e) => setPixAmount(e.target.value)}
              className="field-neon"
            />
          </div>
        </div>
      )}

      {qrType === "whatsapp" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="qr-wa-phone" className="text-slate-600">
              Número com DDI + DDD
            </Label>
            <Input
              id="qr-wa-phone"
              inputMode="tel"
              placeholder="Ex.: 5511999999999"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              className="field-neon"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qr-wa-msg" className="text-slate-600">
              Mensagem pré-preenchida (opcional)
            </Label>
            <Input
              id="qr-wa-msg"
              placeholder="Ex.: Olá! Vi seu QR Code e quero atendimento."
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              className="field-neon"
            />
          </div>
        </div>
      )}

      <TemplatePicker design={design} onApply={applyTemplate} />

      <ColorPicker
        dark={design.dark}
        light={design.light}
        onChange={(dark, light) => setDesign((d) => ({ ...d, dark, light, templateId: null }))}
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Upload de logo/foto no centro do QR */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-slate-600">
            <ImagePlus className="h-3.5 w-3.5" /> Logo central
          </Label>
          {design.logoDataUrl ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
              <img src={design.logoDataUrl} alt="Logo" className="h-9 w-9 rounded object-contain" />
              <div className="min-w-0 flex-1 space-y-1">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="block w-full text-left text-[11px] font-medium text-blue-700 hover:underline"
                >
                  Trocar
                </button>
                <button
                  type="button"
                  onClick={() => setDesign((d) => ({ ...d, logoDataUrl: "" }))}
                  className="flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-3.5 text-center transition-all hover:border-blue-400 hover:bg-blue-50/50"
            >
              {logoBusy ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                  className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-blue-600"
                />
              ) : (
                <ImagePlus className="h-4 w-4 text-blue-600" />
              )}
              <span className="text-[11px] text-slate-500">Enviar imagem</span>
            </button>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleLogo(e.target.files?.[0])}
          />
        </div>

        {/* Texto de CTA abaixo do QR */}
        <div className="space-y-1.5">
          <Label htmlFor="qr-caption" className="flex items-center gap-1.5 text-slate-600">
            <Type className="h-3.5 w-3.5" /> Texto (CTA)
          </Label>
          <Input
            id="qr-caption"
            placeholder="Ex.: Aponte a câmera"
            value={design.caption}
            maxLength={64}
            onChange={(e) => setDesign((d) => ({ ...d, caption: e.target.value }))}
            className="field-neon"
          />
          <p className="text-[10px] text-slate-400">Aparece abaixo do QR no PNG.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-slate-600">
          <Frame className="h-3.5 w-3.5" /> Moldura
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "none", label: "Nenhuma" },
              { id: "border", label: "Borda fina" },
              { id: "card", label: "Cartão" },
            ] as { id: QrTemplate["frame"]; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDesign((d) => ({ ...d, frame: f.id }))}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                design.frame === f.id
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <QrPreview png={png} busy={busy || !engine} emptyHint="Preencha o conteúdo acima para gerar o QR." />

      <DownloadRow
        disabled={!png}
        onPng={() => png && engine?.downloadDataUrl(png, "pdfforge-qrcode.png")}
        onSvg={async () => {
          if (!valid || !engine) return;
          const svg = await engine.makeQrSvg(payload, { dark: design.dark, light: design.light, ecc: "Q", margin: 2 });
          engine.downloadSvg(svg, "pdfforge-qrcode.svg");
        }}
      />
    </div>
  );
}

/** Seleção de modelos pré-definidos (aplicam estilo + moldura de uma vez). */
function TemplatePicker({ design, onApply }: { design: QrDesign; onApply: (t: QrTemplate) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-600">Modelos</Label>
      <div className="flex flex-wrap gap-2">
        {QR_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onApply(t)}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
              design.templateId === t.id
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-sm border"
              style={{ background: t.light, borderColor: t.dark }}
            >
              <span className="h-2 w-2 rounded-[2px]" style={{ background: t.dark }} />
            </span>
            {t.name}
          </button>
        ))}
      </div>
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
        <Label htmlFor="qr-gallery-title" className="text-slate-600">
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
        className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-all hover:border-blue-400 hover:bg-blue-50/50"
      >
        <Images className="h-6 w-6 text-blue-600" />
        <span className="text-sm text-slate-600">
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
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            >
              <span className="min-w-0 truncate text-slate-600">
                {f.name} <span className="text-slate-500">({Math.ceil(f.size / 1024)} KB)</span>
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-slate-400 transition-colors hover:text-red-600"
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
            `Criar Galeria + QR (${files.length} arquivo${files.length === 1 ? "" : "s"})`
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
      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Galeria criada ({gallery.mode === "convex" ? "hospedada no Convex" : "modo teste local"}) — aponte a câmera para o QR.
        </span>
      </div>

      <QrPreview png={png} busy={false} />

      <div className="space-y-1.5">
        <Label className="text-slate-600">Link da galeria</Label>
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
          className="inline-block pt-1 text-xs text-blue-700 underline-offset-2 hover:underline"
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

function ColorPicker({
  dark,
  light,
  onChange,
}: {
  dark: string;
  light: string;
  onChange: (dark: string, light: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-600">Cores customizadas</Label>
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Cor dos módulos
          <input
            type="color"
            value={dark}
            onChange={(e) => onChange(e.target.value, light)}
            className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Fundo
          <input
            type="color"
            value={light}
            onChange={(e) => onChange(dark, e.target.value)}
            className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white"
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
    <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-4">
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
          className="h-44 w-44 rounded-lg shadow-md"
        />
      ) : (
        <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
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
