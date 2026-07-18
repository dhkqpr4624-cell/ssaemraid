'use client';

import React from 'react';
import type { Student, RoomPlayerPosition } from '@/lib/types';
import { SpriteAvatarRenderer } from '@/components/avatar/AvatarRenderer';

interface RoomPlayerProps {
  student: Student;
  position: RoomPlayerPosition;
}

/**
 * 방 안 플레이어 캐릭터 컴포넌트
 * 
 * 학생의 스프라이트 기반 아바타를 방 안의 특정 위치에 렌더링합니다.
 * WASD 이동 및 애니메이션을 지원합니다.
 */
export function RoomPlayer({ student, position }: RoomPlayerProps) {
  const avatarState = student.avatarState || {
    skinColor: '#E8B9A0',
    eyeColor: '#6B4423',
    equipped: {},
    animationState: position.isMoving ? 'walk' : 'idle',
    facing: position.facing,
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: position.isMoving ? 'none' : 'all 0.1s ease-out',
        zIndex: 100,
      }}
      className="pointer-events-none"
    >
      {/* 플레이어 아바타 */}
      <div className="flex flex-col items-center">
        {/* 스프라이트 기반 아바타 렌더러 */}
        <SpriteAvatarRenderer
          avatarState={avatarState}
          inventory={student.items} // 인벤토리 전달하여 장착 아이템 표시
          facing={position.facing}
          showAnimation={false}
          skinColor={student.avatarState?.skinColor}
          eyeColor={student.avatarState?.eyeColor}
        />

        {/* 플레이어 이름 */}
        <div className="mt-1 text-xs font-bold text-center bg-white/80 px-2 py-1 rounded whitespace-nowrap shadow-sm">
          {student.nickname}
        </div>
      </div>
    </div>
  );
}

/**
 * 여러 플레이어를 표시하는 컴포넌트
 */
export function RoomPlayers({
  students,
  positions,
}: {
  students: Student[];
  positions: Record<string, RoomPlayerPosition>;
}) {
  return (
    <>
      {students.map(student => {
        const position = positions[student.id];
        if (!position) return null;

        return (
          <RoomPlayer
            key={student.id}
            student={student}
            position={position}
          />
        );
      })}
    </>
  );
}
