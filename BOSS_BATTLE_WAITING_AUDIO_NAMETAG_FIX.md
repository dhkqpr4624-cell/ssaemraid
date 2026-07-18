# 보스전 대기실 이름표·배경음악 수정

## 이름표
- 기존 transform/margin 기반 보정 제거
- 참가자 160px 슬롯 내부에서 이름표를 absolute 좌표로 배치
- 이름표 중심을 기존보다 왼쪽 28px, 아래쪽 14px가량 이동
- Tailwind 임의 클래스가 빌드에서 누락되는 문제를 피하기 위해 px 인라인 좌표 사용

## 배경음악
- `public/boss-battle/waiting-room-bgm.wav` 추가
- 교사·학생 대기실 진입 시 자동 재생 시도
- 브라우저 자동재생이 차단되면 첫 클릭/키 입력 시 재생
- 곡 종료 후 무작위 3~5초 대기 후 다시 재생
- 우측 상단에 음소거/음소거 해제 토글 버튼 추가

## GitHub 업로드
- components/boss-battle/BossWaitingParticipant.tsx
- components/boss-battle/BossWaitingRoomBgm.tsx
- app/student/boss-battle/page.tsx
- app/teacher/boss-battle/page.tsx
- public/boss-battle/waiting-room-bgm.wav

Supabase SQL 변경 없음.
