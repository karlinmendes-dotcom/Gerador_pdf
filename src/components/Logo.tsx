import { cn } from "@/lib/utils";

/**
 * Logo oficial da PDFForge Brasil — SVG inline (sem assets externos).
 * Marca: documento com cantos inferiores "forjados" (chanfro) e acento
 * azul royal #0066FF. Usada no header, sidebar, favicon e modais.
 */
export function LogoMark({
  className,
  style,
  size,
}: {
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-9 w-9", className)}
      style={size ? { width: size, height: size, ...style } : style}
      aria-hidden
    >
      {/* Fundo arredondado azul royal */}
      <rect width="40" height="40" rx="9" fill="#0066FF" />
      {/* Folha do documento com canto dobrado */}
      <path
        d="M13 10h10.5L30 16.5V29a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z"
        fill="#ffffff"
        fillOpacity="0.96"
      />
      <path d="M23.5 10 30 16.5h-5a1.5 1.5 0 0 1-1.5-1.5V10z" fill="#BFDBFE" />
      {/* Linhas de texto — a do meio curta reforça o conceito "express" */}
      <rect x="17" y="19.5" width="9" height="2" rx="1" fill="#0066FF" />
      <rect x="17" y="23.5" width="9" height="2" rx="1" fill="#93C5FD" />
      <rect x="17" y="27.5" width="5" height="2" rx="1" fill="#93C5FD" />
      {/* Acento "forja": faixa diagonal inferior */}
      <path d="M4 33.5 36 24v3.5L4 37v-3.5z" fill="#ffffff" fillOpacity="0.28" />
    </svg>
  );
}

interface LogoProps {
  /** Tamanho da marca em px (default 36). */
  size?: number;
  /** Exibe o lockup completo (marca + nome + tagline). */
  withText?: boolean;
  tagline?: string;
  className?: string;
}

/** Lockup completo: LogoMark + "PDFForge Brasil" + tagline opcional. */
export function Logo({ size = 36, withText = true, tagline, className }: LogoProps) {
  if (!withText) return <LogoMark style={{ width: size, height: size }} className={className} />;
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="shrink-0" style={{ width: size, height: size }} />
      <span className="text-left leading-tight" style={{ minWidth: 0 }}>
        <span className="block text-sm font-bold tracking-tight text-slate-900">
          PDFForge Brasil
        </span>
        <span className="block truncate text-[10px] text-slate-500">
          {tagline ?? "Gerador de Documentos Express"}
        </span>
      </span>
    </span>
  );
}
