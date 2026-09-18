/**
 * Gerador de QR Code com suporte a Convex Storage.
 *
 * - Texto/URL → QR instantâneo (cliente, zero rede).
 * - Galeria de arquivos → upload para o Convex Storage + registro em
 *   `qrGalleries`, gerando QR para `NEXT_PUBLIC_APP_URL + /g/:key`.
 *   Sem backend conectado (modo draft), cria uma galeria local em
 *   `localStorage` com data URLs — útil para testes offline.
 */
import QRCode from "qrcode";
import { CONVEX_URL } from "./env";

export interface QrStyle {
  /** Cor dos módulos do QR (#rrggbb). */
  dark: string;
  /** Cor do fundo (#rrggbb). */
  light: string;
  /** Nível de correção de erros. */
  ecc: "L" | "M" | "Q" | "H";
  /** Margem em módulos. */
  margin: number;
}

export const DEFAULT_QR_STYLE: QrStyle = {
  dark: "#0b0f17",
  light: "#ffffff",
  ecc: "M",
  margin: 2,
};

export interface GalleryItem {
  fileId: string;
  name: string;
  mime: string;
  size: number;
}

export interface CreatedGallery {
  key: string;
  title: string;
  items: GalleryItem[];
  /** "convex" = hospedada; "local" = galeria draft no navegador. */
  mode: "convex" | "local";
}

/** Gera o QR em data URL (PNG) — instantâneo, sem rede. */
export function makeQrDataUrl(text: string, style: QrStyle = DEFAULT_QR_STYLE): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: style.ecc,
    margin: style.margin,
    width: 1024,
    color: { dark: style.dark, light: style.light },
  });
}

/** Gera o QR como SVG string (download vetorial). */
export function makeQrSvg(text: string, style: QrStyle = DEFAULT_QR_STYLE): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: style.ecc,
    margin: style.margin,
    color: { dark: style.dark, light: style.light },
  });
}

/** Converte data URL (ou blob URL recém-criado) em download de arquivo. */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Dispara o download de um SVG a partir de string. */
export function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

// ─── Galeria hospedada (Convex) / draft (localStorage) ────────────────

const LOCAL_GALLERIES_KEY = "pdfforge:galleries";

interface LocalGallery {
  key: string;
  title: string;
  items: GalleryItem[];
  /** data URLs por fileId. */
  data: Record<string, string>;
  createdAt: number;
  views: number;
}

function loadLocalGalleries(): Record<string, LocalGallery> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_GALLERIES_KEY) ?? "{}") as Record<string, LocalGallery>;
  } catch {
    return {};
  }
}

function saveLocalGalleries(all: Record<string, LocalGallery>) {
  try {
    localStorage.setItem(LOCAL_GALLERIES_KEY, JSON.stringify(all));
  } catch {
    // quota: galerias draft podem ficar grandes; mantém as 10 mais recentes
    const entries = Object.entries(all)
      .sort((a, b) => b[1].createdAt - a[1].createdAt)
      .slice(0, 10);
    try {
      localStorage.setItem(LOCAL_GALLERIES_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* desiste silenciosamente */
    }
  }
}

function shortKey(): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** URL pública base da plataforma (fallback: origem atual). */
export function appBaseUrl(): string {
  const fromEnv =
    (import.meta.env.NEXT_PUBLIC_APP_URL as string | undefined) ??
    (import.meta.env.VITE_APP_URL as string | undefined);
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof location !== "undefined") return location.origin;
  return "";
}

/** URL pública de uma galeria criada. */
export function galleryUrl(key: string): string {
  return `${appBaseUrl()}/g/${key}`;
}

/** Lê uma galeria draft local (null se não existir). */
export function getLocalGallery(key: string): LocalGallery | null {
  return loadLocalGalleries()[key] ?? null;
}

