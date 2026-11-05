import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, extractDeviceId, isValidUUID } from "@/lib/supabase";
import type { ChatMessage, ChatActionType } from "@/types/chat";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const deviceId = extractDeviceId(request);
    if (!deviceId || !isValidUUID(deviceId)) {
      return NextResponse.json({ messages: [] });
    }

    const { id } = await context.params;
    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ messages: [] });
    }

    const supabase = getSupabaseAdmin();

    if (supabase) {
      // Verify chat belongs to this device
      const { data: chat } = await supabase
        .from("chats")
        .select("id, ticker, title")
        .eq("id", id)
        .eq("device_id", deviceId)
        .maybeSingle();

      if (!chat) {
        return NextResponse.json({ messages: [] });
      }

      const { data: rawMsgs, error } = await supabase
        .from("chat_messages")
        .select("id, role, kind, payload, created_at")
        .eq("chat_id", id)
        .order("created_at", { ascending: true });

      if (!error && rawMsgs) {
        const messages: ChatMessage[] = rawMsgs.map((m) => {
          const payload = (m.payload || {}) as Record<string, unknown>;
          return {
            id: m.id,
            role: m.role as "user" | "assistant",
            content: typeof payload.content === "string" ? payload.content : "",
            symbol: typeof payload.symbol === "string" ? payload.symbol : chat.ticker,
            companyName: typeof payload.companyName === "string" ? payload.companyName : chat.title,
            actionType: (m.kind as ChatActionType) || "follow_up",
            compareSymbol: typeof payload.compareSymbol === "string" ? payload.compareSymbol : undefined,
            timestamp: typeof payload.timestamp === "number" ? payload.timestamp : new Date(m.created_at).getTime(),
          };
        });

        return NextResponse.json({
          chat: {
            id: chat.id,
            symbol: chat.ticker,
            companyName: chat.title,
          },
          messages,
        });
      }
    }

    return NextResponse.json({ messages: [] });
  } catch (err: unknown) {
    console.error("[GET /api/chats/[id] Error]:", err);
    return NextResponse.json({ messages: [] });
  }
}
