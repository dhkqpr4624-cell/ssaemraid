create extension if not exists pgcrypto;
create table if not exists public.boss_battle_sessions (
  id uuid primary key default gen_random_uuid(), class_code text not null, status text not null default 'waiting',
  boss_id text not null, boss_name text not null, question_count integer not null default 10,
  time_limit_seconds integer not null default 20, boss_max_hp integer not null default 100, boss_hp integer not null default 100,
  session_data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists boss_battle_sessions_code_idx on public.boss_battle_sessions(class_code, created_at desc);
create table if not exists public.boss_battle_participants (
  session_id uuid not null references public.boss_battle_sessions(id) on delete cascade, class_code text not null,
  student_id uuid not null, attendance_number text not null, last_seen_at timestamptz not null default now(), participant_data jsonb not null default '{}'::jsonb,
  primary key(session_id,student_id)
);
create table if not exists public.boss_battle_answers (
  session_id uuid not null references public.boss_battle_sessions(id) on delete cascade, class_code text not null,
  round_index integer not null, student_id uuid not null, attendance_number text not null, answer_data jsonb,
  is_correct boolean, rps_choice text, submitted_at timestamptz not null default now(), primary key(session_id,round_index,student_id)
);
create table if not exists public.raid_guests (
  id uuid primary key default gen_random_uuid(), room_code text not null, nickname text not null,
  join_order integer not null, avatar_state jsonb not null default '{}'::jsonb, items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(room_code,join_order)
);
create index if not exists raid_guests_room_idx on public.raid_guests(room_code,join_order);
alter table public.boss_battle_sessions enable row level security;
alter table public.boss_battle_participants enable row level security;
alter table public.boss_battle_answers enable row level security;
alter table public.raid_guests enable row level security;
do $$ begin
  create policy "ssaemraid sessions all" on public.boss_battle_sessions for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "ssaemraid participants all" on public.boss_battle_participants for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "ssaemraid answers all" on public.boss_battle_answers for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "ssaemraid guests all" on public.raid_guests for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 스쿨 레이드 40인 안정화 패치
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

do $$
begin
  alter publication supabase_realtime add table public.boss_battle_sessions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.boss_battle_participants;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.boss_battle_answers;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.raid_guests;
exception when duplicate_object then null;
end $$;
