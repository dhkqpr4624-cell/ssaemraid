# Supabase 과부하 코드 점검 결과

핵심 원인은 학생 heartbeat 변경을 모든 학생 클라이언트가 Realtime으로 구독한 뒤, 각 이벤트마다 세션/참가자/게스트/답안을 다시 조회하는 구조였습니다.

학생 40명이 15초마다 heartbeat를 보내면 15초마다 40개의 참가자 UPDATE가 발생하고, 이 UPDATE를 40명 모두가 받아 전체 poll을 다시 수행하므로 요청량이 O(N²)로 증가할 수 있었습니다.

이번 패치:
- 학생 Realtime에서 participants/answers 구독 제거
- 교사 Realtime에서 participants 구독 제거
- 학생 poll 3초 → 8초, heartbeat 15초 → 30초
- 교사 poll 2.5초 → 5초
- hidden 탭에서 poll/heartbeat 중지
- poll 중복 실행 방지
- Realtime debounce 80ms → 700ms
- 결과 화면 poll 0.8초 → 3초

DB가 정상화된 뒤 `SUPABASE_LOAD_RECOVERY_AND_CLEANUP.sql`을 1회 실행하세요.
