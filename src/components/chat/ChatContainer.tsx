"use client";

import * as React from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { FeatureWarningBanner } from "@/components/layout/FeatureWarningBanner";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { StockOverviewMessage } from "@/components/chat/StockOverviewMessage";
import { InvestedEarlierCard } from "@/components/stock/InvestedEarlierCard";
import { StockCompareCard } from "@/components/stock/StockCompareCard";
import { MarketDashboard } from "@/components/dashboard/MarketDashboard";
import { saveRecentChat, getSavedChatMessages } from "@/lib/recent-chats";
import { useSidebarCollapsed } from "@/lib/sidebar-state";
import { cleanCompanyName } from "@/lib/utils";
import {
  answerPriceHighOrLow,
  answerHowRisky,
  answerDoesItPayDividends,
  answerIsCompanyDoingWell,
} from "@/lib/analytics";
import { ArrowLeft, Sparkles, Send } from "lucide-react";
import type { ChatMessage, ChatActionType } from "@/types/chat";
import type { FeatureStatus } from "@/lib/env";
import type { StockDetailsResponse } from "@/app/api/stock/route";

interface ChatContainerProps {
  featureStatuses?: FeatureStatus[];
}

function ChatDisclaimer() {
  return (
    <p
      className="text-center text-[14px] leading-relaxed text-muted-foreground max-w-3xl mx-auto px-2 text-balance"
      style={{ textWrap: "balance" }}
    >
      StockLens is AI-powered and can make mistakes. Please double-check important details, and look at the longer-term pattern, not just one day. Prices may be delayed. Not financial advice.
    </p>
  );
}

