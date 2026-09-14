import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

type Phase = "idle" | "busy" | "done";

interface AnimatedDownloadButtonProps {
  /** Ação assíncrona (ex: downloadPdf). Lançar erro volta para idle. */
  onDownload: () => Promise<void> | void;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  children?: React.ReactNode;
  title?: string;
}

/**
 * Botão de download "vivo": enquanto o PDF é compilado exibe um paraquedas
 * descendo (animação de entrega) e, ao concluir, um check que estala.
 */
export function AnimatedDownloadButton({
  onDownload,
  size = "icon",
  variant = "ghost",
  className,
  children,
  title,
}: AnimatedDownloadButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");

  const handle = async () => {
    if (phase !== "idle") return;
    setPhase("busy");
    try {
      await onDownload();
      setPhase("done");
      setTimeout(() => setPhase("idle"), 1900);
    } catch {
      setPhase("idle");
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      title={title}
      disabled={phase === "busy"}
      onClick={() => void handle()}
    >
      <AnimatePresence mode="wait" initial={false}>
        {phase === "busy" ? (
          <motion.span
            key="busy"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            className="relative inline-flex h-4 w-4 items-end justify-center"
          >
            {/* Paraquedas + pacote descendo */}
            <motion.span
              animate={{ y: [-4, 2, -4], rotate: [-6, 6, -6] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-1 inline-block"
            >
              <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden>
                <path d="M8 0 C11.5 0 15 2 15.5 4.5 L8 4.5 Z" fill="rgba(167,139,250,0.9)" />
                <path d="M8 0 C4.5 0 1 2 0.5 4.5 L8 4.5 Z" fill="rgba(129,140,248,0.9)" />
                <path d="M0.5 4.5 L8 4.5 L15.5 4.5 M8 4.5 L8 7" stroke="rgba(196,181,253,0.8)" strokeWidth="0.8" fill="none" />
              </svg>
            </motion.span>
            <motion.span
              animate={{ y: [-2, 3] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "easeIn" }}
              className="absolute bottom-0 h-1.5 w-2.5 rounded-sm bg-gradient-to-b from-indigo-300 to-purple-500"
            />
          </motion.span>
        ) : phase === "done" ? (
          <motion.span
            key="done"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", damping: 10, stiffness: 300 }}
            className="inline-block text-emerald-400"
          >
            ✓
          </motion.span>
        ) : (
          <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {children ?? "⬇"}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
