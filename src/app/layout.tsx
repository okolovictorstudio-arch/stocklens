import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/layout/Navbar";
import { FeatureWarningBanner } from "@/components/layout/FeatureWarningBanner";
import { getAllFeaturesStatus } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockLens — AI-Powered Stock Analyzer",
  description:
    "Clean, modern, beginner-friendly stock analysis powered by real-time financial metrics, technical indicators, and AI insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const featureStatuses = getAllFeaturesStatus();
  const finnhubConfigured = featureStatuses.find((f) => f.key === "finnhub")?.isConfigured ?? false;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-primary/10">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <FeatureWarningBanner features={featureStatuses} />
          <Navbar isSearchEnabled={finnhubConfigured} />
          <main className="flex-1 flex flex-col">{children}</main>
          <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
            <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p>StockLens — Academic project. Free-tier APIs. Non-commercial.</p>
              <p className="text-[11px]">Informational only. Not financial advice.</p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
