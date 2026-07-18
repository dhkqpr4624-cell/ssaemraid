/**
 * 방 안 캐릭터 이동 훅
 * PC(WASD/방향키)와 모바일 D-Pad 입력을 처리합니다.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RoomPlayerPosition, RoomDirection } from '@/lib/types';

const GRID_SIZE = 40;
const ROOM_WIDTH = 800;
const ROOM_HEIGHT = 600;
const MOVE_SPEED = 4;
const MOBILE_TAP_SPEED = 2.5;

interface UseRoomMovementOptions {
  initialX?: number;
  initialY?: number;
  gridBased?: boolean;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  isBlocked?: (x: number, y: number) => boolean;
}

export function useRoomMovement(options: UseRoomMovementOptions = {}) {
  const {
    initialX = ROOM_WIDTH / 2,
    initialY = ROOM_HEIGHT - 100,
    gridBased = false,
    minX = 20,
    maxX = ROOM_WIDTH - 120,
    minY = 20,
    maxY = ROOM_HEIGHT - 180,
    isBlocked,
  } = options;

  const [position, setPosition] = useState<RoomPlayerPosition>({
    x: initialX,
    y: initialY,
    facing: 'front',
    isMoving: false,
  });

  const keysPressed = useRef<Record<string, boolean>>({});
  const animationFrameId = useRef<number | null>(null);

  const determineFacing = useCallback((dx: number, dy: number): RoomDirection => {
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    if (dy < 0) return 'back';
    if (dy > 0) return 'front';
    return 'front';
  }, []);

  const clampPosition = useCallback((x: number, y: number) => ({
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
  }), [minX, maxX, minY, maxY]);

  const resolveMovement = useCallback((prevX: number, prevY: number, nextX: number, nextY: number) => {
    const clamped = clampPosition(nextX, nextY);
    if (!isBlocked || !isBlocked(clamped.x, clamped.y)) return clamped;

    const xOnly = clampPosition(nextX, prevY);
    if (!isBlocked(xOnly.x, xOnly.y)) return xOnly;

    const yOnly = clampPosition(prevX, nextY);
    if (!isBlocked(yOnly.x, yOnly.y)) return yOnly;

    return { x: prevX, y: prevY };
  }, [clampPosition, isBlocked]);

  const movePlayer = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    setPosition(prev => {
      const step = gridBased ? GRID_SIZE : MOBILE_TAP_SPEED;
      let newX = prev.x;
      let newY = prev.y;

      if (direction === 'up') newY -= step;
      if (direction === 'down') newY += step;
      if (direction === 'left') newX -= step;
      if (direction === 'right') newX += step;

      const clamped = resolveMovement(prev.x, prev.y, newX, newY);
      const dx = clamped.x - prev.x;
      const dy = clamped.y - prev.y;

      return {
        ...prev,
        x: clamped.x,
        y: clamped.y,
        facing: dx || dy ? determineFacing(dx, dy) : prev.facing,
        isMoving: !!(dx || dy),
      };
    });
  }, [gridBased, resolveMovement, determineFacing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        keysPressed.current[key] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed.current[key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const animate = () => {
      let dx = 0;
      let dy = 0;
      const step = gridBased ? GRID_SIZE : MOVE_SPEED;

      if (keysPressed.current.w || keysPressed.current.arrowup) dy -= step;
      if (keysPressed.current.s || keysPressed.current.arrowdown) dy += step;
      if (keysPressed.current.a || keysPressed.current.arrowleft) dx -= step;
      if (keysPressed.current.d || keysPressed.current.arrowright) dx += step;

      setPosition(prev => {
        if (!dx && !dy) {
          return prev.isMoving ? { ...prev, isMoving: false } : prev;
        }
        const clamped = resolveMovement(prev.x, prev.y, prev.x + dx, prev.y + dy);
        return {
          ...prev,
          x: clamped.x,
          y: clamped.y,
          facing: determineFacing(clamped.x - prev.x, clamped.y - prev.y),
          isMoving: true,
        };
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animationFrameId.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gridBased, resolveMovement, determineFacing]);

  const setPlayerPosition = useCallback((x: number, y: number, facing?: RoomDirection) => {
    const clamped = clampPosition(x, y);
    setPosition({ x: clamped.x, y: clamped.y, facing: facing || 'front', isMoving: false });
  }, [clampPosition]);

  const setFacing = useCallback((facing: RoomDirection) => {
    setPosition(prev => ({ ...prev, facing }));
  }, []);

  return { position, movePlayer, setPlayerPosition, setFacing, GRID_SIZE, ROOM_WIDTH, ROOM_HEIGHT };
}
