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
