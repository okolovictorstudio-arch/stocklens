import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertCircle, BarChart3, Sparkles } from "lucide-react";
import { getStockQuote, getStockProfile } from "@/lib/finnhub";
import { getHistoricalCandles } from "@/lib/twelvedata";
import { StockHeader } from "@/components/stock/StockHeader";
import { PriceChartLazy } from "@/components/stock/PriceChartLazy";
import { buttonVariants } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params;
  const cleanTicker = ticker.toUpperCase();
  return {
    title: `${cleanTicker} Stock Price & Analysis — StockLens`,
    description: `Track real-time quotes, technical charts, fundamentals, and AI analysis for ${cleanTicker}.`,
  };
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker } = await params;
  const cleanTicker = ticker.toUpperCase();

  // Fetch stock quote and profile in parallel on the server
  const [quote, profile] = await Promise.all([
    getStockQuote(cleanTicker),
    getStockProfile(cleanTicker),
  ]);

  // Invalid or Unsupported Symbol View
  if (!quote) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
          <AlertCircle className="size-7 text-amber-500" />
        </div>
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Symbol Lookup Notice
        </span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Ticker &quot;{cleanTicker}&quot; Not Found
        </h1>
        <p className="mt-3 max-w-md mx-auto text-sm text-muted-foreground leading-relaxed">
          We couldn&apos;t retrieve quote data for this symbol. Finnhub&apos;s free tier supports major US equities (NYSE, NASDAQ). Please check the symbol or explore popular tickers.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          {["AAPL", "NVDA", "MSFT", "GOOGL", "AMZN"].map((sym) => (
            <Link
              key={sym}
              href={`/stock/${sym}`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Try {sym}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Fetch initial 1M candles on the server (cached ~15 min)
  const initialCandlesResponse = await getHistoricalCandles(
    cleanTicker,
    "1M",
    quote.currentPrice
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Back button & quick navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Dashboard</span>
        </Link>
      </div>

      {/* Stock Header Card */}
      <StockHeader quote={quote} profile={profile} />

      {/* Interactive Candlestick / Line Chart (Lazy loaded client component) */}
      <PriceChartLazy
        symbol={cleanTicker}
        initialRange="1M"
        initialCandles={initialCandlesResponse.candles}
        basePrice={quote.currentPrice}
        initialRateLimited={initialCandlesResponse.isRateLimited}
        initialErrorMessage={initialCandlesResponse.errorMessage}
        isMockData={initialCandlesResponse.isMock}
      />

      {/* Placeholder Grid for Upcoming Phases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Phase 3 Preview: Technical Indicators & Fundamentals */}
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <BarChart3 className="size-4 text-emerald-500" />
              <span>Phase 3 — Technical Indicators & Fundamentals</span>
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Calculated Signals & Financial Metrics
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              SMA 20/50/200, EMA, RSI(14), MACD chart overlays, and beginner-friendly fundamental cards (P/E, Market Cap, EPS, 52-week Range, Recharts trends) will appear here.
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground/70 font-mono">
            Status: Next in queue
          </div>
        </div>

        {/* Phase 4 Preview: AI Synthesis */}
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Sparkles className="size-4 text-sky-500" />
              <span>Phase 4 — Gemini Plain-Language Synthesis</span>
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Grounded AI Analysis
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Structured JSON output powered by Google Gemini 2.0 Flash. Interprets price trends, indicators, and fundamentals with zero hallucinated figures and strict disclaimer notice.
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground/70 font-mono">
            Status: Following Phase 3
          </div>
        </div>
      </div>
    </div>
  );
}
