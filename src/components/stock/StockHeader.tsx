import { TrendingUp, TrendingDown, Clock, Building2, Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StockQuote, StockProfile, MarketStatus } from "@/types/stock";

interface StockHeaderProps {
  quote: StockQuote;
  profile: StockProfile | null;
}

function getMarketStatusBadge(status: MarketStatus) {
  switch (status) {
    case "open":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Market Open
        </span>
      );
    case "pre-market":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Pre-Market
        </span>
      );
    case "after-hours":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400">
          <span className="size-1.5 rounded-full bg-sky-500" />
          After-Hours
        </span>
      );
    case "closed":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Clock className="size-3" />
          Market Closed
        </span>
      );
  }
}

export function StockHeader({ quote, profile }: StockHeaderProps) {
  const isPositive = quote.change >= 0;
  const companyName = profile?.name || quote.symbol;
  const exchange = profile?.exchange || "US Equities";
  const currency = profile?.currency || "USD";

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-5">
      {/* Top row: Symbol, Name, Badges, Watchlist button */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
              {quote.symbol}
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              {exchange}
            </Badge>
            <Badge variant="secondary" className="text-xs font-mono">
              {currency}
            </Badge>
            {getMarketStatusBadge(quote.marketStatus)}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground flex items-center gap-1.5">
            <Building2 className="size-3.5 shrink-0" />
            <span>{companyName}</span>
            {profile?.finnhubIndustry && (
              <>
                <span className="text-border">•</span>
                <span className="text-xs">{profile.finnhubIndustry}</span>
              </>
            )}
          </p>
        </div>

        {/* Watchlist toggle button */}
        <Button
          variant="outline"
          size="sm"
          className="self-start sm:self-auto gap-1.5 text-xs rounded-lg"
          title="Add to Watchlist"
        >
          <Bookmark className="size-3.5 text-muted-foreground" />
          <span>Watchlist</span>
        </Button>
      </div>

      {/* Bottom row: Big Price, Change %, Key Day Levels */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 pt-2 border-t border-border/50">
        <div className="flex items-baseline gap-3">
          <div className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono tabular-nums">
            ${quote.currentPrice.toFixed(2)}
          </div>
          <div
            className={`flex items-center gap-1 text-sm sm:text-base font-semibold font-mono tabular-nums ${
              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {isPositive ? <TrendingUp className="size-4.5" /> : <TrendingDown className="size-4.5" />}
            <span>
              {isPositive ? "+" : ""}
              {quote.change.toFixed(2)} ({isPositive ? "+" : ""}
              {quote.percentChange.toFixed(2)}%)
            </span>
            <span className="text-xs font-normal text-muted-foreground font-sans ml-1">Today</span>
          </div>
        </div>

        {/* Day stat chips */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
          <div>
            <span className="text-muted-foreground/70">Prev Close: </span>
            <span className="font-semibold text-foreground tabular-nums">
              ${quote.previousClosePrice.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground/70">Day Open: </span>
            <span className="font-semibold text-foreground tabular-nums">
              ${quote.openPriceOfDay.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground/70">Day Range: </span>
            <span className="font-semibold text-foreground tabular-nums">
              ${quote.lowPriceOfDay.toFixed(2)} - ${quote.highPriceOfDay.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
