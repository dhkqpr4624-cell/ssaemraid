-- 기존 스쿨 레이드 Supabase 프로젝트에 실행할 3차 수정 SQL
create index if not exists boss_battle_participants_active_idx
  on public.boss_battle_participants(session_id, last_seen_at desc);
create index if not exists boss_battle_answers_round_idx
  on public.boss_battle_answers(session_id, round_index, submitted_at);
create index if not exists boss_battle_sessions_active_code_idx
  on public.boss_battle_sessions(class_code, status, created_at desc);

create or replace function public.ssaemraid_heartbeat_participant(
  p_session_id uuid,
  p_class_code text,
  p_student_id uuid,
  p_attendance_number text,
  p_default_state jsonb
) returns void
language plpgsql
security definer
set search_path = public
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
language sql
security definer
set search_path = public
as $$
  update public.boss_battle_participants
  set participant_data = coalesce(participant_data, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
  where session_id = p_session_id and student_id = p_student_id;
$$;

grant execute on function public.ssaemraid_patch_participant_state(uuid,uuid,jsonb) to anon, authenticated;

alter table public.boss_battle_sessions replica identity full;
alter table public.boss_battle_participants replica identity full;
alter table public.boss_battle_answers replica identity full;
alter table public.raid_guests replica identity full;

do $$ begin alter publication supabase_realtime add table public.boss_battle_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.boss_battle_participants; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.boss_battle_answers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.raid_guests; exception when duplicate_object then null; end $$;
