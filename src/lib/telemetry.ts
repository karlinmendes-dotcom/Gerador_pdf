/**
 * Observabilidade leve do PDFForge Brasil.
 *
 * - `track(event, props)` — eventos de produto (ex: "pdf_generated", "pix_paid").
 * - `captureError(err, ctx)` — captura erros de runtime/rede.
 * - Buffer local + flush periódico para `POST /api/telemetry` (fire-and-forget).
 * - 100% offline-safe: falhas de rede são silenciosas e o buffer é descartado
 *   sem impactar a UI. Nenhum dado sensível (senhas, chaves) passa por aqui.
 */

export type TelemetryEvent =
  | "page_view"
  | "pdf_generated"
  | "document_saved"
  | "auth_signin"
  | "auth_signup"
  | "auth_signout"
  | "pix_checkout_created"
  | "pix_paid"
  | "ai_structured"
  | "ai_fallback"
  | "qr_generated"
  | "gallery_created"
  | "resume_generated"
  | "error";

interface TelemetryRecord {
  event: TelemetryEvent;
  props?: Record<string, string | number | boolean>;
  ts: number;
  /** URL da página no momento do evento (sem query, por privacidade). */
  page?: string;
}

const BUFFER_KEY = "pdfforge:telemetry";
const MAX_BUFFER = 40;
const FLUSH_INTERVAL = 15_000;

let buffer: TelemetryRecord[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function loadBuffer(): TelemetryRecord[] {
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    buffer = raw ? (JSON.parse(raw) as TelemetryRecord[]) : [];
  } catch {
    buffer = [];
  }
  return buffer;
}

function persistBuffer() {
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(buffer.slice(-MAX_BUFFER)));
  } catch {
    /* quota — ignora */
  }
}

function scheduleFlush() {
  if (timer) return;
  timer = setInterval(() => void flush(), FLUSH_INTERVAL);
}

/** Envia o buffer acumulado para o endpoint serverless (se houver). */
export async function flush(): Promise<boolean> {
  if (buffer.length === 0) return true;
  const batch = buffer.splice(0, buffer.length);
  persistBuffer();
  try {
    const res = await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
    return res.ok;
  } catch {
    // Dev puro (sem serverless) ou rede offline: devolve ao buffer, com teto.
    buffer = [...batch, ...buffer].slice(-MAX_BUFFER);
    persistBuffer();
    return false;
  }
}

function record(event: TelemetryEvent, props?: Record<string, string | number | boolean>) {
  try {
    loadBuffer();
    buffer.push({
      event,
      props,
      ts: Date.now(),
      page: typeof location !== "undefined" ? location.pathname : undefined,
    });
    buffer = buffer.slice(-MAX_BUFFER);
    persistBuffer();
    scheduleFlush();
    // Erros também vão direto ao console para depuração local.
    if (event === "error" && props?.message) {
      console.error("[pdfforge]", props.message);
    }
  } catch {
    /* nunca quebra a UI por telemetria */
  }
}

/** Registra um evento de produto. */
export function track(event: TelemetryEvent, props?: Record<string, string | number | boolean>) {
  record(event, props);
}

/** Captura um erro (Error, string ou desconhecido) com contexto opcional. */
export function captureError(err: unknown, context?: Record<string, string | number | boolean>) {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "unknown_error";
  record("error", { message: message.slice(0, 300), ...context });
}

/** Global handlers — instale uma única vez no bootstrap do app. */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __pdfforge_telemetry?: boolean };
  if (w.__pdfforge_telemetry) return;
  w.__pdfforge_telemetry = true;

  window.addEventListener("error", (e) => {
    captureError(e.error ?? e.message, { source: "window.onerror" });
  });
  window.addEventListener("unhandledrejection", (e) => {
    captureError(e.reason, { source: "unhandledrejection" });
  });
}

/** Resumo local (exibível em diagnóstico sem expor payload). */
export function stats(): { buffered: number; lastEvent?: TelemetryEvent } {
  loadBuffer();
  return { buffered: buffer.length, lastEvent: buffer[buffer.length - 1]?.event };
}
