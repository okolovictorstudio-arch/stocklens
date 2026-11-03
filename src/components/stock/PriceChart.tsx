"use client";

import * as React from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import {
  CandlestickChart,
  LineChart as LineChartIcon,
  AlertCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CandleDataPoint, TimeRange } from "@/types/stock";

interface PriceChartProps {
  symbol: string;
  initialRange: TimeRange;
  initialCandles: CandleDataPoint[];
  basePrice: number;
  initialRateLimited?: boolean;
  initialErrorMessage?: string;
  isMockData?: boolean;
}

const RANGES: TimeRange[] = ["1D", "1W", "1M", "6M", "1Y", "5Y"];

export function PriceChart({
  symbol,
  initialRange,
  initialCandles,
  basePrice,
  initialRateLimited = false,
  initialErrorMessage,
  isMockData = false,
}: PriceChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  const chartInstanceRef = React.useRef<IChartApi | null>(null);
  const candlestickSeriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null);
  const areaSeriesRef = React.useRef<ISeriesApi<"Area"> | null>(null);

  const [chartType, setChartType] = React.useState<"candlestick" | "line">("candlestick");
  const [activeRange, setActiveRange] = React.useState<TimeRange>(initialRange);
  const [candles, setCandles] = React.useState<CandleDataPoint[]>(initialCandles);
  const [isLoading, setIsLoading] = React.useState(false);
  const [rateLimited, setRateLimited] = React.useState(initialRateLimited);
  const [errorMessage, setErrorMessage] = React.useState(initialErrorMessage);
  const [hoveredPoint, setHoveredPoint] = React.useState<CandleDataPoint | null>(null);

  // Range change handler
  const handleRangeChange = async (newRange: TimeRange) => {
    if (newRange === activeRange && !rateLimited) return;
    setActiveRange(newRange);
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const res = await fetch(
        `/api/candles?symbol=${encodeURIComponent(symbol)}&range=${newRange}&basePrice=${basePrice}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.candles && data.candles.length > 0) {
          setCandles(data.candles);
        }
        setRateLimited(Boolean(data.isRateLimited));
        if (data.isRateLimited) {
          setErrorMessage(data.errorMessage || "Twelve Data rate limit reached (8 calls/min).");
        } else if (!data.isAvailable && data.errorMessage) {
          setErrorMessage(data.errorMessage);
        }
      }
    } catch (err) {
      console.error("Failed to fetch range candles:", err);
      setErrorMessage("Data temporarily unavailable. Please try again shortly.");
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize and recreate chart when container or theme changes
  React.useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    container.innerHTML = "";

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "#f4f4f5" },
        horzLines: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "#f4f4f5" },
      },
      crosshair: {
        vertLine: {
          color: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
          width: 1,
          style: 3,
        },
        horzLine: {
          color: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
          width: 1,
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e4e4e7",
        scaleMargins: { top: 0.1, bottom: 0.15 },
      },
      timeScale: {
        borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e4e4e7",
        timeVisible: activeRange === "1D" || activeRange === "1W",
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    // Format candle series data for Lightweight Charts
    const formattedCandles = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // Add candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", // emerald-500
      downColor: "#ef4444", // rose-500
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    candlestickSeriesRef.current = candleSeries;

    // Add area line series (for smooth line mode)
    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: isDark ? "rgba(16, 185, 129, 0.28)" : "rgba(16, 185, 129, 0.2)",
      bottomColor: "transparent",
      lineColor: "#10b981",
      lineWidth: 2,
    });
    areaSeriesRef.current = areaSeries;

    // Set series visibility based on active chartType
    if (chartType === "candlestick") {
      candleSeries.setData(formattedCandles);
      areaSeries.applyOptions({ visible: false });
    } else {
      areaSeries.setData(
        formattedCandles.map((c) => ({ time: c.time, value: c.close }))
      );
      candleSeries.applyOptions({ visible: false });
    }

    chart.timeScale().fitContent();

    // Crosshair move listener for inspection bar
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.time ||
        !param.point ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > 380
      ) {
        setHoveredPoint(null);
        return;
      }

      const match = candles.find((c) => c.time === param.time);
      if (match) {
        setHoveredPoint(match);
      }
    });

    // Resize observer
    const handleResize = () => {
      if (container && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ width: container.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, [candles, chartType, isDark, activeRange]);

  const latestCandle = candles[candles.length - 1] || null;
  const inspected = hoveredPoint || latestCandle;

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
      {/* Rate limit / Unavailable notice */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <span>{errorMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => handleRangeChange(activeRange)}
            className="h-6 text-[11px] gap-1 hover:bg-amber-500/20 text-amber-900 dark:text-amber-100"
          >
            <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* Demo / Sample data notice */}
      {isMockData && !errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 text-muted-foreground" />
          <span>Showing synthetic preview candles. Add <code className="font-mono text-[11px] text-foreground">TWELVE_DATA_API_KEY</code> to load real-time market historical data.</span>
        </div>
      )}

      {/* Controls Bar: Type toggle, Hover details, Range buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        {/* Left: Chart Style Toggle & Indicators */}
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setChartType("candlestick")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                chartType === "candlestick"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Candlestick chart"
            >
              <CandlestickChart className="size-3.5" />
              <span>Candles</span>
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                chartType === "line"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Line area chart"
            >
              <LineChartIcon className="size-3.5" />
              <span>Line</span>
            </button>
          </div>

          <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-mono font-normal text-muted-foreground">
            Lightweight Charts™
          </Badge>
        </div>

        {/* Right: Time Range Buttons */}
        <div className="flex items-center gap-1 self-start sm:self-auto">
          {RANGES.map((range) => {
            const isActive = activeRange === range;
            return (
              <button
                key={range}
                onClick={() => handleRangeChange(range)}
                disabled={isLoading}
                className={`rounded-md px-2.5 py-1 text-xs font-medium font-mono transition-colors cursor-pointer ${
                  isActive
                    ? "bg-foreground text-background shadow-2xs font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Hover Metric Bar */}
      {inspected && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-lg border border-border/40">
          <div>
            <span className="text-[10px] uppercase text-muted-foreground/80">O: </span>
            <span className="font-semibold text-foreground tabular-nums">${inspected.open.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground/80">H: </span>
            <span className="font-semibold text-foreground tabular-nums">${inspected.high.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground/80">L: </span>
            <span className="font-semibold text-foreground tabular-nums">${inspected.low.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground/80">C: </span>
            <span className="font-semibold text-foreground tabular-nums">${inspected.close.toFixed(2)}</span>
          </div>
          {inspected.volume && (
            <div className="hidden sm:block">
              <span className="text-[10px] uppercase text-muted-foreground/80">Vol: </span>
              <span className="text-foreground tabular-nums">{inspected.volume.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Interactive Chart Canvas Container */}
      <div className="relative w-full overflow-hidden rounded-xl">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-2xs">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <RefreshCw className="size-3.5 animate-spin text-emerald-500" />
              <span>Updating timeframe...</span>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
      </div>
    </div>
  );
}
