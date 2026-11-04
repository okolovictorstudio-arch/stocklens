"use client";

import * as React from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import {
  CandlestickChart,
  LineChart as LineChartIcon,
  AlertCircle,
  RefreshCw,
  Clock,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
} from "@/lib/indicators";
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

  // Chart DOM containers
  const mainChartContainerRef = React.useRef<HTMLDivElement>(null);
  const rsiContainerRef = React.useRef<HTMLDivElement>(null);
  const macdContainerRef = React.useRef<HTMLDivElement>(null);

  // Chart instances
  const mainChartRef = React.useRef<IChartApi | null>(null);
  const rsiChartRef = React.useRef<IChartApi | null>(null);
  const macdChartRef = React.useRef<IChartApi | null>(null);

  // State
  const [chartType, setChartType] = React.useState<"candlestick" | "line">("candlestick");
  const [activeRange, setActiveRange] = React.useState<TimeRange>(initialRange);
  const [candles, setCandles] = React.useState<CandleDataPoint[]>(initialCandles);
  const [isLoading, setIsLoading] = React.useState(false);
  const [rateLimited, setRateLimited] = React.useState(initialRateLimited);
  const [errorMessage, setErrorMessage] = React.useState(initialErrorMessage);
  const [hoveredPoint, setHoveredPoint] = React.useState<CandleDataPoint | null>(null);
  const [showAdvancedTools, setShowAdvancedTools] = React.useState(false);

  // Indicator Toggle Overlays (Hidden by default for beginner simplicity)
  const [showSMA20, setShowSMA20] = React.useState(false);
  const [showSMA50, setShowSMA50] = React.useState(false);
  const [showSMA200, setShowSMA200] = React.useState(false);
  const [showEMA20, setShowEMA20] = React.useState(false);
  const [showVolume, setShowVolume] = React.useState(false);

  // Oscillators in separate panes
  const [showRSI, setShowRSI] = React.useState(false);
  const [showMACD, setShowMACD] = React.useState(false);

  // Locally calculated indicators (instant, 0 API credits)
  const sma20Data = React.useMemo(() => calculateSMA(candles, 20), [candles]);
  const sma50Data = React.useMemo(() => calculateSMA(candles, 50), [candles]);
  const sma200Data = React.useMemo(() => calculateSMA(candles, 200), [candles]);
  const ema20Data = React.useMemo(() => calculateEMA(candles, 20), [candles]);
  const rsi14Data = React.useMemo(() => calculateRSI(candles, 14), [candles]);
  const macdData = React.useMemo(() => calculateMACD(candles, 12, 26, 9), [candles]);

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
          setErrorMessage(undefined);
        } else {
          // If no candles for this range, keep existing candles visible so chart doesn't break
          setErrorMessage(
            data.errorMessage ||
              `Intraday chart (${newRange}) is not available on the free market data plan. Try 1M, 6M, 1Y, or 5Y to see the price history.`
          );
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
      setErrorMessage(
        `Intraday chart (${newRange}) is not available on the free market data plan. Try 1M, 6M, 1Y, or 5Y to see the price history.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Main Chart Creation & Synchronization
  React.useEffect(() => {
    if (!mainChartContainerRef.current) return;
    const container = mainChartContainerRef.current;
    container.innerHTML = "";

    const initialHeight = container.clientWidth < 640 ? 280 : 380;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
        fontSize: 12,
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
        scaleMargins: { top: 0.1, bottom: showVolume ? 0.22 : 0.1 },
      },
      timeScale: {
        borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e4e4e7",
        timeVisible: activeRange === "1D" || activeRange === "1W",
        secondsVisible: false,
      },
    });

    mainChartRef.current = chart;

    const formattedCandles = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // Volume series (subtle at base of main chart)
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.25)",
        priceFormat: { type: "volume" },
        priceScaleId: "volume_scale",
      });

      chart.priceScale("volume_scale").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      const volumeData = candles
        .filter((c) => c.volume !== undefined)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume as number,
          color:
            c.close >= c.open
              ? isDark ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.3)"
              : isDark ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.3)",
        }));

      volumeSeries.setData(volumeData);
    }

    // Price Series
    if (chartType === "candlestick") {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#ef4444",
        borderUpColor: "#10b981",
        borderDownColor: "#ef4444",
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      });
      candleSeries.setData(formattedCandles);
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        topColor: isDark ? "rgba(16, 185, 129, 0.28)" : "rgba(16, 185, 129, 0.2)",
        bottomColor: "transparent",
        lineColor: "#10b981",
        lineWidth: 2,
      });
      areaSeries.setData(formattedCandles.map((c) => ({ time: c.time, value: c.close })));
    }

    // SMA 20 Overlay (Amber)
    if (showSMA20 && sma20Data.length > 0) {
      const s20 = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 2,
        title: "SMA 20",
      });
      s20.setData(sma20Data.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
    }

    // SMA 50 Overlay (Blue)
    if (showSMA50 && sma50Data.length > 0) {
      const s50 = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 2,
        title: "SMA 50",
      });
      s50.setData(sma50Data.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
    }

    // SMA 200 Overlay (Purple)
    if (showSMA200 && sma200Data.length > 0) {
      const s200 = chart.addSeries(LineSeries, {
        color: "#a855f7",
        lineWidth: 2,
        title: "SMA 200",
      });
      s200.setData(sma200Data.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
    }

    // EMA 20 Overlay (Cyan)
    if (showEMA20 && ema20Data.length > 0) {
      const e20 = chart.addSeries(LineSeries, {
        color: "#06b6d4",
        lineWidth: 2,
        title: "EMA 20",
      });
      e20.setData(ema20Data.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
    }

    chart.timeScale().fitContent();

    // Crosshair inspection
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

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0 && mainChartRef.current) {
          const height = width < 640 ? 280 : 380;
          mainChartRef.current.applyOptions({ width, height });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      mainChartRef.current = null;
    };
  }, [
    candles,
    chartType,
    isDark,
    activeRange,
    showSMA20,
    showSMA50,
    showSMA200,
    showEMA20,
    showVolume,
    sma20Data,
    sma50Data,
    sma200Data,
    ema20Data,
  ]);

  // Separate Pane: RSI (14)
  React.useEffect(() => {
    if (!showRSI || !rsiContainerRef.current) return;
    const container = rsiContainerRef.current;
    container.innerHTML = "";

    const rsiChart = createChart(container, {
      width: container.clientWidth,
      height: 140,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "#f4f4f5" },
        horzLines: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "#f4f4f5" },
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e4e4e7",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        visible: false,
      },
    });
    rsiChartRef.current = rsiChart;

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: "#8b5cf6",
      lineWidth: 2,
    });
    rsiSeries.setData(rsi14Data.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));

    // 70 Overbought and 30 Oversold reference lines
    rsiSeries.createPriceLine({
      price: 70,
      color: isDark ? "rgba(239, 68, 68, 0.6)" : "rgba(239, 68, 68, 0.7)",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Overbought (70)",
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: isDark ? "rgba(16, 185, 129, 0.6)" : "rgba(16, 185, 129, 0.7)",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Oversold (30)",
    });

    rsiChart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0 && rsiChartRef.current) {
          rsiChartRef.current.applyOptions({ width });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      rsiChart.remove();
      rsiChartRef.current = null;
    };
  }, [showRSI, rsi14Data, isDark]);

  // Separate Pane: MACD (12, 26, 9)
  React.useEffect(() => {
    if (!showMACD || !macdContainerRef.current) return;
    const container = macdContainerRef.current;
    container.innerHTML = "";

    const macdChart = createChart(container, {
      width: container.clientWidth,
      height: 140,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "#f4f4f5" },
        horzLines: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "#f4f4f5" },
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e4e4e7",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        visible: false,
      },
    });
    macdChartRef.current = macdChart;

    const histSeries = macdChart.addSeries(HistogramSeries, {
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    const macdLineSeries = macdChart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
    });
    const signalLineSeries = macdChart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
    });

    histSeries.setData(
      macdData.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.histogram,
        color:
          d.histogram >= 0
            ? isDark ? "rgba(16, 185, 129, 0.6)" : "rgba(16, 185, 129, 0.7)"
            : isDark ? "rgba(239, 68, 68, 0.6)" : "rgba(239, 68, 68, 0.7)",
      }))
    );
    macdLineSeries.setData(macdData.map((d) => ({ time: d.time as UTCTimestamp, value: d.macd })));
    signalLineSeries.setData(macdData.map((d) => ({ time: d.time as UTCTimestamp, value: d.signal })));

    macdChart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0 && macdChartRef.current) {
          macdChartRef.current.applyOptions({ width });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      macdChart.remove();
      macdChartRef.current = null;
    };
  }, [showMACD, macdData, isDark]);

  const latestCandle = candles[candles.length - 1] || null;
  const inspected = hoveredPoint || latestCandle;

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
      {/* Friendly notice when range isn't available or rate-limited */}
      {errorMessage && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4.5 shrink-0 text-amber-500" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {activeRange === "1D" || activeRange === "1W" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRangeChange("1M")}
                className="min-h-[44px] px-3 text-sm rounded-xl cursor-pointer"
              >
                <span>View 1M instead</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRangeChange(activeRange)}
                className="min-h-[44px] px-3 text-sm gap-1.5 hover:bg-amber-500/20 text-amber-900 dark:text-amber-100 rounded-xl cursor-pointer"
              >
                <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>Retry</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Demo / Sample data notice */}
      {isMockData && !errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 text-muted-foreground" />
          <span>Showing local preview candles. Configure <code className="font-mono text-[11px] text-foreground">TWELVE_DATA_API_KEY</code> for live market historical data.</span>
        </div>
      )}

      {/* Controls Bar: Type toggle & Range buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
            <button
              onClick={() => setChartType("candlestick")}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                chartType === "candlestick"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CandlestickChart className="size-4" />
              <span>Candles</span>
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                chartType === "line"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LineChartIcon className="size-4" />
              <span>Line</span>
            </button>
          </div>

          <button
            onClick={() => setShowAdvancedTools((v) => !v)}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer border ${
              showAdvancedTools
                ? "bg-foreground/10 border-foreground/30 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-expanded={showAdvancedTools}
            title="Toggle technical indicators (SMA, EMA, RSI, MACD, Volume)"
          >
            <SlidersHorizontal className="size-4" />
            <span>Advanced tools</span>
            <ChevronDown
              className={`size-4 transition-transform duration-200 ${
                showAdvancedTools ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Range Buttons - Stay one row and scroll horizontally if needed */}
        <div className="overflow-x-auto no-scrollbar flex items-center gap-1.5 py-1 shrink-0 w-full sm:w-auto">
          {RANGES.map((range) => {
            const isActive = activeRange === range;
            return (
              <button
                key={range}
                onClick={() => handleRangeChange(range)}
                disabled={isLoading}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold font-mono transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-foreground text-background shadow-2xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      {/* Indicator Overlay & Oscillator Toggles Strip (Shown only when Advanced tools is open) */}
      {showAdvancedTools && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-sm font-medium text-muted-foreground mr-1 flex items-center gap-1.5">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Overlays:
            </span>

            {/* SMA 20 */}
            <Tooltip>
              <TooltipTrigger
                onClick={() => setShowSMA20((v) => !v)}
                className={`inline-flex min-h-[44px] items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  showSMA20
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="size-2 rounded-full bg-amber-500" />
                SMA 20
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm">
                <p className="font-semibold text-foreground">20-Day Simple Moving Average</p>
                <p className="text-muted-foreground mt-1">Short-term trend direction. Shows average closing price over the last 20 sessions.</p>
              </TooltipContent>
            </Tooltip>

            {/* SMA 50 */}
            <Tooltip>
              <TooltipTrigger
                onClick={() => setShowSMA50((v) => !v)}
                className={`inline-flex min-h-[44px] items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  showSMA50
                    ? "bg-blue-500/15 border-blue-500/50 text-blue-700 dark:text-blue-300 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="size-2 rounded-full bg-blue-500" />
                SMA 50
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm">
                <p className="font-semibold text-foreground">50-Day Simple Moving Average</p>
                <p className="text-muted-foreground mt-1">Medium-term trend benchmark watched closely by institutional traders.</p>
              </TooltipContent>
            </Tooltip>

            {/* SMA 200 */}
            <Tooltip>
              <TooltipTrigger
                onClick={() => setShowSMA200((v) => !v)}
                className={`inline-flex min-h-[44px] items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  showSMA200
                    ? "bg-purple-500/15 border-purple-500/50 text-purple-700 dark:text-purple-300 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="size-2 rounded-full bg-purple-500" />
                SMA 200
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm">
                <p className="font-semibold text-foreground">200-Day Simple Moving Average</p>
                <p className="text-muted-foreground mt-1">The primary long-term bull/bear dividing line. Price above indicates secular uptrend.</p>
              </TooltipContent>
            </Tooltip>

            {/* EMA 20 */}
            <Tooltip>
              <TooltipTrigger
                onClick={() => setShowEMA20((v) => !v)}
                className={`inline-flex min-h-[44px] items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  showEMA20
                    ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-700 dark:text-cyan-300 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="size-2 rounded-full bg-cyan-500" />
                EMA 20
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm">
                <p className="font-semibold text-foreground">20-Day Exponential Moving Average</p>
                <p className="text-muted-foreground mt-1">Places greater weight on recent candles, reacting faster to sudden momentum shifts.</p>
              </TooltipContent>
            </Tooltip>

            {/* Volume */}
            <Tooltip>
              <TooltipTrigger
                onClick={() => setShowVolume((v) => !v)}
                className={`inline-flex min-h-[44px] items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  showVolume
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                Volume
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm">
                <p className="font-semibold text-foreground">Trading Volume</p>
                <p className="text-muted-foreground mt-1">Shows number of shares bought and sold. High volume validates price breakout moves.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Oscillators: RSI & MACD toggles */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-sm font-medium text-muted-foreground mr-1">Panes:</span>

            {/* RSI (14) */}
            <Tooltip>
              <TooltipTrigger
                onClick={() => setShowRSI((v) => !v)}
                className={`inline-flex min-h-[44px] items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  showRSI
                    ? "bg-violet-500/15 border-violet-500/50 text-violet-700 dark:text-violet-300 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                RSI (14)
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm">
                <p className="font-semibold text-foreground">Relative Strength Index (14)</p>
                <p className="text-muted-foreground mt-1">Measures momentum from 0 to 100. Over 70 suggests overbought; below 30 suggests oversold.</p>
              </TooltipContent>
            </Tooltip>

            {/* MACD */}
            <Tooltip>
              <TooltipTrigger
                onClick={() => setShowMACD((v) => !v)}
                className={`inline-flex min-h-[44px] items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  showMACD
                    ? "bg-sky-500/15 border-sky-500/50 text-sky-700 dark:text-sky-300 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                MACD (12, 26, 9)
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm">
                <p className="font-semibold text-foreground">Moving Average Convergence Divergence</p>
                <p className="text-muted-foreground mt-1">Shows relationship between two EMAs. MACD crossing above signal line hints at bullish momentum.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Floating Hover Metric Bar */}
      {inspected && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-sans text-muted-foreground bg-muted/20 px-3.5 py-2 rounded-xl border border-border/40 tabular-nums">
          <div>
            <span className="text-xs uppercase text-muted-foreground/80">O: </span>
            <span className="font-semibold text-foreground">${inspected.open.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-xs uppercase text-muted-foreground/80">H: </span>
            <span className="font-semibold text-foreground">${inspected.high.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-xs uppercase text-muted-foreground/80">L: </span>
            <span className="font-semibold text-foreground">${inspected.low.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-xs uppercase text-muted-foreground/80">C: </span>
            <span className="font-semibold text-foreground">${inspected.close.toFixed(2)}</span>
          </div>
          {inspected.volume && (
            <div className="hidden sm:block">
              <span className="text-xs uppercase text-muted-foreground/80">Vol: </span>
              <span className="text-foreground">{inspected.volume.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Interactive Main Canvas */}
      <div className="relative w-full overflow-hidden rounded-xl">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-2xs">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <RefreshCw className="size-3.5 animate-spin text-emerald-500" />
              <span>Updating timeframe...</span>
            </div>
          </div>
        )}
        <div ref={mainChartContainerRef} className="w-full" />
      </div>

      {/* Separate Pane: RSI (14) */}
      {showRSI && (
        <div className="border-t border-border/60 pt-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm font-mono">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-violet-600 dark:text-violet-400">RSI (14)</span>
              <span className="text-muted-foreground text-sm">
                Current: {rsi14Data.length > 0 ? rsi14Data[rsi14Data.length - 1].value : "--"}
              </span>
            </div>
            <span className="text-xs sm:text-sm text-muted-foreground">Overbought: 70 | Oversold: 30</span>
          </div>
          <div ref={rsiContainerRef} className="w-full" />
        </div>
      )}

      {/* Separate Pane: MACD (12, 26, 9) */}
      {showMACD && (
        <div className="border-t border-border/60 pt-3 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1 text-sm font-mono">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sky-600 dark:text-sky-400">MACD (12, 26, 9)</span>
              <span className="text-sm text-muted-foreground">
                Line: {macdData.length > 0 ? macdData[macdData.length - 1].macd : "--"} | Signal:{" "}
                {macdData.length > 0 ? macdData[macdData.length - 1].signal : "--"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="text-sky-500">■ MACD</span>
              <span className="text-amber-500">■ Signal</span>
              <span className="text-emerald-500">■ Histogram</span>
            </div>
          </div>
          <div ref={macdContainerRef} className="w-full" />
        </div>
      )}
    </div>
  );
}
