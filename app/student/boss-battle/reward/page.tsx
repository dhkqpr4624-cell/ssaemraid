'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  getBossBattleSession,
  subscribeBossBattleRoom,
} from '@/lib/boss-battle';
import { normalizeRaidRoomCode } from '@/lib/supabase-shards';

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = normalizeRaidRoomCode(searchParams.get('code') || '');
  const outcome = searchParams.get('outcome');
  const checkInFlightRef = useRef(false);

  useEffect(() => {
    if (!code) {
      router.replace('/student');
      return;
    }

    let cancelled = false;

    const checkSession = async () => {
      if (cancelled || checkInFlightRef.current) return;
      checkInFlightRef.current = true;

      try {
        const session = await getBossBattleSession(code);
        if (cancelled) return;

        if (!session) {
          router.replace(`/student?code=${encodeURIComponent(code)}`);
          return;
        }

        if (session.status === 'waiting') {
          router.replace(`/student/boss-battle?code=${encodeURIComponent(code)}`);
        }
      } catch {
        // 일시적인 네트워크 오류는 다음 Realtime 이벤트 또는 안전 폴링에서 복구합니다.
      } finally {
        checkInFlightRef.current = false;
      }
    };

    void checkSession();

    // 정상 상황에서는 session Realtime 이벤트로 즉시 대기실 복귀를 감지합니다.
    const unsubscribe = subscribeBossBattleRoom(
      code,
      undefined,
      () => {
        void checkSession();
      },
      { participants: false, answers: false, guests: false },
    );

    // Realtime 누락/일시 끊김을 대비한 저빈도 안전 폴링입니다.
    const safetyPoll = window.setInterval(
      () => {
        void checkSession();
      },
      15000 + Math.floor(Math.random() * 5000),
    );

    const recover = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void checkSession();
      }
    };

    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recover);

    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(safetyPoll);
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [code, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
      <div className="max-w-lg rounded-2xl border-2 border-amber-400 bg-slate-900 p-8 text-center">
        <h1 className="text-4xl font-black">
          {outcome === 'defeated'
            ? '토벌 성공!'
            : outcome === 'escaped'
              ? '보스가 도주했습니다'
              : '전멸했습니다'}
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          스쿨 레이드는 단발성 보스전이므로 별도 보상은 지급되지 않습니다.
        </p>
        <p className="mt-2 text-amber-300">
          교사가 ‘대기실로’ 버튼을 누르면 자동으로 대기실로 돌아갑니다.
        </p>
        <Button className="mt-6" onClick={() => router.push('/')}>
          처음 화면으로
        </Button>
      </div>
    </main>
  );
}

export default function Result() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <ResultContent />
    </Suspense>
  );
}
