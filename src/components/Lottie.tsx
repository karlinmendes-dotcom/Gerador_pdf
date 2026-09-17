import { lazy, Suspense, useRef, useState } from "react";
import { LOTTIE_ASSETS, type LottieAssetId } from "@/lib/lottie-assets";
import { useInView } from "@/lib/use-in-view";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/utils";
import type { DotLottie } from "@lottiefiles/dotlottie-web";

/**
 * Player DotLottie em chunk separado — a biblioteca (pesada) nunca entra no
 * bundle principal; é baixada apenas quando a primeira animação aparece.
 */
const DotLottieReact = lazy(() =>
  import("@lottiefiles/dotlottie-react").then((m) => ({ default: m.DotLottieReact }))
);

/** Modo de disparo da animação. */
type Trigger = "autoplay" | "hover";

interface BaseLottieProps {
  /** Chave do ativo registrado em lib/lottie-assets.ts. */
  asset: LottieAssetId;
  /** Classe de dimensão (ex: "h-12 w-12" ou "h-64 w-64"). */
  className?: string;
  /** Velocidade de reprodução (padrão: 1). */
  speed?: number;
}

interface LottieProps extends BaseLottieProps {
  /** Loop contínuo (padrão: true). */
  loop?: boolean;
}

/**
 * Animação Lottie nativa com carregamento progressivo em 3 estágios:
 *
 * 1. Skeleton → reserva o layout (zero layout shift).
 * 2. IntersectionObserver → a rede só é acionada quando o elemento se
 *    aproxima do viewport (rootMargin 200px). A Animação 4 (2.16 MB) nunca
 *    carrega "por cima da dobra" — só baixa sob demanda.
 * 3. Player em lazy chunk → a lib dotlottie não entra no bundle inicial.
 */
export function Lottie({ asset, className, loop = true, speed = 1 }: LottieProps) {
  const meta = LOTTIE_ASSETS[asset];
  const { ref, inView } = useInView<HTMLDivElement>("200px");
  const [ready, setReady] = useState(false);

  return (
    <div ref={ref} className={cn("relative", className)} aria-label={meta.alt} role="img">
      {!ready && <Skeleton className="absolute inset-0" />}
      {inView && (
        <Suspense fallback={<Skeleton className="absolute inset-0" />}>
          <DotLottieReact
            src={meta.url}
            autoplay
            loop={loop}
            speed={speed}
            backgroundColor="transparent"
            className="relative z-10 h-full w-full"
            dotLottieRefCallback={bindInstance(setReady)}
          />
        </Suspense>
      )}
    </div>
  );
}

/**
 * Ícone animado reutilizável com micro-interação de hover.
 *
 * Por padrão anima só quando o ponteiro passa por cima (`trigger="hover"`),
 * evitando tela poluída com tudo rodando — sensação de dinamismo e qualidade.
 * Alinhamento com texto garantido pelo wrapper flex shrink-0.
 */
export function AnimatedIcon({
  asset,
  className,
  trigger = "hover",
  speed = 1,
}: BaseLottieProps & { trigger?: Trigger }) {
  const meta = LOTTIE_ASSETS[asset];
  const { ref, inView } = useInView<HTMLSpanElement>("150px");
  const [ready, setReady] = useState(false);
  const instanceRef = useRef<DotLottie | null>(null);

  const play = () => void instanceRef.current?.play();
  const stop = () => void instanceRef.current?.stop();

  return (
    <span
      ref={ref}
      onMouseEnter={trigger === "hover" ? play : undefined}
      onMouseLeave={trigger === "hover" ? stop : undefined}
      className={cn("inline-flex shrink-0 items-center justify-center align-middle", className)}
      aria-label={meta.alt}
      role="img"
    >
      {!ready && <Skeleton className="absolute inset-1 rounded-lg" />}
      {inView && (
        <Suspense fallback={null}>
          <DotLottieReact
            src={meta.url}
            autoplay={trigger === "autoplay"}
            loop={trigger === "autoplay"}
            speed={speed}
            backgroundColor="transparent"
            className="relative z-10 h-full w-full"
            dotLottieRefCallback={(instance) => {
              instanceRef.current = instance;
              bindInstance(setReady)(instance);
            }}
          />
        </Suspense>
      )}
    </span>
  );
}

/** Liga os eventos oficiais de load/ready e um timeout de segurança. */
function bindInstance(setReady: (v: boolean) => void) {
  return (instance: DotLottie | null) => {
    if (!instance) return;
    const markReady = () => setReady(true);
    instance.addEventListener("load", markReady);
    instance.addEventListener("ready", markReady);
    // Segurança: nunca deixa o skeleton bloquear a UI.
    setTimeout(markReady, 1200);
  };
}
