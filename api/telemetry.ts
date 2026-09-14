import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Endpoint de observabilidade (POST /api/telemetry).
 *
 * Recebe lotes de eventos do cliente, valida o formato, agrega contadores em
 * memória (por instância serverless) e responde 204 rapidamente. É um coletor
 * leve, pronto para ser plugado a um sink externo (Logtail, Axiom, Datadog…)
 * definindo `TELEMETRY_SINK_URL` — os eventos são repassados fire-and-forget.
 */

const MAX_BATCH = 50;
const MAX_EVENTS = 5000;

interface IncomingEvent {
  event?: unknown;
  props?: unknown;
  ts?: unknown;
  page?: unknown;
}

// Contadores agregados por instância (resetam a cada cold start — aceitável
// para métricas leves de produto; persistência forte ficaria num banco).
const counters = new Map<string, number>();

function bump(key: string, by = 1) {
  const next = (counters.get(key) ?? 0) + by;
  counters.set(key, Math.min(next, MAX_EVENTS));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const body = req.body as { events?: IncomingEvent[] } | null;
    const events = Array.isArray(body?.events) ? body!.events!.slice(0, MAX_BATCH) : [];

    for (const e of events) {
      if (typeof e?.event !== "string" || e.event.length === 0 || e.event.length > 64) continue;
      bump(`event:${e.event}`);
      if (e.page && typeof e.page === "string") bump(`page:${e.page.slice(0, 120)}`);
    }

    // Sink externo opcional (fire-and-forget, nunca bloqueia a resposta).
    const sink = process.env.TELEMETRY_SINK_URL;
    if (sink && events.length > 0) {
      void fetch(sink, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      }).catch(() => undefined);
    }

    return res.status(204).end();
  } catch {
    // Telemetria nunca deve falhar ruidosamente.
    return res.status(204).end();
  }
}

/** GET diagnóstico (contadores desta instância) — útil em smoke tests. */
export function countersSnapshot(): Record<string, number> {
  return Object.fromEntries(counters);
}
