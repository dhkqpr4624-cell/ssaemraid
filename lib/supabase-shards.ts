"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseShardId = 1 | 2 | 3;

const SHARD_PREFIX: Record<SupabaseShardId, string> = { 1: "A", 2: "B", 3: "C" };
const PREFIX_SHARD: Record<string, SupabaseShardId> = { A: 1, B: 2, C: 3 };

const configs = [
  {
    id: 1 as const,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  },
  {
    id: 2 as const,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL_2 || "",
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_2 || "",
  },
  {
    id: 3 as const,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL_3 || "",
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_3 || "",
  },
];

const dummyUrl = "https://dummy.supabase.co";
const dummyKey = "dummy-key";
const clients = new Map<SupabaseShardId, SupabaseClient>();

function configFor(id: SupabaseShardId) {
  return configs.find((config) => config.id === id)!;
}

export function normalizeRaidRoomCode(value: string): string {
  const raw = String(value || "").trim().toUpperCase();
  const compact = raw.replace(/\s+/g, "");
  const prefixed = compact.match(/^([ABC])-?([A-Z2-9]{5})$/);
  // 3서버 전환 이후에는 A-/B-/C- 접두사가 있는 새 형식만 허용합니다.
  return prefixed ? `${prefixed[1]}-${prefixed[2]}` : "";
}

export function getShardIdForRoom(roomCode: string): SupabaseShardId {
  const normalized = normalizeRaidRoomCode(roomCode);
  const match = normalized.match(/^([ABC])-/);
  if (!match) throw new Error("유효하지 않은 방 코드입니다. A-XXXXX, B-XXXXX, C-XXXXX 형식으로 입력해주세요.");
  return PREFIX_SHARD[match[1]];
}

export function getShardInfoForRoom(roomCode: string) {
  const normalized = normalizeRaidRoomCode(roomCode);
  const match = normalized.match(/^([ABC])-/);
  if (!match) {
    return { id: 1 as SupabaseShardId, label: "INVALID ROOM", prefix: "?", projectRef: "invalid-room-code", configured: false };
  }
  const id = PREFIX_SHARD[match[1]];
  const config = configFor(id);
  let projectRef = "not-configured";
  try {
    projectRef = config.url ? new URL(config.url).hostname.split(".")[0] : "not-configured";
  } catch {}
  return {
    id,
    label: `SERVER ${id}`,
    prefix: SHARD_PREFIX[id],
    projectRef,
    configured: Boolean(config.url && config.key),
  };
}

export function isShardConfigured(roomCode: string): boolean {
  return getShardInfoForRoom(roomCode).configured;
}

export function getSupabaseForRoom(roomCode: string): SupabaseClient {
  const id = getShardIdForRoom(roomCode);
  const cached = clients.get(id);
  if (cached) return cached;
  const config = configFor(id);
  const client = createClient(config.url || dummyUrl, config.key || dummyKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.set(id, client);
  if (typeof window !== "undefined") {
    const info = getShardInfoForRoom(roomCode);
    console.info(`[SchoolRaid Shard] ${normalizeRaidRoomCode(roomCode)} -> ${info.label}`, {
      projectRef: info.projectRef,
      configured: info.configured,
    });
  }
  return client;
}

export function createRoomCodeForShard(id: SupabaseShardId): string {
  const chars = "DEFGHJKLMNPQRSTUVWXYZ23456789";
  const body = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${SHARD_PREFIX[id]}-${body}`;
}

export async function requestLeastLoadedRoomCode(): Promise<{ roomCode: string; shardId: SupabaseShardId; activeRooms: Record<string, number | null> }> {
  const response = await fetch("/api/boss-battle/select-server", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.roomCode) {
    throw new Error(payload?.error || "사용 가능한 서버를 찾지 못했습니다.");
  }
  console.info(`[SchoolRaid Load Balancer] ${payload.roomCode} -> SERVER ${payload.shardId}`, payload.activeRooms);
  return payload;
}

export function getConfiguredShardSummary() {
  return configs.map((config) => ({
    id: config.id,
    configured: Boolean(config.url && config.key),
    projectRef: (() => {
      try { return config.url ? new URL(config.url).hostname.split(".")[0] : "not-configured"; }
      catch { return "invalid-url"; }
    })(),
  }));
}
