import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, extractDeviceId, isValidUUID } from "@/lib/supabase";
import { cleanCompanyName } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

export const maxDuration = 30;

interface MigrationChatPayload {
  symbol: string;
  companyName?: string;
  messages?: ChatMessage[];
  createdAt?: number;
}

/**
 * POST /api/chats/migrate
 * One-time batch migration of localStorage chats to Supabase for an anonymous device ID.
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

    const rawChats = (body.chats || []) as MigrationChatPayload[];
    if (!Array.isArray(rawChats) || rawChats.length === 0) {
      return NextResponse.json({ success: true, migratedCount: 0, tickers: [] });
    }

    // Limit to max 20 chats
    const candidateChats = rawChats.slice(0, 20);
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json({
        success: true,
        migratedCount: candidateChats.length,
        tickers: candidateChats.map((c) => (c.symbol || "").toUpperCase()),
      });
    }

    const successfullyMigratedTickers: string[] = [];

    for (const chatItem of candidateChats) {
      const symbol = (chatItem.symbol || "").trim().toUpperCase();
      if (!symbol) continue;

      const companyName = cleanCompanyName(chatItem.companyName || symbol);
      const messages = (chatItem.messages || []) as ChatMessage[];
      const nowIso = new Date(chatItem.createdAt || Date.now()).toISOString();

      try {
        // 1. Check if chat already exists for this device and ticker
        let chatId: string;
        const { data: existingChat, error: lookupErr } = await supabase
          .from("chats")
          .select("id")
          .eq("device_id", deviceId)
          .eq("ticker", symbol)
          .maybeSingle();

        if (lookupErr) {
          console.error("[POST /api/chats/migrate] Supabase lookup error:", {
            code: lookupErr.code,
            message: lookupErr.message,
            symbol,
            deviceId,
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
            console.error("[POST /api/chats/migrate] Supabase update chat error:", {
              code: updErr.code,
              message: updErr.message,
              symbol,
              chatId,
            });
            continue;
          }
        } else {
          chatId = crypto.randomUUID();
          const { error: insErr } = await supabase.from("chats").insert({
            id: chatId,
            device_id: deviceId,
            ticker: symbol,
            title: companyName,
            updated_at: nowIso,
          });

          if (insErr) {
            console.error("[POST /api/chats/migrate] Supabase insert chat error:", {
              code: insErr.code,
              message: insErr.message,
              symbol,
              chatId,
            });
            continue;
          }
        }

        // 2. Persist messages if provided
        if (messages.length > 0) {
          const { error: delErr } = await supabase
            .from("chat_messages")
            .delete()
            .eq("chat_id", chatId);

          if (delErr) {
            console.error("[POST /api/chats/migrate] Supabase delete old messages error:", {
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
            console.error("[POST /api/chats/migrate] Supabase insert messages error:", {
              code: msgErr.code,
              message: msgErr.message,
              symbol,
              chatId,
            });
          }
        }

        successfullyMigratedTickers.push(symbol);
      } catch (err) {
        console.error(`[POST /api/chats/migrate] Error migrating chat for ${symbol}:`, err);
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[POST /api/chats/migrate] Migrated ${successfullyMigratedTickers.length} chats for device ${deviceId}.`
      );
    }

    return NextResponse.json({
      success: true,
      migratedCount: successfullyMigratedTickers.length,
      tickers: successfullyMigratedTickers,
    });
  } catch (err: unknown) {
    console.error("[POST /api/chats/migrate Unhandled Error]:", err);
    return NextResponse.json(
      { error: "Migration failed." },
      { status: 500 }
    );
  }
}
