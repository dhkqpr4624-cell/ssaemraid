import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShardId = 1 | 2 | 3;
const PREFIX: Record<ShardId, string> = { 1: "A", 2: "B", 3: "C" };

function shardConfig(id: ShardId) {
  if (id === 1) return { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  if (id === 2) return { url: process.env.NEXT_PUBLIC_SUPABASE_URL_2, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_2 };
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL_3, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_3 };
}

function randomBody() {
  const chars = "DEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST() {
  const ids: ShardId[] = [1, 2, 3];
  const checks = await Promise.all(ids.map(async (id) => {
    const config = shardConfig(id);
    if (!config.url || !config.key) return { id, count: null as number | null, error: "not_configured" };
    try {
      const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.rpc("ssaemraid_active_room_count", { p_active_within: "3 minutes" });
      if (error) throw new Error(error.message);
      return { id, count: Number(data) || 0, error: null };
    } catch (error) {
      return { id, count: null, error: error instanceof Error ? error.message : "query_failed" };
    }
  }));

  const available = checks.filter((x): x is { id: ShardId; count: number; error: null } => x.count !== null);
  if (!available.length) {
    console.error("[SchoolRaid Load Balancer] all shard checks failed", checks);
    return NextResponse.json({ ok: false, error: "세 Supabase 서버의 상태를 확인하지 못했습니다.", checks }, { status: 503 });
  }

  const minimum = Math.min(...available.map((x) => x.count));
  const candidates = available.filter((x) => x.count === minimum);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const roomCode = `${PREFIX[selected.id]}-${randomBody()}`;
  const activeRooms = Object.fromEntries(checks.map((x) => [`server${x.id}`, x.count]));
  console.info(`[SchoolRaid Load Balancer] selected SERVER ${selected.id}`, { roomCode, activeRooms });
  return NextResponse.json({ ok: true, roomCode, shardId: selected.id, activeRooms, checks });
}
