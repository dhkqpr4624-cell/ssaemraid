-- 스쿨레이드 과부하 복구 후 1회 실행용
-- 주의: DB가 정상 응답(select now())을 회복한 뒤 실행하세요.

-- 1) 오래된 종료/대기 세션과 연결 데이터 정리
-- 최근 7일 데이터는 보존합니다.
delete from public.boss_battle_sessions
where created_at < now() - interval '7 days';

-- 2) 핵심 조회 인덱스 보장
create index if not exists boss_battle_sessions_active_code_idx
  on public.boss_battle_sessions(class_code, status, created_at desc);
create index if not exists boss_battle_participants_active_idx
  on public.boss_battle_participants(session_id, last_seen_at desc);
create index if not exists boss_battle_answers_round_idx
  on public.boss_battle_answers(session_id, round_index, submitted_at);
create index if not exists raid_guests_room_idx
  on public.raid_guests(room_code, join_order);

-- 3) 통계 갱신
analyze public.boss_battle_sessions;
analyze public.boss_battle_participants;
analyze public.boss_battle_answers;
analyze public.raid_guests;
