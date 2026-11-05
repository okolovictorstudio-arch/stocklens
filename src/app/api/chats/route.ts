import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, extractDeviceId, isValidUUID } from "@/lib/supabase";
import { cleanCompanyName } from "@/lib/utils";
import type { ChatMessage, RecentChat } from "@/types/chat";

// In-Memory Chat Fallback for dev / unconfigured Supabase
interface MemoryChatEntry {
  id: string;
  symbol: string;
  companyName: string;
  createdAt: number;
  messages: ChatMessage[];
}

const gState = globalThis as unknown as {
  __stocklensMemoryChats?: Map<string, MemoryChatEntry[]>;
};

if (!gState.__stocklensMemoryChats) {
  gState.__stocklensMemoryChats = new Map();
}

const memoryChats = gState.__stocklensMemoryChats;

/**
 * GET /api/chats
 * Returns up to 20 recent chats for the anonymous device.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = extractDeviceId(request, searchParams.get("deviceId"));
    if (!deviceId || !isValidUUID(deviceId)) {
      return NextResponse.json({ chats: [] });
    }

    const supabase = getSupabaseAdmin();

    if (supabase) {
      const { data, error } = await supabase
        .from("chats")
        .select("id, ticker, title, updated_at")
        .eq("device_id", deviceId)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("[GET /api/chats] Supabase fetch error:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          deviceId,
        });
      } else if (data) {
        const chats: RecentChat[] = data.map((row) => ({
          id: row.id,
          symbol: row.ticker,
          companyName: cleanCompanyName(row.title || row.ticker),
          createdAt: new Date(row.updated_at).getTime(),
        }));
        return NextResponse.json({ chats });
      }
    }

    const localList = memoryChats.get(deviceId) || [];
    const chats: RecentChat[] = localList.map((c) => ({
      id: c.id,
      symbol: c.symbol,
      companyName: c.companyName,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ chats });
  } catch (err: unknown) {
    console.error("[GET /api/chats Error]:", err);
    return NextResponse.json({ chats: [] });
  }
}

/**
 * POST /api/chats
 * Creates or updates a conversation thread and persists its messages.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = extractDeviceId(request, body.deviceId);
    if (!deviceId || !isValidUUID(deviceId)) {
      return NextResponse.json(
        { error: "Missing or invalid device ID." },
        { status: 400 }
      );
    }

    const symbol = (body.symbol || "").trim().toUpperCase();
    const rawName = (body.companyName || "").trim();
    const companyName = cleanCompanyName(rawName || symbol);
    const messages = (body.messages || []) as ChatMessage[];

    if (!symbol) {
      return NextResponse.json(
        { error: "Ticker symbol is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let chatId = body.id && isValidUUID(body.id) ? body.id : "";

    if (supabase) {
      const nowIso = new Date().toISOString();

      // 1. Check if chat already exists for this device and ticker
      const { data: existingChat, error: findErr } = await supabase
        .from("chats")
        .select("id")
        .eq("device_id", deviceId)
        .eq("ticker", symbol)
        .maybeSingle();

      if (findErr) {
        console.error("[POST /api/chats] Supabase lookup chat error:", {
          code: findErr.code,
          message: findErr.message,
          details: findErr.details,
          hint: findErr.hint,
          deviceId,
          symbol,
        });
      }

      if (existingChat?.id) {
        chatId = existingChat.id;
        const { error: updErr } = await supabase
          .from("chats")
          .update({
            title: companyName,
            updated_at: nowIso,
          })
          .eq("id", chatId);

        if (updErr) {
          console.error("[POST /api/chats] Supabase update chat error:", {
            code: updErr.code,
            message: updErr.message,
            details: updErr.details,
            hint: updErr.hint,
            chatId,
            symbol,
          });
        }
      } else {
        if (!chatId) chatId = crypto.randomUUID();
        const { error: insErr } = await supabase.from("chats").insert({
          id: chatId,
          device_id: deviceId,
          ticker: symbol,
          title: companyName,
          updated_at: nowIso,
        });

        if (insErr) {
          console.error("[POST /api/chats] Supabase insert chat error:", {
            code: insErr.code,
            message: insErr.message,
            details: insErr.details,
            hint: insErr.hint,
            chatId,
            symbol,
          });
        }
      }

      // 2. Persist messages if provided
      if (messages.length > 0 && chatId) {
        const { error: delErr } = await supabase
          .from("chat_messages")
          .delete()
          .eq("chat_id", chatId);

        if (delErr) {
          console.error("[POST /api/chats] Supabase delete old messages error:", {
            code: delErr.code,
            message: delErr.message,
            chatId,
          });
        }

        const rows = messages.slice(0, 50).map((m) => ({
          chat_id: chatId,
          role: m.role === "user" ? "user" : "assistant",
          kind: m.actionType || "follow_up",
          payload: {
            content: typeof m.content === "string" ? m.content : "",
            symbol: m.symbol || symbol,
            companyName: m.companyName || companyName,
            compareSymbol: m.compareSymbol,
            timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
          },
        }));

        const { error: msgErr } = await supabase.from("chat_messages").insert(rows);
        if (msgErr) {
          console.error("[POST /api/chats] Supabase insert messages error:", {
            code: msgErr.code,
            message: msgErr.message,
            details: msgErr.details,
            hint: msgErr.hint,
            chatId,
          });
        }
      }

      // 3. Trim to max 20 most recent chats
      const { data: allChats, error: trimFetchErr } = await supabase
        .from("chats")
        .select("id")
        .eq("device_id", deviceId)
        .order("updated_at", { ascending: false });

      if (trimFetchErr) {
        console.error("[POST /api/chats] Supabase trim fetch error:", trimFetchErr.message);
      } else if (allChats && allChats.length > 20) {
        const excessIds = allChats.slice(20).map((c) => c.id);
        const { error: trimDelErr } = await supabase.from("chats").delete().in("id", excessIds);
        if (trimDelErr) {
          console.error("[POST /api/chats] Supabase trim delete error:", trimDelErr.message);
        }
      }
    } else {
      if (!chatId) chatId = crypto.randomUUID();
      const list = memoryChats.get(deviceId) || [];
      const updatedList = list.filter((c) => c.symbol !== symbol && c.id !== chatId);
      updatedList.unshift({
        id: chatId,
        symbol,
        companyName,
        createdAt: Date.now(),
        messages,
      });
      memoryChats.set(deviceId, updatedList.slice(0, 20));
    }

    return NextResponse.json({
      success: true,
      chat: {
        id: chatId,
        symbol,
        companyName,
        createdAt: Date.now(),
      },
    });
  } catch (err: unknown) {
    console.error("[POST /api/chats Error]:", err);
    return NextResponse.json(
      { error: "Unable to save chat." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chats?symbol=AAPL or ?id=uuid
 * Deletes a chat session for this device.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = extractDeviceId(request, searchParams.get("deviceId"));
    if (!deviceId || !isValidUUID(deviceId)) {
      return NextResponse.json(
        { error: "Missing or invalid device ID." },
        { status: 400 }
      );
    }

    const id = searchParams.get("id");
    const symbol = searchParams.get("symbol")?.toUpperCase();

    const supabase = getSupabaseAdmin();

    if (supabase) {
      let query = supabase.from("chats").delete().eq("device_id", deviceId);
      if (id && isValidUUID(id)) {
        query = query.eq("id", id);
      } else if (symbol) {
        query = query.eq("ticker", symbol);
      }
      const { error: delErr } = await query;
      if (delErr) {
        console.error("[DELETE /api/chats] Supabase delete error:", {
          code: delErr.code,
          message: delErr.message,
          deviceId,
          id,
          symbol,
        });
      }
    } else {
      const list = memoryChats.get(deviceId) || [];
      memoryChats.set(
        deviceId,
        list.filter((c) => (id ? c.id !== id : c.symbol !== symbol))
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/chats Error]:", err);
    return NextResponse.json(
      { error: "Unable to delete chat." },
      { status: 500 }
    );
  }
}
