import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShardId = 1 | 2 | 3;

function normalizeRoomCode(value: unknown): string {
  const compact = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  const match = compact.match(/^([ABC])-?([A-Z2-9]{5})$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function shardIdForRoom(code: string): ShardId {
  if (code.startsWith("A-")) return 1;
  if (code.startsWith("B-")) return 2;
  if (code.startsWith("C-")) return 3;
  throw new Error("invalid room code");
}

function shardConfig(id: ShardId) {
  if (id === 1) return { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  if (id === 2) return { url: process.env.NEXT_PUBLIC_SUPABASE_URL_2, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_2 };
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL_3, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_3 };
}

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    let body: { roomCode?: string } = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { roomCode: text }; }
    const roomCode = normalizeRoomCode(body.roomCode);
    if (!roomCode) return NextResponse.json({ ok: false, error: "invalid_room_code" }, { status: 400 });

    const shardId = shardIdForRoom(roomCode);
    const config = shardConfig(shardId);
    if (!config.url || !config.key) {
      return NextResponse.json({ ok: false, error: `server_${shardId}_not_configured` }, { status: 500 });
    }

    const supabase = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.rpc("ssaemraid_delete_room", { p_class_code: roomCode });
    if (error) throw new Error(error.message);

    console.info(`[SchoolRaid Cleanup] ${roomCode} deleted from SERVER ${shardId}`);
    return NextResponse.json({ ok: true, roomCode, shardId });
  } catch (error) {
    console.error("[SchoolRaid Cleanup] failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "cleanup_failed" }, { status: 500 });
  }
}
