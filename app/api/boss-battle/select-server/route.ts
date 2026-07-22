import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShardId = 1 | 2 | 3;
const PREFIX: Record<ShardId, string> = { 1: "A", 2: "B", 3: "C" };
const ROOM_CODE_CHARS = "DEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ROOM_CODE_ATTEMPTS = 20;

function shardConfig(id: ShardId) {
  if (id === 1) return { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  if (id === 2) return { url: process.env.NEXT_PUBLIC_SUPABASE_URL_2, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_2 };
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL_3, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_3 };
}

function createShardClient(id: ShardId): SupabaseClient {
  const config = shardConfig(id);
  if (!config.url || !config.key) throw new Error(`SERVER ${id} is not configured`);
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function randomBody() {
  return Array.from(
    { length: 5 },
    () => ROOM_CODE_CHARS[randomInt(0, ROOM_CODE_CHARS.length)],
  ).join("");
}

async function createUniqueRoomCode(client: SupabaseClient, shardId: ShardId) {
  for (let attempt = 1; attempt <= MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
    const roomCode = `${PREFIX[shardId]}-${randomBody()}`;
    const { data, error } = await client
      .from("boss_battle_sessions")
      .select("id")
      .eq("class_code", roomCode)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`방 코드 중복 확인 실패: ${error.message}`);
    }
    if (!data) {
      return { roomCode, attempts: attempt };
    }

    console.warn("[SchoolRaid Load Balancer] duplicate room code regenerated", {
      shardId,
      roomCode,
      attempt,
    });
  }

  throw new Error("고유한 방 코드를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.");
}

export async function POST() {
  const ids: ShardId[] = [1, 2, 3];
  const checks = await Promise.all(ids.map(async (id) => {
    const config = shardConfig(id);
    if (!config.url || !config.key) return { id, count: null as number | null, error: "not_configured" };
    try {
      const client = createShardClient(id);
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
  const selected = candidates[randomInt(0, candidates.length)];
  const activeRooms = Object.fromEntries(checks.map((x) => [`server${x.id}`, x.count]));

  try {
    const client = createShardClient(selected.id);
    const { roomCode, attempts } = await createUniqueRoomCode(client, selected.id);
    console.info(`[SchoolRaid Load Balancer] selected SERVER ${selected.id}`, {
      roomCode,
      activeRooms,
      roomCodeAttempts: attempts,
    });
    return NextResponse.json({ ok: true, roomCode, shardId: selected.id, activeRooms, checks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "방 코드 생성에 실패했습니다.";
    console.error("[SchoolRaid Load Balancer] room code generation failed", {
      shardId: selected.id,
      error: message,
    });
    return NextResponse.json({ ok: false, error: message, checks }, { status: 503 });
  }
}