/** Incrementa visitas da galeria local. */
export function bumpLocalGalleryViews(key: string): number {
  const all = loadLocalGalleries();
  const g = all[key];
  if (!g) return 0;
  g.views += 1;
  saveLocalGalleries(all);
  return g.views;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Cria a galeria:
 * 1. Com Convex conectado: pede uploadUrl, envia cada arquivo ao Storage e
 *    registra a galeria em `qrGalleries` (retornando a chave curta).
 * 2. Sem backend: salva data URLs no localStorage (modo draft/testes).
 */
export async function createGallery(
  files: File[],
  title: string,
  opts?: { userId?: string }
): Promise<CreatedGallery> {
  if (files.length === 0) throw new Error("Adicione ao menos um arquivo.");
  if (files.length > 30) throw new Error("Máximo de 30 arquivos por galeria.");

  const items: GalleryItem[] = files.map((f) => ({
    fileId: "",
    name: f.name,
    mime: f.type || "application/octet-stream",
    size: f.size,
  }));

  if (CONVEX_URL) {
    try {
      // 1. upload URL
      const upRes = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "galleries:requestUploadUrl", args: {} }),
      });
      const upBody = (await upRes.json()) as { status?: string; value?: string };
      const uploadUrl = upBody.status === "success" ? String(upBody.value ?? "") : "";
      if (!uploadUrl) throw new Error("Convex não retornou uploadUrl");

      // 2. uploads + fileId
      const fileIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": items[i].mime },
          body: files[i],
        });
        if (!res.ok) throw new Error(`Upload falhou (${res.status})`);
        const stored = (await res.json()) as { storageId?: string };
        const id = String(stored.storageId ?? "");
        if (!id) throw new Error("Convex não retornou storageId");
        fileIds.push(id);
        items[i].fileId = id;
      }

      // 3. registro
      const regRes = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "galleries:create",
          args: { userId: opts?.userId, title, fileIds, items },
        }),
      });
      const regBody = (await regRes.json()) as { status?: string; value?: string };
      const key = regBody.status === "success" ? String(regBody.value ?? "") : "";
      if (!key) throw new Error("Falha ao registrar galeria no Convex");

      return { key, title, items, mode: "convex" };
    } catch (err) {
      console.warn("[qr-engine] Convex indisponível — usando galeria local:", err);
    }
  }

  // ── Modo draft (localStorage com data URLs) ──
  const key = shortKey();
  const data: Record<string, string> = {};
  for (let i = 0; i < files.length; i++) {
    items[i].fileId = `local_${i}`;
    data[`local_${i}`] = await fileToDataUrl(files[i]);
  }
  const all = loadLocalGalleries();
  all[key] = { key, title, items, data, createdAt: Date.now(), views: 0 };
  saveLocalGalleries(all);
  return { key, title, items, mode: "local" };
}

// ─── PIX Copia e Cola (BR Code estático, padrão EMV do Banco Central) ──

function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitizePix(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .trim()
    .slice(0, max);
}

/**
 * Monta o payload "Pix Copia e Cola" escaneável (BR Code estático EMV QRCPS-MPM):
 * qualquer app bancário lê o QR e preenche o pagamento automaticamente.
 */
