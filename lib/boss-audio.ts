"use client";

export const BOSS_MUTE_KEY = "boss-battle-muted";
export const BOSS_MUTE_EVENT = "boss-battle-mute-change";

export function getBossMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(BOSS_MUTE_KEY) === "1";
}

export function setBossMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOSS_MUTE_KEY, muted ? "1" : "0");
  window.dispatchEvent(new CustomEvent(BOSS_MUTE_EVENT, { detail: muted }));
}

export function applyBossMute(audio: HTMLAudioElement) {
  audio.muted = getBossMuted();
  return audio;
}
