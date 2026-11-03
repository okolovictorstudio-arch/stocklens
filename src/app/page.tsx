import Link from "next/link";
import {
  Sparkles,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Database,
} from "lucide-react";
import { getAllFeaturesStatus } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const POPULAR_TICKERS = [
  { symbol: "AAPL", name: "Apple Inc.", samplePrice: "$238.40", change: "+1.24%" },
  { symbol: "NVDA", name: "NVIDIA Corp.", samplePrice: "$141.54", change: "+2.87%" },
  { symbol: "MSFT", name: "Microsoft Corp.", samplePrice: "$428.15", change: "+0.45%" },
  { symbol: "GOOGL", name: "Alphabet Inc.", samplePrice: "$172.98", change: "-0.62%" },
  { symbol: "AMZN", name: "Amazon.com Inc.", samplePrice: "$198.88", change: "+1.05%" },
];

export default function HomePage() {
  const features = getAllFeaturesStatus();
  const configuredCount = features.filter((f) => f.isConfigured).length;

  return (
    <div className="flex flex-col flex-1 pb-16">
      {/* Hero Section */}
      <section className="relative border-b border-border/50 bg-gradient-to-b from-muted/30 to-background py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            Phase 1 Foundation Live • Next.js 16 + Tailwind v4 + shadcn
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground max-w-3xl mx-auto leading-[1.1]">
            Stock analysis, stripped of clutter.
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Search any ticker to inspect real-time candlestick charts, calculated indicators, company fundamentals, and beginner-friendly AI synthesis.
          </p>

          {/* Quick Ticker Strip */}
          <div className="pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Explore Popular Assets
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {POPULAR_TICKERS.map((stock) => (
                <Link
                  key={stock.symbol}
                  href={`/stock/${stock.symbol}`}
                  className="group flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium shadow-2xs hover:border-foreground/30 hover:bg-muted/50 transition-all cursor-pointer"
                >
                  <span className="font-semibold text-foreground group-hover:underline">
                    {stock.symbol}
                  </span>
                  <span className="text-muted-foreground hidden sm:inline">
                    {stock.name}
                  </span>
                  <span className="font-mono tabular-nums text-foreground/80">
                    {stock.samplePrice}
                  </span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      stock.change.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {stock.change}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 space-y-12">
        {/* Architecture & Pipeline Highlights */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Core Architecture</h2>
              <p className="text-sm text-muted-foreground">
                Built strictly with free tiers, server-side data isolation, and edge-ready caching.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>Zero client-exposed API secrets</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="rounded-xl border-border/70 shadow-2xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary font-medium text-xs">
                  <BarChart3 className="size-4" />
                  <span>Interactive Charts & Signals</span>
                </div>
                <CardTitle className="text-base">Lightweight Charts</CardTitle>
                <CardDescription className="text-xs">
                  High-performance TradingView canvas charts with SMA 20/50/200, EMA, RSI, and MACD overlays.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="rounded-xl border-border/70 shadow-2xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-sky-500 font-medium text-xs">
                  <Sparkles className="size-4" />
                  <span>Grounded AI Analysis</span>
                </div>
                <CardTitle className="text-base">Google Gemini 2.0 / Flash</CardTitle>
                <CardDescription className="text-xs">
                  Strictly schema-validated structured JSON. AI reasons only over real fetched indicators and fundamentals.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="rounded-xl border-border/70 shadow-2xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-emerald-500 font-medium text-xs">
                  <Database className="size-4" />
                  <span>Smart Caching & Watchlists</span>
                </div>
                <CardTitle className="text-base">Supabase Server RLS</CardTitle>
                <CardDescription className="text-xs">
                  Anonymous client device IDs paired with multi-tiered Postgres caching to preserve free API quotas.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Integration Setup & Readiness Status */}
        <div id="setup" className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight">API Integration Readiness</h3>
                <Badge variant={configuredCount === features.length ? "default" : "outline"} className="text-xs">
                  {configuredCount} / {features.length} Configured
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                StockLens checks each provider lazily. Features degrade gracefully if a key is omitted.
              </p>
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-md self-start sm:self-auto">
              Target: <code className="text-foreground">.env.local</code>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
            {features.map((feature) => (
              <div
                key={feature.key}
                className="flex flex-col justify-between rounded-xl border border-border/80 bg-background/50 p-4 transition-colors hover:border-foreground/20"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      {feature.isConfigured ? (
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="size-4 text-amber-500 shrink-0" />
                      )}
                      <span>{feature.name}</span>
                    </div>
                    <Badge
                      variant={feature.isConfigured ? "secondary" : "outline"}
                      className={`text-[10px] font-mono ${
                        feature.isConfigured
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                          : "text-amber-700 dark:text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {feature.isConfigured ? "Ready" : "Key Needed"}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>

                  <div className="text-[11px] font-mono text-muted-foreground pt-1">
                    <span className="text-foreground/70">Required: </span>
                    {feature.requiredVars.map((v) => (
                      <code
                        key={v}
                        className={`mr-1 px-1 py-0.5 rounded text-[10px] ${
                          feature.missingVars.includes(v)
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {v}
                      </code>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-border/50 mt-4">
                  <span className="text-[11px] text-muted-foreground">Free tier available</span>
                  <a
                    href={feature.setupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <span>Get Key</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