export function buildPixPayload(opts: {
  key: string;
  name: string;
  city: string;
  /** Valor em reais no formato brasileiro ("25,00") ou americano ("25.00"). Opcional. */
  amount?: string;
  txid?: string;
}): string {
  const merchantAccount = emv("00", "br.gov.bcb.pix") + emv("01", opts.key.trim());
  let payload = emv("00", "01") + emv("26", merchantAccount) + emv("52", "0000") + emv("53", "986");

  const amount = (opts.amount ?? "").replace(/\./g, "").replace(",", ".").trim();
  const amountNum = Number(amount);
  if (amount && Number.isFinite(amountNum) && amountNum > 0) {
    payload += emv("54", amountNum.toFixed(2));
  }
  payload +=
    emv("58", "BR") +
    emv("59", sanitizePix(opts.name, 25) || "RECEBEDOR") +
    emv("60", sanitizePix(opts.city, 15) || "BRASIL");

  const txid = (opts.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  payload += emv("62", emv("05", txid || "***"));
  payload += "6304";
  return payload + crc16(payload);
}

// ─── QR estilizado: modelos, molduras, logo central e CTA ─────────────

export type QrDotStyle = "square" | "rounded" | "dots";
export type QrFrame = "none" | "border" | "card";

export interface QrTemplate {
  id: string;
  name: string;
  dark: string;
  light: string;
  dotStyle: QrDotStyle;
  frame: QrFrame;
}

/** Modelos pré-definidos — aplicados com um clique no gerador. */
export const QR_TEMPLATES: QrTemplate[] = [
  { id: "classico", name: "Clássico", dark: "#0b0f17", light: "#ffffff", dotStyle: "square", frame: "none" },
  { id: "arredondado", name: "Arredondado", dark: "#1d4ed8", light: "#ffffff", dotStyle: "rounded", frame: "none" },
  { id: "bolhas", name: "Bolhas", dark: "#0e7490", light: "#f0fdff", dotStyle: "dots", frame: "none" },
  { id: "moldura", name: "Moldura", dark: "#0b0f17", light: "#ffffff", dotStyle: "rounded", frame: "card" },
  { id: "esmeralda", name: "Esmeralda", dark: "#065f46", light: "#ecfdf5", dotStyle: "dots", frame: "border" },
  { id: "forja", name: "Forja PDFForge", dark: "#1e3a8a", light: "#eff6ff", dotStyle: "rounded", frame: "card" },
];

export interface StyledQrOptions {
  dark?: string;
  light?: string;
  dotStyle?: QrDotStyle;
  frame?: QrFrame;
  /** Texto de CTA desenhado abaixo do QR (ex.: "Aponte a câmera"). */
  caption?: string;
  /** Data URL de logo/foto desenhada no centro (ativa correção de erro H). */
  logoDataUrl?: string;
  /** Dimensão base em px (padrão 1024). */
  size?: number;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawModule(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, dotStyle: QrDotStyle) {
  if (dotStyle === "square") {
    ctx.fillRect(x, y, cell + 0.5, cell + 0.5); // +0.5 evita frestas hairline
    return;
  }
  const pad = cell * 0.08;
  const s = cell - pad * 2;
  const r = dotStyle === "dots" ? s / 2 : s * 0.32;
  roundRectPath(ctx, x + pad, y + pad, s, s, r);
  ctx.fill();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a imagem."));
    img.src = src;
  });
}

/** Lê um arquivo de imagem e redimensiona (lado maior = `max` px) — mantém o QR leve. */
export async function imageFileToDataUrl(file: File, max = 512): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(file);
  });
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  if (scale >= 1) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/**
 * Renderiza o QR estilizado em canvas (PNG data URL):
 * - dotStyle: quadrado, arredondado ou bolhas;
 * - frame: sem moldura, borda fina ou cartão com cantos arredondados;
 * - caption: texto de CTA abaixo do código;
 * - logo: imagem central com colchão do fundo — a correção de erro nível H
 *   mantém o QR legível mesmo com a área central coberta (~22%).
 */
