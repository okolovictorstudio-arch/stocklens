import { NextRequest, NextResponse } from "next/server";
import { getHistoricalCandles } from "@/lib/twelvedata";
import type { TimeRange } from "@/types/stock";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const range = (searchParams.get("range") || "1M") as TimeRange;
  const basePriceStr = searchParams.get("basePrice");
  const basePrice = basePriceStr ? parseFloat(basePriceStr) : undefined;

  if (!symbol || symbol.trim().length === 0) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  try {
    const data = await getHistoricalCandles(symbol, range, basePrice);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API /api/candles] Error:", err);
    return NextResponse.json(
      {
        symbol,
        range,
        candles: [],
        isAvailable: false,
        errorMessage: "Unable to load candles at this time.",
      },
      { status: 200 } // return 200 with error flag so client handles it gracefully
    );
  }
}
