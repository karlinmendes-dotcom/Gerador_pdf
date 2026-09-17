import { useEffect, useRef, useState } from "react";

/**
 * Detecta quando o elemento entra na área de carregamento do viewport.
 * Usado para lazy loading de assets pesados (Lottie) sem penalizar a
 * performance inicial — a rede só é acionada sob demanda.
 */
export function useInView<T extends HTMLElement>(rootMargin = "200px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView } as const;
}
