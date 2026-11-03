import { Skeleton } from "@/components/ui/skeleton";

export function PriceChartSkeleton() {
  return (
    <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
      {/* Header controls skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <div className="flex items-center gap-1.5">
          {["1D", "1W", "1M", "6M", "1Y", "5Y"].map((r) => (
            <Skeleton key={r} className="h-7 w-9 rounded-md" />
          ))}
        </div>
      </div>

      {/* Main chart canvas placeholder */}
      <div className="relative h-[360px] sm:h-[420px] w-full rounded-xl bg-muted/20 flex flex-col justify-end p-6 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <div className="size-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Loading historical price candles...</span>
          </div>
        </div>

        {/* Mock wave bars */}
        <div className="flex items-end gap-2 w-full h-32 opacity-20">
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-xs"
              style={{ height: `${20 + ((i * 17) % 80)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