export function ChatContainer({ featureStatuses = [] }: ChatContainerProps) {
  const [activeSymbol, setActiveSymbol] = React.useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = React.useState<string>("");
  const [isDashboardActive, setIsDashboardActive] = React.useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [stockDataMap, setStockDataMap] = React.useState<Record<string, StockDetailsResponse>>({});
  const [inputVal, setInputVal] = React.useState("");
  const [isCollapsed] = useSidebarCollapsed();

  const hamburgerRef = React.useRef<HTMLButtonElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll messages to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Continuously sync messages to Supabase / localStorage for the active chat
  React.useEffect(() => {
    if (activeSymbol && activeCompanyName && messages.length > 0) {
      saveRecentChat(activeSymbol, activeCompanyName, messages);
    }
  }, [activeSymbol, activeCompanyName, messages]);

  const handleSelectStock = React.useCallback(async (symbol: string, companyName: string, chatId?: string) => {
    const cleanSym = symbol.trim().toUpperCase();
    const cleanName = cleanCompanyName(companyName || cleanSym);

    setIsDashboardActive(false);
    setActiveSymbol(cleanSym);
    setActiveCompanyName(cleanName);

    // 1. If existing conversation exists for this stock in localStorage, restore it immediately
    const existingMessages = getSavedChatMessages(cleanSym);
    if (existingMessages && existingMessages.length > 0) {
      setMessages(existingMessages);
      saveRecentChat(cleanSym, cleanName, existingMessages);
      return;
    }

    // 2. If chatId is provided, try fetching saved messages from Supabase
    if (chatId) {
      try {
        const { getOrCreateDeviceId } = await import("@/lib/device-id");
        const deviceId = getOrCreateDeviceId();
        const res = await fetch(`/api/chats/${chatId}`, {
          headers: { "x-device-id": deviceId },
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.messages) && json.messages.length > 0) {
            setMessages(json.messages);
            saveRecentChat(cleanSym, cleanName, json.messages);
            return;
          }
        }
      } catch {}
    }

    // 3. Otherwise initial guided conversation message: "Tell me about [Company]"
    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: "user",
      content: `Tell me about ${cleanName}`,
      symbol: cleanSym,
      companyName: cleanName,
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: `msg_a_${Date.now() + 1}`,
      role: "assistant",
      symbol: cleanSym,
      companyName: cleanName,
      actionType: "overview",
      timestamp: Date.now() + 1,
    };

    const initialMsgs = [userMsg, assistantMsg];
    setMessages(initialMsgs);
    saveRecentChat(cleanSym, cleanName, initialMsgs);
  }, []);

  const handleNewChat = React.useCallback(() => {
    setIsDashboardActive(false);
    setActiveSymbol(null);
    setActiveCompanyName("");
    setMessages([]);
    setInputVal("");
  }, []);

  const handleOpenDashboard = React.useCallback(() => {
    setIsDashboardActive(true);
    setActiveSymbol(null);
    setActiveCompanyName("");
  }, []);

  const handleDataLoaded = React.useCallback((data: StockDetailsResponse) => {
    setStockDataMap((prev) => ({ ...prev, [data.symbol]: data }));
  }, []);

  const handleSelectQuestion = React.useCallback(
    (questionText: string, actionType?: ChatActionType) => {
      // Prevent duplicate cards: if question or card already exists for this stock, scroll to it
      const existing = messages.find(
        (m) =>
          m.symbol === activeSymbol &&
          (m.content === questionText || (actionType && m.actionType === actionType))
      );

      if (existing) {
        const el = document.getElementById(`msg-${existing.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }

      const userMsg: ChatMessage = {
        id: `msg_u_${Date.now()}`,
        role: "user",
        content: questionText,
        symbol: activeSymbol || undefined,
        timestamp: Date.now(),
      };

      const stockData = activeSymbol ? stockDataMap[activeSymbol] : null;
      const cleanName = cleanCompanyName(activeCompanyName || activeSymbol || "the company");

      let answerText = "";
      if (questionText === "Is this company doing well?") {
        answerText = answerIsCompanyDoingWell({
          companyName: cleanName,
          symbol: activeSymbol || "",
          marketCapMillions: stockData?.fundamentals?.marketCap ?? null,
          eps: stockData?.fundamentals?.eps ?? null,
          roe: stockData?.fundamentals?.roe ?? null,
        });
      } else if (questionText === "Is the price high or low right now?") {
        answerText = answerPriceHighOrLow({
          companyName: cleanName,
          symbol: activeSymbol || "",
          currentPrice: stockData?.quote?.currentPrice ?? 0,
          low52: stockData?.fundamentals?.week52Low ?? null,
          high52: stockData?.fundamentals?.week52High ?? null,
          peRatio: stockData?.fundamentals?.peRatio ?? null,
        });
      } else if (questionText === "How risky is it?") {
        answerText = answerHowRisky({
          companyName: cleanName,
          symbol: activeSymbol || "",
          beta: stockData?.fundamentals?.beta ?? null,
          candles: stockData?.candles ?? [],
        });
      } else if (questionText === "Does it pay dividends?") {
        answerText = answerDoesItPayDividends({
          companyName: cleanName,
          symbol: activeSymbol || "",
          dividendYield: stockData?.fundamentals?.dividendYield ?? null,
        });
      } else if (questionText === "What if I'd invested $100 earlier?" || actionType === "invested_earlier") {
        answerText = ""; // Rendered as full InvestedEarlierCard
      } else if (questionText === "Compare with another stock" || actionType === "compare") {
        answerText = ""; // Rendered as full StockCompareCard
      } else {
        answerText = `Here's what the data shows for ${cleanName} (${activeSymbol}): review the At-A-Glance card and fundamentals grid above for verified numbers. Let me know if you would like me to explain any specific metric in everyday terms!`;
      }

      const assistantMsg: ChatMessage = {
        id: `msg_a_${Date.now() + 1}`,
        role: "assistant",
        content: answerText,
        symbol: activeSymbol || undefined,
        companyName: cleanName,
        actionType: actionType || "follow_up",
        timestamp: Date.now() + 1,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
    },
    [activeCompanyName, activeSymbol, messages, stockDataMap]
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    setInputVal("");
    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: "user",
      content: trimmed,
      symbol: activeSymbol || undefined,
      timestamp: Date.now(),
    };

    // If user typed a ticker or stock name while wanting to switch
    const upperTrimmed = trimmed.toUpperCase();
    const knownSymbols: Record<string, string> = {
      AAPL: "Apple",
      MSFT: "Microsoft",
      NVDA: "Nvidia",
      TSLA: "Tesla",
      AMZN: "Amazon",
      GOOGL: "Alphabet (Google)",
      GOOG: "Alphabet (Google)",
      META: "Meta Platforms",
    };

    if (knownSymbols[upperTrimmed]) {
      handleSelectStock(upperTrimmed, knownSymbols[upperTrimmed]);
      return;
    }

    // Check if user is asking about historical investment ("What if I'd invested...")
    const lower = trimmed.toLowerCase();
    const isInvestedEarlierQuery =
      Boolean(activeSymbol) &&
      lower.includes("invest") &&
      (lower.includes("earlier") || lower.includes("ago") || lower.includes("if i") || lower.includes("what if"));

    if (isInvestedEarlierQuery) {
      const existing = messages.find(
        (m) => m.symbol === activeSymbol && m.actionType === "invested_earlier"
      );
      if (existing) {
        const el = document.getElementById(`msg-${existing.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
    }

    // Check if user is asking to compare stocks ("Compare with...", "vs ...")
    const isCompareQuery =
      Boolean(activeSymbol) &&
      (lower.includes("compare") || lower.includes(" vs ") || lower.startsWith("vs "));

    if (isCompareQuery) {
      let foundCompareSym: string | undefined;
      for (const [sym] of Object.entries(knownSymbols)) {
        if (upperTrimmed.includes(sym) && sym !== activeSymbol) {
          foundCompareSym = sym;
          break;
        }
      }

      const existing = messages.find(
        (m) =>
          m.symbol === activeSymbol &&
          m.actionType === "compare" &&
          (!foundCompareSym || m.compareSymbol === foundCompareSym)
      );

      if (existing) {
        const el = document.getElementById(`msg-${existing.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }

      const assistantMsg: ChatMessage = {
        id: `msg_a_${Date.now() + 1}`,
        role: "assistant",
        content: "",
        symbol: activeSymbol || undefined,
        companyName: activeCompanyName,
        compareSymbol: foundCompareSym,
        actionType: "compare",
        timestamp: Date.now() + 1,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      return;
    }

    // Otherwise, answer the query educationally
    const assistantMsg: ChatMessage = {
      id: `msg_a_${Date.now() + 1}`,
      role: "assistant",
      content: isInvestedEarlierQuery
        ? ""
        : `Regarding "${trimmed}": When analyzing ${activeCompanyName || "stocks"}, we look strictly at verified numbers like price trends, market valuation, and earnings. Feel free to explore the interactive chart and metrics above. Remember that all information is educational and not financial advice.`,
      symbol: activeSymbol || undefined,
      companyName: activeCompanyName,
      actionType: isInvestedEarlierQuery ? "invested_earlier" : "follow_up",
      timestamp: Date.now() + 1,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* Responsive Sidebar (Persistent on desktop >=1024px, Drawer on mobile/tablet) */}
      <AppSidebar
        isOpenOnMobile={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
        onNewChat={handleNewChat}
        onSelectStock={handleSelectStock}
        onOpenDashboard={handleOpenDashboard}
        isDashboardActive={isDashboardActive}
        activeSymbol={activeSymbol || undefined}
        triggerRef={hamburgerRef}
      />

      {/* Main Chat Content Area (Pushes right on desktop) */}
      <div
        className={`flex flex-1 flex-col h-[100dvh] w-full overflow-hidden transition-all duration-200 ${
          isCollapsed ? "lg:pl-16" : "lg:pl-72"
        }`}
      >
        {/* Mobile/Tablet Slim Top Bar (< 1024px) */}
        <MobileTopBar
          onOpenDrawer={() => setIsMobileDrawerOpen(true)}
          onNewChat={handleNewChat}
          hamburgerRef={hamburgerRef}
          isDrawerOpen={isMobileDrawerOpen}
        />

        {/* Development Setup Warning Banner (Dev mode only, offset cleanly in main column) */}
        <FeatureWarningBanner features={featureStatuses} />

        {/* Dynamic Main Body: Dashboard, Empty Search, or Active Chat */}
        {isDashboardActive ? (
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 overflow-x-hidden">
            <MarketDashboard onSelectStock={handleSelectStock} />
          </main>
        ) : !activeSymbol ? (
          // Empty State: Centered search & popular chips
          <div className="flex flex-1 flex-col h-full overflow-hidden">
            <main className="flex-1 overflow-y-auto flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-x-hidden">
              <ChatEmptyState onSelectStock={handleSelectStock} />
            </main>
            <div
              className="px-4 pt-2 shrink-0 text-center"
              style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}
            >
              <ChatDisclaimer />
            </div>
          </div>
        ) : (
          // Active Chat View (Guided Claude-style conversation)
          <div className="flex flex-1 flex-col h-full overflow-hidden">
            {/* Stock Active Header Bar */}
            <div className="flex h-16 items-center justify-between border-b border-border/80 px-4 sm:px-6 bg-background/80 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleNewChat}
                  aria-label="Back to search"
                  className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Choose another stock"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <div>
                  <h1 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                    <span className="truncate max-w-[200px] sm:max-w-md">{activeCompanyName}</span>
                    <span className="font-mono text-sm text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-md">
                      {activeSymbol}
                    </span>
                  </h1>
                </div>
              </div>

              <button
                onClick={handleNewChat}
                className="hidden sm:inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-muted transition-colors cursor-pointer"
              >
                <span>New stock</span>
              </button>
            </div>

            {/* Scrollable Message Feed (Centered max 768px on desktop, full-width with 16px padding on mobile) */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 sm:pt-6 pb-6 sm:pb-8 overflow-x-hidden">
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <div className="rounded-2xl bg-foreground px-4 py-3 text-base font-medium text-background max-w-[85%] sm:max-w-[75%] shadow-2xs">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="w-full space-y-4">
                        {/* Claude-style Assistant message header */}
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-background">
                            <Sparkles className="size-3.5 text-sky-400" />
                          </div>
                          <span>StockLens Guide</span>
                          <span className="text-sm font-normal text-muted-foreground/70">• Informational only. Not financial advice.</span>
                        </div>

                        {/* Assistant Body: Stock Overview, Invested Earlier, or Plain-Language Text Answer */}
                        {msg.actionType === "overview" && msg.symbol ? (
                          <StockOverviewMessage
                            symbol={msg.symbol}
                            companyName={msg.companyName || msg.symbol}
                            onSelectQuestion={handleSelectQuestion}
                            onDataLoaded={handleDataLoaded}
                          />
                        ) : msg.actionType === "invested_earlier" && msg.symbol ? (
                          <InvestedEarlierCard
                            symbol={msg.symbol}
                            companyName={msg.companyName || msg.symbol}
                          />
                        ) : msg.actionType === "compare" && msg.symbol ? (
                          <StockCompareCard
                            baseSymbol={msg.symbol}
                            baseCompanyName={msg.companyName || msg.symbol}
                            initialTargetSymbol={msg.compareSymbol}
                          />
                        ) : (
                          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-3">
                            <p className="text-base text-foreground leading-relaxed whitespace-pre-line">
                              {msg.content}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-2" />
              </div>
            </div>

            {/* Pinned Bottom Input Bar (Above mobile safe-area) */}
            <div
              className="border-t border-border/80 bg-background/95 backdrop-blur-md px-4 pt-3 shrink-0"
              style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}
            >
              <form
                onSubmit={handleSendMessage}
                className="mx-auto max-w-3xl flex items-center gap-2"
              >
                <div className="relative flex-1 flex items-center">
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder={`Ask anything about ${activeCompanyName || "stocks"}...`}
                    className="w-full h-14 pl-4 pr-14 rounded-2xl border border-border/80 bg-muted/30 text-base text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground/30 focus:ring-2 focus:ring-ring/30 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!inputVal.trim()}
                    aria-label="Send message"
                    className="absolute right-2 flex size-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-foreground text-background disabled:opacity-30 disabled:pointer-events-none transition-opacity cursor-pointer"
                  >
                    <Send className="size-4.5" />
                  </button>
                </div>
              </form>
              <div className="mt-2">
                <ChatDisclaimer />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
