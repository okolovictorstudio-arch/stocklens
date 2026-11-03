import { NextRequest, NextResponse } from "next/server";
import { searchSymbols } from "@/lib/finnhub";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchSymbols(q);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[API /api/search] Error:", err);
    return NextResponse.json(
      { results: [], error: "Failed to search symbols" },
      { status: 500 }
    );
  }
}
