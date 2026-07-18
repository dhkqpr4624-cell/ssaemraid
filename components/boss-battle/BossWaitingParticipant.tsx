'use client';

import { AvatarRenderer } from '@/components/avatar/AvatarRenderer';
import type { Student } from '@/lib/types';

interface BossWaitingParticipantProps {
  student: Student;
  label: string;
  isSelf?: boolean;
  scale?: number;
}

/**
 * 보스전 대기실 참가자 표시.
 * 아바타와 이름표를 같은 160px 기준 슬롯에 두되, 실제 스프라이트의
 * 시각적 중심이 캔버스 중앙보다 왼쪽에 있는 점을 고려해 이름표의 기준점을
 * 명시적인 px 좌표로 고정합니다. Tailwind 동적 클래스나 상속 transform에
 * 의존하지 않으므로 배포 빌드에서도 같은 위치가 적용됩니다.
 */
export function BossWaitingParticipant({
  student,
  label,
  isSelf = false,
  scale = 1,
}: BossWaitingParticipantProps) {
  return (
    <div
      className={`relative text-center ${
        isSelf ? 'drop-shadow-[0_0_12px_gold]' : ''
      }`}
      style={{ width: 160 * scale, height: 194 * scale }}
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})`, width: 160, height: 194 }}>
      <div className="absolute left-0 top-0 h-[160px] w-[160px] overflow-visible">
        <div
          className="absolute left-0 top-0 h-[200px] w-[200px] origin-top-left"
          style={{ transform: 'scale(0.8)' }}
        >
          <AvatarRenderer
            avatarState={student.avatarState || { skinColor: '#FFE0BD', equipped: {} }}
            inventory={student.items}
            size="sprite"
            facing="front"
            showAnimation={false}
            useSprite={true}
          />
        </div>
      </div>

      <div
        className="absolute w-[96px] truncate rounded border border-amber-300 bg-slate-900/90 px-1 text-[11px] leading-5 text-white"
        style={{
          left: 'calc(50% - 14px)',
          top: '169px',
          transform: 'translateX(-50%)',
          zIndex: 100,
        }}
      >
        {label}
      </div>
      </div>
    </div>
  );
}
