"use client";

import * as React from "react";
import {
  HelpCircle,
  TrendingUp,
  Percent,
  Coins,
  Scale,
  Activity,
  BarChart2,
  Calendar,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EarningsTrendChart } from "@/components/stock/EarningsTrendChart";
import type { StockFundamentals } from "@/types/stock";

interface FundamentalsGridProps {
  fundamentals: StockFundamentals;
  currentPrice: number;
}

function formatMarketCap(capMillions: number | null): string {
  if (capMillions === null) return "--";
  if (capMillions >= 1000000) {
    return `$${(capMillions / 1000000).toFixed(2)}T`;
  }
  if (capMillions >= 1000) {
    return `$${(capMillions / 1000).toFixed(2)}B`;
  }
  return `$${capMillions.toFixed(2)}M`;
}

interface MetricCardProps {
  title: string;
  value: string;
  tooltipTitle: string;
  tooltipExplanation: string;
  icon: React.ReactNode;
  subtitle?: string;
  badge?: string;
}

function MetricCard({
  title,
  value,
  tooltipTitle,
  tooltipExplanation,
  icon,
  subtitle,
  badge,
}: MetricCardProps) {
  return (
    <Card className="rounded-xl border-border/80 bg-card p-4 shadow-2xs hover:border-foreground/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="text-foreground/70">{icon}</span>
          <span>{title}</span>
        </div>
        <Tooltip>
          <TooltipTrigger
            className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded cursor-pointer transition-colors"
            aria-label={`Learn about ${title}`}
          >
            <HelpCircle className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p className="font-semibold text-foreground">{tooltipTitle}</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">{tooltipExplanation}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums">
          {value}
        </div>
        {badge && (
          <Badge variant="secondary" className="text-[10px] font-mono">
            {badge}
          </Badge>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-[11px] text-muted-foreground font-sans truncate">
          {subtitle}
        </p>
      )}
    </Card>
  );
}

