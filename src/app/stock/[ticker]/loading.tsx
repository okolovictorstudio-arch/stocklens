import { Skeleton } from "@/components/ui/skeleton";
import { PriceChartSkeleton } from "@/components/stock/PriceChartSkeleton";

export default function StockLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Back button skeleton */}
      <Skeleton className="h-4 w-20 rounded" />

      {/* Header skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-4 pt-4 border-t border-border/50">
          <div className="flex items-baseline gap-3">
            <Skeleton className="h-10 w-36 rounded-md" />
            <Skeleton className="h-6 w-28 rounded-md" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
        </div>
      </div>

      {/* Price chart skeleton */}
      <PriceChartSkeleton />

      {/* Preview cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}
