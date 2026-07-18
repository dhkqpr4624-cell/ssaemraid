'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileDPadProps {
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  visible?: boolean;
}

/**
 * 모바일 D-Pad 컴포넌트
 * 
 * 모바일/태블릿 환경에서 방 안 캐릭터를 이동하기 위한 가상 조이스틱입니다.
 * 
 * 구조:
 * ```
 *        ↑
 *     ← ● →
 *        ↓
 * ```
 */
export function MobileDPad({ onMove, visible = true }: MobileDPadProps) {
  const [isPressed, setIsPressed] = useState<string | null>(null);

  // 터치 시작
  const handleTouchStart = (direction: string) => {
    setIsPressed(direction);
    onMove(direction as any);
  };

  // 터치 종료
  const handleTouchEnd = () => {
    setIsPressed(null);
  };

  // 마우스 클릭 (테스트용)
  const handleMouseDown = (direction: string) => {
    setIsPressed(direction);
    onMove(direction as any);
  };

  const handleMouseUp = () => {
    setIsPressed(null);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-8 left-8 z-50 pointer-events-auto">
      {/* D-Pad 배경 */}
      <div className="relative w-32 h-32 bg-black/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
        {/* 중앙 버튼 */}
        <div className="absolute w-12 h-12 bg-white/30 rounded-full flex items-center justify-center border border-white/50 cursor-pointer select-none">
          <div className="text-xs font-bold text-white">MOVE</div>
        </div>

        {/* 위 버튼 */}
        <button
          onTouchStart={() => handleTouchStart('up')}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleMouseDown('up')}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            'absolute top-2 w-10 h-10 rounded-full flex items-center justify-center transition-all',
            'border border-white/50 cursor-pointer select-none',
            isPressed === 'up'
              ? 'bg-blue-500 scale-110 shadow-lg'
              : 'bg-white/20 hover:bg-white/30'
          )}
          title="위로 이동 (W)"
        >
          <ArrowUp className="w-5 h-5 text-white" />
        </button>

        {/* 아래 버튼 */}
        <button
          onTouchStart={() => handleTouchStart('down')}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleMouseDown('down')}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            'absolute bottom-2 w-10 h-10 rounded-full flex items-center justify-center transition-all',
            'border border-white/50 cursor-pointer select-none',
            isPressed === 'down'
              ? 'bg-blue-500 scale-110 shadow-lg'
              : 'bg-white/20 hover:bg-white/30'
          )}
          title="아래로 이동 (S)"
        >
          <ArrowDown className="w-5 h-5 text-white" />
        </button>

        {/* 왼쪽 버튼 */}
        <button
          onTouchStart={() => handleTouchStart('left')}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleMouseDown('left')}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            'absolute left-2 w-10 h-10 rounded-full flex items-center justify-center transition-all',
            'border border-white/50 cursor-pointer select-none',
            isPressed === 'left'
              ? 'bg-blue-500 scale-110 shadow-lg'
              : 'bg-white/20 hover:bg-white/30'
          )}
          title="왼쪽으로 이동 (A)"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* 오른쪽 버튼 */}
        <button
          onTouchStart={() => handleTouchStart('right')}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleMouseDown('right')}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            'absolute right-2 w-10 h-10 rounded-full flex items-center justify-center transition-all',
            'border border-white/50 cursor-pointer select-none',
            isPressed === 'right'
              ? 'bg-blue-500 scale-110 shadow-lg'
              : 'bg-white/20 hover:bg-white/30'
          )}
          title="오른쪽으로 이동 (D)"
        >
          <ArrowRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* 조작 설명 */}
      <div className="mt-4 text-xs text-white/70 text-center">
        <p>터치로 이동</p>
        <p className="text-[10px]">또는 WASD 키</p>
      </div>
    </div>
  );
}

/**
 * 간단한 D-Pad (버튼 스타일)
 * 
 * 더 간단한 버튼 기반 D-Pad가 필요한 경우 사용
 */
export function SimpleDPad({ onMove }: { onMove: (direction: 'up' | 'down' | 'left' | 'right') => void }) {
  return (
    <div className="fixed bottom-8 left-8 z-50 pointer-events-auto">
      <div className="grid grid-cols-3 gap-2 w-32">
        {/* 빈 칸 */}
        <div />
        {/* 위 */}
        <button
          onTouchStart={() => onMove('up')}
          onMouseDown={() => onMove('up')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded transition-colors"
        >
          ↑
        </button>
        {/* 빈 칸 */}
        <div />

        {/* 왼쪽 */}
        <button
          onTouchStart={() => onMove('left')}
          onMouseDown={() => onMove('left')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded transition-colors"
        >
          ←
        </button>
        {/* 중앙 */}
        <button
          disabled
          className="bg-gray-400 text-white font-bold py-2 px-3 rounded cursor-default"
        >
          ●
        </button>
        {/* 오른쪽 */}
        <button
          onTouchStart={() => onMove('right')}
          onMouseDown={() => onMove('right')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded transition-colors"
        >
          →
        </button>

        {/* 빈 칸 */}
        <div />
        {/* 아래 */}
        <button
          onTouchStart={() => onMove('down')}
          onMouseDown={() => onMove('down')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded transition-colors"
        >
          ↓
        </button>
        {/* 빈 칸 */}
        <div />
      </div>
    </div>
  );
}
