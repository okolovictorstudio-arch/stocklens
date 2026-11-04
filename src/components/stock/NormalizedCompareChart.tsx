"use client";

import * as React from "react";
import {
  createChart,
  ColorType,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { Info, Calendar } from "lucide-react";
import type { NormalizedComparisonResult, NormalizedDataPoint } from "@/lib/analytics";

interface NormalizedCompareChartProps {
  symbolA: string;
  nameA: string;
  symbolB: string;
  nameB: string;
  normalizedData: Record<"1Y" | "3Y" | "5Y", NormalizedComparisonResult>;
}

export function NormalizedCompareChart({
  symbolA,
  nameA,
  symbolB,
  nameB,
  normalizedData,
}: NormalizedCompareChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const seriesARef = React.useRef<ISeriesApi<"Line"> | null>(null);
  const seriesBRef = React.useRef<ISeriesApi<"Line"> | null>(null);

  const [activeRange, setActiveRange] = React.useState<"1Y" | "3Y" | "5Y">("1Y");
  const [hoveredPoint, setHoveredPoint] = React.useState<NormalizedDataPoint | null>(null);

  const activeResult = normalizedData[activeRange];
  const chartData = React.useMemo(() => activeResult?.data || [], [activeResult]);

  // Helper to safely convert YYYY-MM-DD or Unix timestamp to UTCTimestamp
  const toUtcSec = React.useCallback((t: string | number): UTCTimestamp => {
    if (typeof t === "number") return t as UTCTimestamp;
    return Math.floor(new Date(t).getTime() / 1000) as UTCTimestamp;
  }, []);

  // Initialize and update Lightweight Charts canvas
  React.useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Clean up any existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)" },
        horzLines: { color: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)" },
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
        timeVisible: true,
      },
      crosshair: {
        vertLine: {
          color: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)",
          width: 1,
          style: 1,
        },
        horzLine: {
          color: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)",
          width: 1,
          style: 1,
        },
      },
      handleScale: true,
      handleScroll: true,
    });

    chartRef.current = chart;

    // Series A (Base stock - Emerald line)
    const seriesA = chart.addSeries(LineSeries, {
      color: "#10b981",
      lineWidth: 2,
      priceFormat: {
        type: "custom",
        formatter: (price: number) => {
          const ret = price - 100;
          return `${ret >= 0 ? "+" : ""}${ret.toFixed(1)}% (${price.toFixed(1)})`;
        },
      },
      title: symbolA,
    });
    seriesARef.current = seriesA;

    // Series B (Target stock - Sky blue line)
    const seriesB = chart.addSeries(LineSeries, {
      color: "#0284c7",
      lineWidth: 2,
      priceFormat: {
        type: "custom",
        formatter: (price: number) => {
          const ret = price - 100;
          return `${ret >= 0 ? "+" : ""}${ret.toFixed(1)}% (${price.toFixed(1)})`;
        },
      },
      title: symbolB,
    });
    seriesBRef.current = seriesB;

    // Baseline reference at 100 (Neutral dashed line)
    seriesA.createPriceLine({
      price: 100,
      color: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.2)",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Start (100)",
    });

    // Populate data
    if (chartData.length > 0) {
      const dataA = chartData.map((d) => ({
        time: toUtcSec(d.time),
        value: d.valueA,
      }));
      const dataB = chartData.map((d) => ({
        time: toUtcSec(d.time),
        value: d.valueB,
      }));

      seriesA.setData(dataA);
      seriesB.setData(dataB);
      chart.timeScale().fitContent();
    }

    // Subscribe to crosshair movement for synchronized inspection tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoveredPoint(null);
        return;
      }

      const valA = param.seriesData.get(seriesA) as { value?: number } | undefined;
      const valB = param.seriesData.get(seriesB) as { value?: number } | undefined;

      if (valA?.value !== undefined && valB?.value !== undefined) {
        setHoveredPoint({
          time: String(param.time),
          valueA: valA.value,
          valueB: valB.value,
        });
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || !entries[0]) return;
      const { width } = entries[0].contentRect;
      if (width > 0) {
        chart.applyOptions({ width });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData, isDark, symbolA, symbolB, toUtcSec]);

  const latestPt = chartData[chartData.length - 1] || null;
  const currentInspect = hoveredPoint || latestPt;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
      {/* Chart Header + Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="size-4 text-primary" />
            <span>Overlaid Performance (Normalized to 100)</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Both stocks start at 100 on day 1 so you can easily compare their growth rate side by side.
          </p>
        </div>

        {/* Range Buttons (1Y / 3Y / 5Y) - Min 44px tap targets */}
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-1 self-start sm:self-auto">
          {(["1Y", "3Y", "5Y"] as const).map((rng) => {
            const isActive = activeRange === rng;
            return (
              <button
                key={rng}
                type="button"
                onClick={() => {
                  setActiveRange(rng);
                  setHoveredPoint(null);
                }}
                className={`min-h-[44px] min-w-[44px] px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-foreground text-background shadow-xs font-bold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {rng}
              </button>
            );
          })}
        </div>
      </div>

      {/* Truncation / Overlapping Period Notice */}
      {activeResult?.isTruncated && activeResult.truncationNotice && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <Info className="size-4.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="leading-relaxed font-medium">
            {activeResult.truncationNotice}
          </p>
        </div>
      )}

      {/* Current Legend & Inspection Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-2.5 text-xs sm:text-sm font-sans tabular-nums">
        {/* Stock A (Emerald) */}
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-semibold text-foreground">{nameA} ({symbolA}):</span>
          {currentInspect ? (
            <span
              className={`font-bold ${
                currentInspect.valueA >= 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {currentInspect.valueA >= 100 ? "+" : ""}
              {(currentInspect.valueA - 100).toFixed(1)}%
              <span className="text-muted-foreground font-normal ml-1">
                (index: {currentInspect.valueA.toFixed(1)})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">--</span>
          )}
        </div>

        {/* Stock B (Sky) */}
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-sky-500 shrink-0" />
          <span className="font-semibold text-foreground">{nameB} ({symbolB}):</span>
          {currentInspect ? (
            <span
              className={`font-bold ${
                currentInspect.valueB >= 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {currentInspect.valueB >= 100 ? "+" : ""}
              {(currentInspect.valueB - 100).toFixed(1)}%
              <span className="text-muted-foreground font-normal ml-1">
                (index: {currentInspect.valueB.toFixed(1)})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">--</span>
          )}
        </div>
      </div>

      {/* Interactive Chart Canvas Container */}
      <div className="relative w-full overflow-hidden rounded-xl">
        <div ref={chartContainerRef} className="w-full" />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/60">
        <span>Timeline: {activeResult?.startDate} to {activeResult?.endDate}</span>
        <span>Baseline: 100 = start date price</span>
      </div>
    </div>
  );
}
