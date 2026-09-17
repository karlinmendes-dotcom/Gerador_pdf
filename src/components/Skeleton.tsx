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
        "animate-pulse rounded-xl border border-slate-100 bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 bg-[length:200%_100%]",
        className
      )}
    />
  );
}

/** Skeleton do card de documento no dashboard. */
export function DocumentCardSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[86px] w-full" />
      ))}
    </div>
  );
}
