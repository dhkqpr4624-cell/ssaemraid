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
  if (prefixed) return `${prefixed[1]}-${prefixed[2]}`;
  // 기존 6자리 방 코드는 서버 1에서 계속 찾습니다.
  return compact.replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function getShardIdForRoom(roomCode: string): SupabaseShardId {
  const normalized = normalizeRaidRoomCode(roomCode);
  const match = normalized.match(/^([ABC])-/);
  return match ? PREFIX_SHARD[match[1]] : 1;
}

export function getShardInfoForRoom(roomCode: string) {
  const id = getShardIdForRoom(roomCode);
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

export function createShardedRoomCode(): string {
  const configured = configs.filter((config) => config.url && config.key);
  const pool = configured.length > 0 ? configured : [configs[0]];
  // 중앙 디렉터리 없이도 여러 교사 기기에서 자연스럽게 분산되도록 무작위 선택합니다.
  const selected = pool[Math.floor(Math.random() * pool.length)];
  const chars = "DEFGHJKLMNPQRSTUVWXYZ23456789";
  const body = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${SHARD_PREFIX[selected.id]}-${body}`;
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
