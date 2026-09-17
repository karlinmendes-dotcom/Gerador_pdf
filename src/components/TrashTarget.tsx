import { forwardRef } from "react";
import { motion } from "framer-motion";

interface TrashTargetProps {
  /** Dispara a sacudida quando um item "cai" nela. */
  wiggle: boolean;
}

/**
 * Alvo de lixeira fixo no canto da tela — recebe os cards que voam na
 * microinteração "Crumple & Toss" e reage com uma sacudida elástica.
 */
export const TrashTarget = forwardRef<HTMLDivElement, TrashTargetProps>(function TrashTarget(
  { wiggle },
  ref
) {
  return (
    <motion.div
      ref={ref}
      animate={wiggle ? { rotate: [0, -14, 12, -8, 0], scale: [1, 1.18, 1] } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="pointer-events-none fixed bottom-24 right-4 z-[70] hidden h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-3xl shadow-[0_0_30px_-6px_rgba(239,68,68,0.5)] backdrop-blur-xl md:flex md:bottom-10"
      aria-hidden
    >
      🗑️
    </motion.div>
  );
});
