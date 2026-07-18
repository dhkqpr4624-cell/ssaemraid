"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { BOSS_MUTE_EVENT, getBossMuted, setBossMuted } from "@/lib/boss-audio";
export function BossWaitingRoomBgm({ className = "" }: { className?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null),
    restart = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [muted, setMutedState] = useState(false);
  const clear = useCallback(() => {
    if (restart.current) {
      clearTimeout(restart.current);
      restart.current = null;
    }
  }, []);
  const play = useCallback(async () => {
    clear();
    try {
      await audioRef.current?.play();
    } catch {}
  }, [clear]);
  useEffect(() => {
    const initial = getBossMuted();
    setMutedState(initial);
    const a = new Audio("/boss-battle/waiting-room-bgm.wav");
    a.preload = "auto";
    a.loop = false;
    a.volume = 0.55;
    a.muted = initial;
    audioRef.current = a;
    const ended = () => {
      clear();
      restart.current = setTimeout(
        () => {
          a.currentTime = 0;
          void play();
        },
        3000 + Math.floor(Math.random() * 2001),
      );
    };
    const sync = (e: Event) => {
      const v = e instanceof CustomEvent ? !!e.detail : getBossMuted();
      setMutedState(v);
      a.muted = v;
    };
    const resume = () => {
      if (a.paused) void play();
    };
    a.addEventListener("ended", ended);
    window.addEventListener(BOSS_MUTE_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    void play();
    return () => {
      clear();
      a.removeEventListener("ended", ended);
      window.removeEventListener(BOSS_MUTE_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      a.pause();
      a.src = "";
      audioRef.current = null;
    };
  }, [clear, play]);
  const toggle = () => {
    const next = !getBossMuted();
    setBossMuted(next);
    setMutedState(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
      if (audioRef.current.paused) void play();
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      className={`bg-white text-slate-950 hover:bg-slate-100 ${className}`}
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