export async function makeStyledQrDataUrl(text: string, opts: StyledQrOptions = {}): Promise<string> {
  const {
    dark = DEFAULT_QR_STYLE.dark,
    light = DEFAULT_QR_STYLE.light,
    dotStyle = "rounded",
    frame = "none",
    caption = "",
    logoDataUrl,
    size = 1024,
  } = opts;

  const qr = QRCode.create(text, { errorCorrectionLevel: logoDataUrl ? "H" : "Q" });
  const count = qr.modules.size;
  const bits = qr.modules.data;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  const captionH = caption.trim() ? Math.round(size * 0.115) : 0;
  const frameW = frame === "none" ? 0 : Math.max(2, Math.round(size * 0.012));
  const pad = frame === "none" ? Math.round(size * 0.04) : Math.round(size * 0.045) + frameW;

  canvas.width = size;
  canvas.height = size + captionH;

  ctx.fillStyle = light;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Molduras
  if (frame === "border" || frame === "card") {
    ctx.strokeStyle = dark;
    ctx.lineWidth = frameW;
    roundRectPath(
      ctx,
      frameW / 2,
      frameW / 2,
      size - frameW,
      canvas.height - frameW,
      frame === "card" ? Math.round(size * 0.05) : Math.round(size * 0.028)
    );
    ctx.stroke();
  }

  const qrArea = size - pad * 2;
  const cell = qrArea / count;
  const ox = pad;
  const oy = pad;

  ctx.fillStyle = dark;

  // Módulos de dados (os finders são desenhados à parte para ficarem nítidos)
  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!bits[r * count + c] || inFinder(r, c)) continue;
      drawModule(ctx, ox + c * cell, oy + r * cell, cell, dotStyle);
    }
  }

  // Finder patterns 7×7: quadrado escuro → anel claro → núcleo escuro
  const finderCorners: [number, number][] = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];
  for (const [fr, fc] of finderCorners) {
    const x = ox + fc * cell;
    const y = oy + fr * cell;
    const s = cell * 7;
    const corner = dotStyle === "square" ? cell * 1.1 : cell * 2.2;
    ctx.fillStyle = dark;
    roundRectPath(ctx, x, y, s, s, corner);
    ctx.fill();
    ctx.fillStyle = light;
    roundRectPath(ctx, x + cell, y + cell, s - cell * 2, s - cell * 2, Math.max(corner - cell * 0.8, cell * 0.6));
    ctx.fill();
    ctx.fillStyle = dark;
    roundRectPath(ctx, x + cell * 2, y + cell * 2, s - cell * 4, s - cell * 4, Math.max(corner - cell * 1.4, cell * 0.5));
    ctx.fill();
  }

  // Logo central com colchão da cor de fundo (área de segurança ~22% do QR)
  if (logoDataUrl) {
    const img = await loadImage(logoDataUrl);
    const logoSize = qrArea * 0.22;
    const cushion = logoSize * 0.14;
    const lx = ox + (qrArea - logoSize) / 2;
    const ly = oy + (qrArea - logoSize) / 2;
    ctx.fillStyle = light;
    roundRectPath(ctx, lx - cushion, ly - cushion, logoSize + cushion * 2, logoSize + cushion * 2, logoSize * 0.24);
    ctx.fill();
    const ratio = Math.min(logoSize / img.width, logoSize / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    ctx.drawImage(img, lx + (logoSize - w) / 2, ly + (logoSize - h) / 2, w, h);
  }

  // CTA abaixo do QR
  if (captionH > 0) {
    ctx.fillStyle = dark;
    ctx.font = `bold ${Math.round(size * 0.047)}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(caption.trim().slice(0, 64), size / 2, size + captionH / 2, size - pad * 2);
  }

  return canvas.toDataURL("image/png");
}

/** Lista galerias do usuário (Convex) — falha silenciosamente offline. */
export async function listUserGalleries(userId?: string): Promise<CreatedGallery[]> {
  if (!CONVEX_URL || !userId) {
    const all = loadLocalGalleries();
    return Object.values(all)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((g) => ({ key: g.key, title: g.title, items: g.items, mode: "local" as const }));
  }
  try {
    const res = await fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "galleries:listByUser", args: { userId } }),
    });
    const body = (await res.json()) as {
      status?: string;
      value?: { key: string; title: string; items: GalleryItem[] }[];
    };
    if (body.status !== "success" || !Array.isArray(body.value)) return [];
    return body.value.map((g) => ({ key: g.key, title: g.title, items: g.items, mode: "convex" as const }));
  } catch {
    return [];
  }
}
