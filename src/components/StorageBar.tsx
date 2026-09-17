import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Document, Receipt } from "@/lib/store";

interface StorageBarProps {
  documents: Document[];
  receipts: Receipt[];
}

/** Orçamento visual de armazenamento local (demo: ~2 MB). */
const BUDGET_BYTES = 2 * 1024 * 1024;

function estimateBytes(documents: Document[], receipts: Receipt[]): number {
  try {
    return (
      new Blob([JSON.stringify(documents)]).size +
      new Blob([JSON.stringify(receipts)]).size
    );
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Barra de memória/armazenamento local com transição suave — atualiza
 * simultaneamente à animação "Crumple & Toss" da exclusão de documentos.
 */
export function StorageBar({ documents, receipts }: StorageBarProps) {
  const used = useMemo(() => estimateBytes(documents, receipts), [documents, receipts]);
  const pct = Math.min((used / BUDGET_BYTES) * 100, 100);

  return (
    <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-slate-600">Armazenamento local</span>
        <span className="font-mono text-slate-500">
          {formatBytes(used)} / {formatBytes(BUDGET_BYTES)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", damping: 26, stiffness: 180 }}
          className={`h-full rounded-full ${
            pct > 85
              ? "bg-gradient-to-r from-red-500 to-amber-400"
              : "bg-blue-600"
          }`}
        />
      </div>
    </div>
  );
}
