# 태블릿 전투 화면 및 음소거 초기값 패치

## 변경 내용

- revision 13에서 정상 작동하던 1500×864 전투 캔버스 전체 등비 축소 방식을 복원했습니다.
- 태블릿에서 보스 스프라이트를 전투 캔버스 전체 폭의 flex 중앙 정렬로 배치하도록 복원했습니다.
- 태블릿 전투 캔버스의 위치 계산을 revision 13 방식으로 되돌렸습니다.
- 교사 보스전 화면은 최초 기본값이 음소거 해제입니다.
- 학생 보스전 화면은 최초 기본값이 음소거입니다.
- 교사와 학생의 음소거 선택은 서로 다른 localStorage 키에 저장됩니다.

## GitHub 업로드 파일

- components/boss-battle/BossBattleArena.tsx
- components/boss-battle/BossBattleBgm.tsx
- components/boss-battle/BossWaitingRoomBgm.tsx
- lib/boss-audio.ts
- app/student/boss-battle/page.tsx
- app/teacher/boss-battle/page.tsx

## Supabase

이번 패치는 화면 레이아웃과 클라이언트 오디오 초기값만 수정하므로 Supabase에서 실행할 SQL은 없습니다.
