"use client";

import { getShardInfoForRoom } from "@/lib/supabase-shards";

export function SupabaseShardBadge({ roomCode, compact = false }: { roomCode: string; compact?: boolean }) {
  if (!roomCode) return null;
  const info = getShardInfoForRoom(roomCode);
  return (
    <div
      title={`Supabase project ref: ${info.projectRef}`}
      className="fixed bottom-2 right-2 z-[100] rounded-md border border-cyan-400/70 bg-slate-950/90 px-2 py-1 font-mono text-[10px] font-bold text-cyan-200 shadow-lg"
    >
      {compact ? info.label : `${info.label} · ${info.projectRef}`}
      {!info.configured && <span className="ml-1 text-red-300">ENV 없음</span>}
    </div>
  );
}
