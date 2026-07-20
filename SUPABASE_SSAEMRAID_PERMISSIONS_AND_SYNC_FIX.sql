-- 스쿨레이드 방 생성/실시간 동기화 권한 복구 패치
-- Supabase SQL Editor에서 전체를 한 번 실행하세요.

begin;

-- PostgREST(anon/authenticated)가 테이블을 실제로 사용할 수 있도록 권한 부여
 grant usage on schema public to anon, authenticated;
 grant select, insert, update, delete on table public.boss_battle_sessions to anon, authenticated;
 grant select, insert, update, delete on table public.boss_battle_participants to anon, authenticated;
 grant select, insert, update, delete on table public.boss_battle_answers to anon, authenticated;
 grant select, insert, update, delete on table public.raid_guests to anon, authenticated;

alter table public.boss_battle_sessions enable row level security;
alter table public.boss_battle_participants enable row level security;
alter table public.boss_battle_answers enable row level security;
alter table public.raid_guests enable row level security;

drop policy if exists "ssaemraid sessions all" on public.boss_battle_sessions;
drop policy if exists boss_sessions_read on public.boss_battle_sessions;
drop policy if exists boss_sessions_write on public.boss_battle_sessions;
create policy "ssaemraid sessions all" on public.boss_battle_sessions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "ssaemraid participants all" on public.boss_battle_participants;
drop policy if exists boss_participants_read on public.boss_battle_participants;
drop policy if exists boss_participants_write on public.boss_battle_participants;
create policy "ssaemraid participants all" on public.boss_battle_participants
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "ssaemraid answers all" on public.boss_battle_answers;
drop policy if exists boss_answers_read on public.boss_battle_answers;
drop policy if exists boss_answers_write on public.boss_battle_answers;
create policy "ssaemraid answers all" on public.boss_battle_answers
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "ssaemraid guests all" on public.raid_guests;
create policy "ssaemraid guests all" on public.raid_guests
  for all to anon, authenticated using (true) with check (true);

alter table public.boss_battle_sessions replica identity full;
alter table public.boss_battle_participants replica identity full;
alter table public.boss_battle_answers replica identity full;
alter table public.raid_guests replica identity full;

-- 기존 함수 시그니처가 달라졌거나 누락된 경우까지 복구
create or replace function public.ssaemraid_heartbeat_participant(
  p_session_id uuid,
  p_class_code text,
  p_student_id uuid,
  p_attendance_number text,
  p_default_state jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.boss_battle_participants(
    session_id, class_code, student_id, attendance_number, last_seen_at, participant_data
  ) values (
    p_session_id, upper(p_class_code), p_student_id, p_attendance_number, now(), p_default_state
  )
  on conflict (session_id, student_id) do update
    set last_seen_at = excluded.last_seen_at,
        attendance_number = excluded.attendance_number,
        class_code = excluded.class_code;
end;
$$;

grant execute on function public.ssaemraid_heartbeat_participant(uuid,text,uuid,text,jsonb) to anon, authenticated;

create or replace function public.ssaemraid_patch_participant_state(
  p_session_id uuid,
  p_student_id uuid,
  p_patch jsonb
) returns void
language sql security definer set search_path = public
as $$
  update public.boss_battle_participants
  set participant_data = coalesce(participant_data, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
  where session_id = p_session_id and student_id = p_student_id;
$$;

grant execute on function public.ssaemraid_patch_participant_state(uuid,uuid,jsonb) to anon, authenticated;

commit;

-- Realtime publication 등록(이미 등록되어 있으면 무시)
do $$ begin alter publication supabase_realtime add table public.boss_battle_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.boss_battle_participants; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.boss_battle_answers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.raid_guests; exception when duplicate_object then null; end $$;
