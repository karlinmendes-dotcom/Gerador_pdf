import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lottie } from "@/components/Lottie";

interface Spark {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  hue: number;
}

/**
 * 404 imersiva — painel dark glassmorphism com mascote vetorial que segue
 * o ponteiro (rotação + deslocamento), faíscas na direção do cursor e
 * botões com brilho em gradiente. Ilustração 100% SVG inline.
 */
export default function NotFoundPage() {
  const nav = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const sparkId = useRef(0);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [pose, setPose] = useState({ rx: 0, ry: 0, tx: 0, ty: 0 });

  const handleMove = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = (clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
    const ny = (clientY - rect.top) / rect.height - 0.5;

    // Mascote gira/desloca na direção do cursor (efeito 3D sutil).
    setPose({
      rx: ny * -18,
      ry: nx * 24,
      tx: nx * 14,
      ty: ny * 10,
    });

    // Faísca nova (teto de 26 simultâneas).
    const spark: Spark = {
      id: sparkId.current++,
      x: clientX - rect.left,
      y: clientY - rect.top,
      dx: (Math.random() - 0.5) * 130,
      dy: -50 - Math.random() * 110,
      size: 3 + Math.random() * 6,
      hue: 35 + Math.random() * 45,
    };
    setSparks((prev) => [...prev.slice(-25), spark]);
    setTimeout(() => setSparks((prev) => prev.filter((s) => s.id !== spark.id)), 900);
  };

  const gradients = useMemo(
    () => (
      <defs>
        <linearGradient id="mascot-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="45%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id="mascot-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c7d2fe" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
      </defs>
    ),
    []
  );

  return (
    <div
      ref={stageRef}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) handleMove(t.clientX, t.clientY);
      }}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4"
    >
      <div className="grid-backdrop absolute inset-0" />
      <motion.div
        animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.1, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-[34rem] -translate-x-1/2 rounded-full bg-blue-400/15 blur-[110px]"
      />

      {/* Faíscas que seguem o cursor */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {sparks.map((s) => (
          <motion.span
            key={s.id}
            initial={{ x: s.x, y: s.y, opacity: 1, scale: 1 }}
            animate={{ x: s.x + s.dx, y: s.y + s.dy + 220, opacity: 0, scale: 0.2 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{
              width: s.size,
              height: s.size,
              background: `radial-gradient(circle, hsl(${s.hue} 100% 75%), hsl(${s.hue} 100% 55%))`,
              boxShadow: `0 0 12px 2px hsl(${s.hue} 100% 60% / 0.7)`,
            }}
          />
        ))}
      </div>

      {/* Painel dark glassmorphism */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 w-full max-w-xl rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-xl shadow-slate-200/60 backdrop-blur md:p-12"
      >
        {/* Mascote vetorial que reage ao ponteiro */}
        <motion.div
          animate={{ rotateX: pose.rx, rotateY: pose.ry, x: pose.tx, y: pose.ty }}
          transition={{ type: "spring", damping: 15, stiffness: 140 }}
          style={{ transformPerspective: 700 }}
          className="mx-auto mb-6 w-fit"
        >
          <svg
            width="190"
            height="190"
            viewBox="0 0 190 190"
            role="img"
            aria-label="Mascote página não encontrada"
            className="drop-shadow-[0_0_34px_rgba(139,92,246,0.55)]"
          >
            {gradients}
            {/* corpo (folha robusta) */}
            <path
              d="M95 18 C130 18 152 40 152 78 C152 120 132 158 95 172 C58 158 38 120 38 78 C38 40 60 18 95 18 Z"
              fill="url(#mascot-body)"
              stroke="rgba(165,180,252,0.6)"
              strokeWidth="2.5"
            />
            {/* rosto */}
            <motion.g
              animate={{ x: pose.tx * 0.45, y: pose.ty * 0.45 }}
              transition={{ type: "spring", damping: 14, stiffness: 130 }}
            >
              {/* olhos */}
              <motion.circle
                cx="78"
                cy="80"
                r="9"
                fill="url(#mascot-face)"
                animate={{ scaleY: [1, 0.15, 1] }}
                transition={{ duration: 0.28, repeat: Infinity, repeatDelay: 2.6 }}
                style={{ originY: "80px" }}
              />
              <motion.circle
                cx="112"
                cy="80"
                r="9"
                fill="url(#mascot-face)"
                animate={{ scaleY: [1, 0.15, 1] }}
                transition={{ duration: 0.28, repeat: Infinity, repeatDelay: 2.6 }}
                style={{ originY: "80px" }}
              />
              {/* pupilas seguem o cursor */}
              <motion.circle cx="78" cy="80" r="3.6" fill="#1e1b4b" animate={{ x: pose.tx * 0.22, y: pose.ty * 0.3 }} />
              <motion.circle cx="112" cy="80" r="3.6" fill="#1e1b4b" animate={{ x: pose.tx * 0.22, y: pose.ty * 0.3 }} />
              {/* bochechas */}
              <circle cx="66" cy="100" r="5" fill="rgba(244,114,182,0.45)" />
              <circle cx="124" cy="100" r="5" fill="rgba(244,114,182,0.45)" />
              {/* boca */}
              <motion.path
                d="M80 114 Q95 108 110 114"
                stroke="#1e1b4b"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                animate={{ d: ["M80 114 Q95 108 110 114", "M80 112 Q95 118 110 112", "M80 114 Q95 108 110 114"] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
            </motion.g>
            {/* canto de página dobrado */}
            <path d="M152 78 L152 106 L124 78 Z" fill="rgba(15,23,42,0.45)" />
          </svg>
        </motion.div>

        {/* Animação 4 (~2.16 MB) — lazy total: só baixa quando esta página
            carrega E o elemento entra no viewport (fora da dobra inicial). */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mx-auto -mt-2 mb-2 flex w-fit justify-center"
        >
          <Lottie asset="forge" className="h-40 w-40" loop={false} />
        </motion.div>

        <p className="mb-1 font-mono text-sm tracking-[0.35em] text-blue-600/80">ERRO 404</p>
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">
          Esta página <span className="text-gradient">não foi forjada</span>
        </h1>
        <p className="mx-auto mb-8 max-w-md text-sm text-silver md:text-base">
          O endereço que você tentou acessar não existe ou foi movido. A forja continua quente —
          volte e gere seu documento em segundos.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {/* Botão com brilho em gradiente */}
          <motion.button
            type="button"
            onClick={() => nav("/")}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-shadow hover:bg-blue-700"
          >
            ← Voltar ao Início
          </motion.button>
          <motion.button
            type="button"
            onClick={() => nav("/app")}
            whileHover={{ scale: 1.04, borderColor: "rgba(168,85,247,0.6)" }}
            whileTap={{ scale: 0.96 }}
            className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            Ir para o Dashboard
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
