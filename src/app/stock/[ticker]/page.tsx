import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { getStockQuote, getStockProfile, getStockFundamentals } from "@/lib/finnhub";
import { getHistoricalCandles } from "@/lib/twelvedata";
import { StockHeader } from "@/components/stock/StockHeader";
import { PriceChartLazy } from "@/components/stock/PriceChartLazy";
import { FundamentalsGrid } from "@/components/stock/FundamentalsGrid";
import { AIAnalysisCard } from "@/components/stock/AIAnalysisCard";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params;
  const cleanTicker = ticker.toUpperCase();
  return {
    title: `${cleanTicker} Stock Price, Indicators & Fundamentals — StockLens`,
    description: `Track real-time quotes, technical chart overlays (SMA, EMA, RSI, MACD), verified fundamentals, and AI analysis for ${cleanTicker}.`,
  };
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker } = await params;
  const cleanTicker = ticker.toUpperCase();

  // Fetch stock quote, profile, and fundamentals in parallel on the server
  const [quote, profile, fundamentals] = await Promise.all([
    getStockQuote(cleanTicker),
    getStockProfile(cleanTicker),
    getStockFundamentals(cleanTicker),
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
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

      {/* Interactive Candlestick / Line Chart with Overlays & Oscillators */}
      <PriceChartLazy
        symbol={cleanTicker}
        initialRange="1M"
        initialCandles={initialCandlesResponse.candles}
        basePrice={quote.currentPrice}
        initialRateLimited={initialCandlesResponse.isRateLimited}
        initialErrorMessage={initialCandlesResponse.errorMessage}
        isMockData={initialCandlesResponse.isMock}
      />

      {/* Fundamentals & Earnings Grid */}
      <FundamentalsGrid
        fundamentals={fundamentals}
        currentPrice={quote.currentPrice}
      />

      {/* AI Analysis & Metric Interpretation */}
      <AIAnalysisCard symbol={cleanTicker} />
    </div>
  );
}
