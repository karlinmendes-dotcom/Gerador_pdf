import { cn } from "@/lib/utils";

/**
 * Skeleton screen — estado de carregamento padrão do design system.
 * Use `className` para controlar largura/altura e empilhe para compor layouts.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-xl border border-white/[0.06] bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] bg-[length:200%_100%]",
        className
      )}
    />
  );
}

/** Skeleton do card de documento no dashboard. */
export function DocumentCardSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-2.5 w-28" />
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
      </div>
    </div>
  );
}

/** Skeleton das estatísticas do dashboard. */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[76px] w-full" />
      ))}
    </div>
  );
}
