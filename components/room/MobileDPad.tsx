'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MobileDPadProps {
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  visible?: boolean;
}

type StickVector = { x: number; y: number };

const JOYSTICK_RADIUS = 58;
const THUMB_RADIUS = 24;
const DEAD_ZONE = 10;

function getDirectionFromVector(vector: StickVector): 'up' | 'down' | 'left' | 'right' | null {
  if (Math.hypot(vector.x, vector.y) < DEAD_ZONE) return null;
  if (Math.abs(vector.x) > Math.abs(vector.y)) return vector.x < 0 ? 'left' : 'right';
  return vector.y < 0 ? 'up' : 'down';
}

/**
 * 모바일 방 이동용 Virtual Joystick입니다.
 * 손가락을 기울인 방향으로 requestAnimationFrame마다 이동 입력을 보내므로
 * 버튼식 D-Pad보다 캐릭터 이동과 walk 애니메이션이 자연스럽게 이어집니다.
 */
export function MobileDPad({ onMove, visible = true }: MobileDPadProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const vectorRef = useRef<StickVector>({ x: 0, y: 0 });
  const [vector, setVector] = useState<StickVector>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const direction = getDirectionFromVector(vectorRef.current);
    if (direction) onMove(direction);
    frameRef.current = requestAnimationFrame(tick);
  }, [onMove]);

  const startLoop = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const updateVectorFromPointer = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = clientX - centerX;
    const rawY = clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const max = JOYSTICK_RADIUS - THUMB_RADIUS / 2;
    const scale = distance > max && distance > 0 ? max / distance : 1;
    const next = { x: rawX * scale, y: rawY * scale };
    vectorRef.current = next;
    setVector(next);
  }, []);

  const reset = useCallback(() => {
    pointerIdRef.current = null;
    vectorRef.current = { x: 0, y: 0 };
    setVector({ x: 0, y: 0 });
    setActive(false);
    stopLoop();
  }, [stopLoop]);

  useEffect(() => reset, [reset]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-8 left-8 z-50 pointer-events-auto select-none touch-none">
      <div
        ref={baseRef}
        className={cn(
          'relative h-36 w-36 rounded-full border-2 border-white/40 bg-black/20 shadow-2xl backdrop-blur-sm',
          active && 'bg-blue-500/20 border-blue-200/70'
        )}
        onPointerDown={(e) => {
          e.preventDefault();
          pointerIdRef.current = e.pointerId;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          setActive(true);
          updateVectorFromPointer(e.clientX, e.clientY);
          startLoop();
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.preventDefault();
          updateVectorFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.preventDefault();
          reset();
        }}
        onPointerCancel={reset}
      >
        <div className="absolute inset-4 rounded-full border border-white/20" />
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />
        <div
          className="absolute left-1/2 top-1/2 flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[10px] font-bold text-blue-700 shadow-lg transition-transform duration-75"
          style={{ transform: `translate(calc(-50% + ${vector.x}px), calc(-50% + ${vector.y}px))` }}
        >
          MOVE
        </div>
      </div>
      <div className="mt-3 text-center text-[11px] font-semibold text-white/80 drop-shadow">
        손가락을 밀어서 이동
      </div>
    </div>
  );
}

export function SimpleDPad({ onMove }: { onMove: (direction: 'up' | 'down' | 'left' | 'right') => void }) {
  return <MobileDPad onMove={onMove} />;
}
