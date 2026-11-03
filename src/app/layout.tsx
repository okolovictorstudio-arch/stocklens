import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { FeatureWarningBanner } from "@/components/layout/FeatureWarningBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAllFeaturesStatus } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockLens — Stocks Explained in Plain English",
  description:
    "A friendly, Claude-style guide to understanding stocks, prices, and fundamentals—explained for normal people with zero Wall Street jargon.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const featureStatuses = getAllFeaturesStatus();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased font-sans`}
    >
      <body className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground selection:bg-primary/10 font-sans text-base">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delay={150}>
            <FeatureWarningBanner features={featureStatuses} />
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              {children}
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