export function FundamentalsGrid({
  fundamentals,
  currentPrice,
}: FundamentalsGridProps) {
  if (!fundamentals.isAvailable) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center space-y-2">
        <p className="text-sm font-semibold text-foreground">Fundamentals Data Temporarily Unavailable</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Detailed metrics for this asset are not reported under the free tier. Basic price and technical indicators remain fully active above.
        </p>
      </div>
    );
  }

  // Calculate 52-Week Range progress percentage (where current price is between low and high)
  let rangePercent = 50;
  if (
    fundamentals.week52High &&
    fundamentals.week52Low &&
    fundamentals.week52High > fundamentals.week52Low
  ) {
    const clamped = Math.max(
      fundamentals.week52Low,
      Math.min(fundamentals.week52High, currentPrice)
    );
    rangePercent = Math.round(
      ((clamped - fundamentals.week52Low) /
        (fundamentals.week52High - fundamentals.week52Low)) *
        100
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Coins className="size-4.5 text-primary" />
            <span>Company Fundamentals & Valuation</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Core financial benchmarks fetched from verified SEC and market reports. Hover (?) for beginner explanations.
          </p>
        </div>
        <Badge variant="outline" className="self-start sm:self-auto text-[10px] font-mono">
          Free Tier Finnhub
        </Badge>
      </div>

      {/* Grid of Fundamental Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Market Cap */}
        {fundamentals.marketCap !== null && (
          <MetricCard
            title="Market Cap"
            value={formatMarketCap(fundamentals.marketCap)}
            tooltipTitle="Market Capitalization"
            tooltipExplanation={`The whole company is valued at about ${formatMarketCap(fundamentals.marketCap)}. It shows the total price tag if someone were to buy every single share.`}
            icon={<Scale className="size-3.5" />}
            subtitle={`Valued at ${formatMarketCap(fundamentals.marketCap)}`}
          />
        )}

        {/* P/E Ratio */}
        {fundamentals.peRatio !== null && (
          <MetricCard
            title="P/E Ratio"
            value={fundamentals.peRatio.toFixed(1)}
            tooltipTitle="Price-to-Earnings Ratio"
            tooltipExplanation={`You pay about $${fundamentals.peRatio.toFixed(1)} for every $1 the company earns in a year. Higher numbers mean investors expect fast growth; lower numbers mean a lower price tag relative to current earnings.`}
            icon={<Percent className="size-3.5" />}
            subtitle={`$${fundamentals.peRatio.toFixed(1)} per $1 of earnings`}
          />
        )}

        {/* EPS */}
        {fundamentals.eps !== null && (
          <MetricCard
            title="EPS (TTM)"
            value={`$${fundamentals.eps.toFixed(2)}`}
            tooltipTitle="Earnings Per Share"
            tooltipExplanation={`Profit for each individual share of the company: the company generated $${fundamentals.eps.toFixed(2)} in profit per share over the last 12 months.`}
            icon={<TrendingUp className="size-3.5" />}
            subtitle="Profit per share (12 mo)"
          />
        )}

        {/* Dividend Yield */}
        {fundamentals.dividendYield !== null && (
          <MetricCard
            title="Dividend Yield"
            value={
              fundamentals.dividendYield > 0
                ? `${fundamentals.dividendYield.toFixed(2)}%`
                : "0.00%"
            }
            tooltipTitle="Annual Dividend Yield"
            tooltipExplanation="Annual cash payout you receive for owning shares, as a percentage of the stock price. If 0%, the company reinvests all money back into the business."
            icon={<Coins className="size-3.5" />}
            subtitle={
              fundamentals.dividendYield > 0
                ? `${fundamentals.dividendYield.toFixed(2)}% cash payout / yr`
                : "No cash dividend (reinvests)"
            }
          />
        )}

        {/* Beta */}
        {fundamentals.beta !== null && (
          <MetricCard
            title="Beta"
            value={fundamentals.beta.toFixed(2)}
            tooltipTitle="Beta (Market Volatility)"
            tooltipExplanation={`Moves more or less than the overall stock market (1.0 moves the same). At ${fundamentals.beta.toFixed(2)}, this stock tends to swing ${fundamentals.beta > 1 ? "more" : "less"} than average.`}
            icon={<Activity className="size-3.5" />}
            subtitle={
              fundamentals.beta > 1.2
                ? "Swings more than the market"
                : fundamentals.beta < 0.8
                ? "Calmer than the market"
                : "Moves with the market"
            }
          />
        )}

        {/* ROE */}
        {fundamentals.roe !== null && (
          <MetricCard
            title="Return on Equity"
            value={`${fundamentals.roe.toFixed(1)}%`}
            tooltipTitle="Return on Equity (ROE)"
            tooltipExplanation={`How effectively the company turns shareholder investment into profit. For every $100 of equity, the company produced about $${fundamentals.roe.toFixed(1)} in net profits.`}
            icon={<BarChart2 className="size-3.5" />}
            subtitle="Profit efficiency gauge"
          />
        )}

        {/* 52-Week Range */}
        {fundamentals.week52High !== null && fundamentals.week52Low !== null && (
          <Card className="col-span-2 rounded-xl border-border/80 bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="size-3.5 text-foreground/70" />
                <span>52-Week Range</span>
              </div>
              <Tooltip>
                <TooltipTrigger
                  className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded cursor-pointer"
                  aria-label="Learn about 52-Week Range"
                >
                  <HelpCircle className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p className="font-semibold text-foreground">52-Week High & Low</p>
                  <p className="text-muted-foreground mt-0.5">
                    The lowest and highest prices paid over the last 365 days. The indicator bar shows where the current price stands within that yearly corridor.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-baseline justify-between font-mono text-sm">
                <span className="text-muted-foreground text-xs">
                  Low: <strong className="text-foreground">${fundamentals.week52Low.toFixed(2)}</strong>
                </span>
                <span className="font-semibold text-foreground text-sm">
                  ${currentPrice.toFixed(2)} ({rangePercent}%)
                </span>
                <span className="text-muted-foreground text-xs">
                  High: <strong className="text-foreground">${fundamentals.week52High.toFixed(2)}</strong>
                </span>
              </div>

              {/* Visual Range Track */}
              <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500"
                  style={{ width: `${rangePercent}%` }}
                />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Quarterly Earnings Trend (Recharts) */}
      {fundamentals.earningsTrend && fundamentals.earningsTrend.length > 0 && (
        <Card className="rounded-2xl border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart2 className="size-4.5 text-emerald-500" />
                <span>Quarterly Earnings Performance (EPS Actual vs. Estimate)</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compares Wall Street analyst consensus predictions against reported GAAP profits. Consistent beats signal operational strength.
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto cursor-pointer"
              >
                <HelpCircle className="size-3.5" />
                <span>How to read</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p className="font-semibold text-foreground">Earnings Surprise</p>
                <p className="text-muted-foreground mt-0.5">
                  When the green bar (Actual) exceeds the grey bar (Estimate), the company beat expectations. This frequently triggers upward momentum.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          <EarningsTrendChart data={fundamentals.earningsTrend} />
        </Card>
      )}
    </div>
  );
}
