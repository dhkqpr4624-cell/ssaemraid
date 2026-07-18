"use client";
import { useEffect, useState } from "react";
const DISPLAY_W = 680,
  DISPLAY_H = 620;
const SHEET_W = 2048,
  SHEET_H = 1868,
  COLS = 3,
  ROWS = 3;
const FRAME_W = SHEET_W / COLS,
  FRAME_H = SHEET_H / ROWS;
const SCALE = DISPLAY_W / FRAME_W;
export function BossSprite({
  mode,
  className = "",
}: {
  mode: "idle" | "roar" | "hit" | "defeated";
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    if (mode !== "idle") return;
    const t = window.setInterval(() => setFrame((v) => (v + 1) % 9), 260);
    return () => window.clearInterval(t);
  }, [mode]);
  const common = `relative shrink-0 overflow-visible ${className}`;
  if (mode === "defeated")
    return (
      <div className={common} style={{ width: DISPLAY_W, height: DISPLAY_H }}>
        <img
          src="/boss-battle/haetae-defeated.png"
          className="absolute inset-0 h-full w-full max-w-none object-contain"
          alt="쓰러진 보스"
        />
      </div>
    );
  if (mode === "roar" || mode === "hit")
    return (
      <div className={common} style={{ width: DISPLAY_W, height: DISPLAY_H }}>
        <img
          src={
            mode === "roar"
              ? "/boss-battle/haetae-roar.png"
              : "/boss-battle/haetae-hit.png"
          }
          className="absolute inset-0 h-full w-full max-w-none animate-[bossShake_.12s_ease-in-out_infinite] object-contain"
          alt="보스"
        />
        {mode === "hit" && (
          <div className="pointer-events-none absolute inset-0 animate-[hitFlash_.5s_ease-out_1] bg-red-500/70 [mask-image:url('/boss-battle/haetae-hit.png')] [mask-size:100%_100%] [mask-repeat:no-repeat] [mask-position:center]" />
        )}
      </div>
    );
  const col = frame % 3,
    row = Math.floor(frame / 3);
  return (
    <div
      className={common}
      style={{
        width: DISPLAY_W,
        height: DISPLAY_H,
        backgroundImage: "url('/boss-battle/haetae-idle.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${SHEET_W * SCALE}px ${SHEET_H * SCALE}px`,
        backgroundPosition: `-${col * FRAME_W * SCALE}px -${row * FRAME_H * SCALE}px`,
      }}
      aria-label="타락한 해태"
    />
  );
}
