"use client";

import * as React from "react";
import { AlertCircle, ChevronRight, X, ExternalLink, KeyRound } from "lucide-react";
import type { FeatureStatus } from "@/lib/env";

interface FeatureWarningBannerProps {
  features: FeatureStatus[];
}

export function FeatureWarningBanner({ features }: FeatureWarningBannerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(false);

  const missingFeatures = features.filter((f) => !f.isConfigured);

  if (missingFeatures.length === 0 || isDismissed) {
    return null;
  }

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs sm:text-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-medium">Setup notice:</span>
          <span className="truncate text-muted-foreground dark:text-amber-300/80">
            {missingFeatures.length === 1
              ? `${missingFeatures[0].name} is not configured.`
              : `${missingFeatures.length} integrations need API keys (${missingFeatures.map((f) => f.key).join(", ")}).`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium hover:bg-amber-500/20 underline-offset-4 hover:underline transition-colors cursor-pointer"
          >
            <span>{isOpen ? "Hide keys" : "Setup guide"}</span>
            <ChevronRight className={`size-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss notice"
            className="rounded p-1 hover:bg-amber-500/20 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mx-auto max-w-7xl pt-3 pb-1">
          <p className="text-xs text-muted-foreground dark:text-amber-300/70 mb-2">
            StockLens runs gracefully without blocking. The features below will be disabled until you add their keys to <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono text-[11px]">.env.local</code>:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {missingFeatures.map((feature) => (
              <div
                key={feature.key}
                className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-background/60 p-2.5 backdrop-blur-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                    <KeyRound className="size-3 text-amber-500" />
                    <span>{feature.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {feature.description}
                  </p>
                  <div className="font-mono text-[10px] text-amber-700 dark:text-amber-400">
                    Missing: {feature.missingVars.join(", ")}
                  </div>
                </div>
                <a
                  href={feature.setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 shrink-0 rounded border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <span>Get Key</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
