import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, extractDeviceId, isValidUUID } from "@/lib/supabase";
import { getStockQuote, getStockProfile } from "@/lib/finnhub";
import { cleanCompanyName } from "@/lib/utils";

export interface WatchlistItem {
  ticker: string;
  companyName: string;
  currentPrice: number;
  change: number;
  percentChange: number;
  marketStatus: "open" | "closed" | "pre-market" | "after-hours";
  createdAt?: string;
}

// In-Memory Watchlist Fallback for dev / unconfigured Supabase (keyed by deviceId)
const gState = globalThis as unknown as {
  __stocklensWatchlists?: Map<string, Array<{ ticker: string; companyName: string; createdAt: string }>>;
};

if (!gState.__stocklensWatchlists) {
  gState.__stocklensWatchlists = new Map();
}

const memoryWatchlists = gState.__stocklensWatchlists;

/**
 * GET /api/watchlist
 * Returns user's saved watchlist items with enriched cached quotes.
 * 0 Twelve Data API credits used (pure Finnhub cached quotes).
 */
export async function GET(request: NextRequest) {
  try {
    const deviceId = extractDeviceId(request);
    if (!deviceId || !isValidUUID(deviceId)) {
      return NextResponse.json({ items: [] });
    }

    const supabase = getSupabaseAdmin();
    let rawItems: Array<{ ticker: string; created_at?: string }> = [];

    if (supabase) {
      const { data, error } = await supabase
        .from("watchlist")
        .select("ticker, created_at")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        rawItems = data;
      }
    } else {
      const memList = memoryWatchlists.get(deviceId) || [];
      rawItems = memList.map((m) => ({ ticker: m.ticker, created_at: m.createdAt }));
    }

    // Enrich tickers concurrently with cached quotes and profiles
    const enriched = await Promise.all(
      rawItems.map(async (row) => {
        const [quote, profile] = await Promise.all([
          getStockQuote(row.ticker),
          getStockProfile(row.ticker),
        ]);

        const companyName = cleanCompanyName(profile?.name || row.ticker);
        const currentPrice = quote?.currentPrice || 0;
        const change = quote?.change || 0;
        const percentChange = quote?.percentChange || 0;
        const marketStatus = quote?.marketStatus || "closed";

        return {
          ticker: row.ticker,
          companyName,
          currentPrice,
          change,
          percentChange,
          marketStatus,
          createdAt: row.created_at,
        } as WatchlistItem;
      })
    );

    return NextResponse.json({ items: enriched });
  } catch (err: unknown) {
    console.error("[GET /api/watchlist Error]:", err);
    return NextResponse.json({ items: [] });
  }
}

/**
 * POST /api/watchlist
 * Adds a ticker to the user's watchlist (Max 10 tickers).
 */
export async function POST(request: NextRequest) {
  try {
    const deviceId = extractDeviceId(request);
    if (!deviceId || !isValidUUID(deviceId)) {
      return NextResponse.json(
        { error: "Missing or invalid device ID." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const ticker = (body.ticker || "").trim().toUpperCase();
    const reqName = (body.companyName || "").trim();

    if (!ticker) {
      return NextResponse.json(
        { error: "Please provide a valid stock ticker." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (supabase) {
      // Check current count
      const { count, error: countErr } = await supabase
        .from("watchlist")
        .select("id", { count: "exact", head: true })
        .eq("device_id", deviceId);

      if (!countErr && (count || 0) >= 10) {
        return NextResponse.json(
          { error: "Watchlist limit reached. Maximum 10 stocks allowed." },
          { status: 400 }
        );
      }

      const { error: insertErr } = await supabase.from("watchlist").upsert(
        {
          device_id: deviceId,
          ticker,
        },
        { onConflict: "device_id,ticker" }
      );

      if (insertErr) {
        console.warn("[POST /api/watchlist] Supabase insert warning:", insertErr.message);
      }
    } else {
      const list = memoryWatchlists.get(deviceId) || [];
      if (list.length >= 10 && !list.some((i) => i.ticker === ticker)) {
        return NextResponse.json(
          { error: "Watchlist limit reached. Maximum 10 stocks allowed." },
          { status: 400 }
        );
      }
      if (!list.some((i) => i.ticker === ticker)) {
        list.unshift({ ticker, companyName: reqName || ticker, createdAt: new Date().toISOString() });
        memoryWatchlists.set(deviceId, list.slice(0, 10));
      }
    }

    return NextResponse.json({ success: true, ticker });
  } catch (err: unknown) {
    console.error("[POST /api/watchlist Error]:", err);
    return NextResponse.json(
      { error: "Unable to update watchlist. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/watchlist?ticker=AAPL
 * Removes a ticker from the user's watchlist.
 */
export async function DELETE(request: NextRequest) {
  try {
    const deviceId = extractDeviceId(request);
    if (!deviceId || !isValidUUID(deviceId)) {
      return NextResponse.json(
        { error: "Missing or invalid device ID." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ticker = (searchParams.get("ticker") || "").trim().toUpperCase();

    if (!ticker) {
      return NextResponse.json(
        { error: "Missing ticker parameter." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (supabase) {
      await supabase
        .from("watchlist")
        .delete()
        .eq("device_id", deviceId)
        .eq("ticker", ticker);
    } else {
      const list = memoryWatchlists.get(deviceId) || [];
      memoryWatchlists.set(
        deviceId,
        list.filter((i) => i.ticker !== ticker)
      );
    }

    return NextResponse.json({ success: true, ticker });
  } catch (err: unknown) {
    console.error("[DELETE /api/watchlist Error]:", err);
    return NextResponse.json(
      { error: "Unable to remove item from watchlist." },
      { status: 500 }
    );
  }
}
