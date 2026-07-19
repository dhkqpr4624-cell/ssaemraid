"use client";

export type BossAudioRole = "teacher" | "student";

export const BOSS_MUTE_EVENT = "boss-battle-mute-change";

function muteKey(role: BossAudioRole) {
  return `boss-battle-muted-${role}`;
}

export function getBossMuted(role: BossAudioRole = "teacher"): boolean {
  if (typeof window === "undefined") return role === "student";
  const saved = window.localStorage.getItem(muteKey(role));
  if (saved === null) return role === "student";
  return saved === "1";
}

export function setBossMuted(role: BossAudioRole, muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(muteKey(role), muted ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(BOSS_MUTE_EVENT, { detail: { role, muted } }),
  );
}

export function applyBossMute(audio: HTMLAudioElement, role: BossAudioRole = "teacher") {
  audio.muted = getBossMuted(role);
  return audio;
}
