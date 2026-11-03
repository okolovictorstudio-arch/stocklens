"use client";

import * as React from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { FeatureWarningBanner } from "@/components/layout/FeatureWarningBanner";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { StockOverviewMessage } from "@/components/chat/StockOverviewMessage";
import { saveRecentChat } from "@/lib/recent-chats";
import { useSidebarCollapsed } from "@/lib/sidebar-state";
import { ArrowLeft, Sparkles, Send } from "lucide-react";
import type { ChatMessage, ChatActionType } from "@/types/chat";
import type { FeatureStatus } from "@/lib/env";

interface ChatContainerProps {
  featureStatuses?: FeatureStatus[];
}

export function ChatContainer({ featureStatuses = [] }: ChatContainerProps) {
  const [activeSymbol, setActiveSymbol] = React.useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = React.useState<string>("");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = React.useState("");
  const [isCollapsed] = useSidebarCollapsed();

  const hamburgerRef = React.useRef<HTMLButtonElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll messages to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectStock = React.useCallback((symbol: string, companyName: string) => {
    const cleanSym = symbol.trim().toUpperCase();
    const cleanName = companyName || cleanSym;

    setActiveSymbol(cleanSym);
    setActiveCompanyName(cleanName);
    saveRecentChat(cleanSym, cleanName);

    // Initial guided conversation message: "Tell me about [Company]"
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

    setMessages([userMsg, assistantMsg]);
  }, []);

  const handleNewChat = React.useCallback(() => {
    setActiveSymbol(null);
    setActiveCompanyName("");
    setMessages([]);
    setInputVal("");
  }, []);

  const handleSelectQuestion = React.useCallback(
    (questionText: string, actionType?: ChatActionType) => {
      const userMsg: ChatMessage = {
        id: `msg_u_${Date.now()}`,
        role: "user",
        content: questionText,
        symbol: activeSymbol || undefined,
        timestamp: Date.now(),
      };

      let answerText = "";
      if (questionText === "Is this company doing well?") {
        answerText = `To see if a company is doing well, we check whether it produces steady profits and has a strong foundation. For ${activeCompanyName} (${activeSymbol}), its earnings (EPS) and Return on Equity (ROE) in the cards above indicate real profit generation. While past stability does not predict the future, consistent profits mean the business is actively funding its operations.`;
      } else if (questionText === "Is the price high or low right now?") {
        answerText = `We look at where the current price sits within its 52-week trading range and its P/E multiple. In the At-A-Glance card above, check the 'Yearly price range' bar. If the price is near the top third, investors are currently paying higher multiples relative to the past 12 months.`;
      } else if (questionText === "How risky is it?") {
        answerText = `Risk refers to how sharply a stock's price swings up and down. For ${activeCompanyName} (${activeSymbol}), check the 'Ups & downs' chip in the At-A-Glance card above. If the stock has a Beta greater than 1.2 or has experienced big percentage drops, expect bumpier price action during broader market swings.`;
      } else if (questionText === "Does it pay dividends?") {
        answerText = `Dividends are regular cash payouts that companies distribute to their shareholders. Look at the 'Pays dividends?' chip above. If it says Yes, you earn cash yield each year just for holding the stock; if it says No, the company prefers to keep and reinvest all profits into expanding its business.`;
      } else if (questionText === "What if I'd invested $100 earlier?") {
        answerText = `The 'What if I'd invested earlier?' calculator is arriving in Step 3! You will be able to see exactly what $100 would be worth if invested 1 month, 6 months, 1 year, or 5 years ago, calculated automatically from historical market candles.`;
      } else if (questionText === "Compare with another stock") {
        answerText = `Stock comparison is arriving in Step 4! You'll be able to pick any two companies and compare their size, valuation, dividend yield, and normalized return curves side-by-side.`;
      } else {
        answerText = `Here's what the data shows for ${activeCompanyName} (${activeSymbol}): review the At-A-Glance card and fundamentals grid above for verified numbers. Let me know if you would like me to explain any specific metric in everyday terms!`;
      }

      const assistantMsg: ChatMessage = {
        id: `msg_a_${Date.now() + 1}`,
        role: "assistant",
        content: answerText,
        symbol: activeSymbol || undefined,
        companyName: activeCompanyName,
        actionType: actionType || "follow_up",
        timestamp: Date.now() + 1,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
    },
    [activeCompanyName, activeSymbol]
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

    // Otherwise, answer the query educationally
    const assistantMsg: ChatMessage = {
      id: `msg_a_${Date.now() + 1}`,
      role: "assistant",
      content: `Regarding "${trimmed}": When analyzing ${activeCompanyName || "stocks"}, we look strictly at verified numbers like price trends, market valuation, and earnings. Feel free to explore the interactive chart and metrics above. Remember that all information is educational and not financial advice.`,
      symbol: activeSymbol || undefined,
      companyName: activeCompanyName,
      actionType: "follow_up",
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

        {/* Dynamic Chat Body */}
        {!activeSymbol ? (
          // Empty State: Centered search & popular chips
          <main className="flex-1 overflow-y-auto flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-x-hidden">
            <ChatEmptyState onSelectStock={handleSelectStock} />
          </main>
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
            <div className="flex-1 overflow-y-auto px-4 py-6 overflow-x-hidden">
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
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

                        {/* Assistant Body: Stock Overview or Plain-Language Text Answer */}
                        {msg.actionType === "overview" && msg.symbol ? (
                          <StockOverviewMessage
                            symbol={msg.symbol}
                            companyName={msg.companyName || msg.symbol}
                            onSelectQuestion={handleSelectQuestion}
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
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Pinned Bottom Input Bar (Above mobile safe-area) */}
            <div className="border-t border-border/80 bg-background/95 backdrop-blur-md px-4 py-3 pb-safe shrink-0">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
