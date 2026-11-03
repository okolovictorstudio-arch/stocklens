import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

export function AIAnalysisSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
            <Sparkles className="size-4.5 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-64 rounded" />
          </div>
        </div>
        <Skeleton className="h-6 w-36 rounded-md" />
      </div>

      {/* Summary skeleton */}
      <div className="space-y-2 bg-muted/20 p-4 rounded-xl border border-border/40">
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse mb-1">
          <div className="size-2 rounded-full bg-sky-500 animate-ping" />
          <span>Synthesizing technical indicators and fundamentals with Gemini...</span>
        </div>
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-11/12 rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>

      {/* Strengths and Risks grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-5/6 rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
        </div>
        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-5/6 rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
        </div>
      </div>

      {/* Metrics explained skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-36 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
