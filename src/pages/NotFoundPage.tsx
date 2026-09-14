import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

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
 * Página 404 interativa — uma "forja" vetorial que reage ao cursor:
 * faíscas surgem na direção do mouse e a bigorna inclina sutilmente.
 * Ilustração 100% SVG inline, sem assets externos.
 */
export default function NotFoundPage() {
  const nav = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const sparkId = useRef(0);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [tilt, setTilt] = useState(0);

  const handleMove = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Inclinação da bigorna proporcional à posição horizontal (±8°).
    setTilt(((x / rect.width) * 2 - 1) * 8);

    // Nova faísca (limitada a 26 simultâneas para manter fluidez).
    const spark: Spark = {
      id: sparkId.current++,
      x,
      y,
      dx: (Math.random() - 0.5) * 120,
      dy: -40 - Math.random() * 110,
      size: 3 + Math.random() * 6,
      hue: 35 + Math.random() * 45,
    };
    setSparks((prev) => [...prev.slice(-25), spark]);
    setTimeout(() => {
      setSparks((prev) => prev.filter((s) => s.id !== spark.id));
    }, 900);
  };

  const anvilGradient = useMemo(
    () => (
      <defs>
        <linearGradient id="anvil-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="45%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id="anvil-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
    ),
    []
  );

  return (
    <div
      ref={stageRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4"
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) handleMove(t.clientX, t.clientY);
      }}
    >
      <div className="grid-backdrop absolute inset-0" />
      <motion.div
        animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.1, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-[34rem] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[110px]"
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 flex flex-col items-center text-center"
      >
        {/* Ilustração: 404 forjado sobre a bigorna */}
        <motion.svg
          width="320"
          height="230"
          viewBox="0 0 320 230"
          className="mb-6 drop-shadow-[0_0_36px_rgba(139,92,246,0.45)]"
          role="img"
          aria-label="Página não encontrada — 404"
        >
          {anvilGradient}
          {/* Número 404 */}
          <text
            x="160"
            y="92"
            textAnchor="middle"
            fontSize="64"
            fontWeight="800"
            fill="url(#anvil-steel)"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="2"
          >
            404
          </text>

          {/* Bigorna (inclina com o cursor) */}
          <motion.g
            animate={{ rotate: tilt }}
            transition={{ type: "spring", damping: 14, stiffness: 120 }}
            style={{ originX: "160px", originY: "190px" }}
          >
            {/* corpo da bigorna */}
            <path
              d="M84 150 L236 150 L214 168 L196 168 L196 186 C196 194 190 198 182 198 L138 198 C130 198 124 194 124 186 L124 168 L106 168 Z"
              fill="url(#anvil-steel)"
              stroke="rgba(129,140,248,0.55)"
              strokeWidth="2"
            />
            {/* chifre */}
            <path
              d="M236 150 C272 148 292 156 296 166 C298 172 292 176 284 174 C268 170 252 166 236 166 Z"
              fill="url(#anvil-steel)"
              stroke="rgba(129,140,248,0.55)"
              strokeWidth="2"
            />
            {/* base */}
            <rect x="112" y="198" width="96" height="14" rx="5" fill="url(#anvil-base)" opacity="0.9" />
            {/* brilho superior */}
            <rect x="96" y="146" width="128" height="6" rx="3" fill="#c7d2fe" opacity="0.8" />
          </motion.g>

          {/* centelha fixa sobre a bigorna */}
          <motion.circle
            cx="160"
            cy="140"
            r="5"
            fill="#fde68a"
            animate={{ opacity: [1, 0.3, 1], scale: [1, 1.6, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        </motion.svg>

        <h1 className="mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">
          Esta página <span className="text-gradient">não foi forjada</span>
        </h1>
        <p className="mb-8 max-w-md text-sm text-silver md:text-base">
          O endereço que você tentou acessar não existe ou foi movido. A forja continua quente —
          volte e gere seu documento em segundos.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={() => nav("/")}>
            ← Voltar ao início
          </Button>
          <Button size="lg" variant="outline" onClick={() => nav("/app")}>
            Ir para o Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
