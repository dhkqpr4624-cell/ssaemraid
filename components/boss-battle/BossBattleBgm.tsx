"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { BOSS_MUTE_EVENT, getBossMuted, setBossMuted } from "@/lib/boss-audio";

export function BossBattleBgm() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [muted, setMutedState] = useState(false);
  const play = useCallback(async () => {
    try {
      await ref.current?.play();
    } catch {}
  }, []);

  useEffect(() => {
    const initial = getBossMuted();
    setMutedState(initial);
    const a = new Audio("/boss-battle/battle-bgm.mp3");
    a.volume = 0.58;
    a.preload = "auto";
    a.muted = initial;
    ref.current = a;
    const ended = () => {
      timer.current = setTimeout(
        () => {
          a.currentTime = 0;
          void play();
        },
        4000 + Math.floor(Math.random() * 1001),
      );
    };
    const sync = (e: Event) => {
      const value = e instanceof CustomEvent ? !!e.detail : getBossMuted();
      setMutedState(value);
      a.muted = value;
    };
    a.addEventListener("ended", ended);
    window.addEventListener(BOSS_MUTE_EVENT, sync);
    window.addEventListener("storage", sync);
    void play();
    const resume = () => void play();
    window.addEventListener("pointerdown", resume, { once: true });
    return () => {
      a.pause();
      a.removeEventListener("ended", ended);
      window.removeEventListener(BOSS_MUTE_EVENT, sync);
      window.removeEventListener("storage", sync);
      if (timer.current) clearTimeout(timer.current);
      ref.current = null;
    };
  }, [play]);

  const toggle = () => {
    const next = !getBossMuted();
    setBossMuted(next);
    setMutedState(next);
    if (ref.current) {
      ref.current.muted = next;
      if (ref.current.paused) void play();
    }
  };
  return (
    <Button
      variant="outline"
      className="bg-white text-slate-950"
      onClick={toggle}
    >
      {muted ? (
        <VolumeX className="mr-2 h-4 w-4" />
      ) : (
        <Volume2 className="mr-2 h-4 w-4" />
      )}
      {muted ? "음소거 해제" : "음소거"}
    </Button>
  );
}
