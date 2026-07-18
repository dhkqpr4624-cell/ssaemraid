-- 보스전 1차(대기실) 테이블 및 다중 학생 참가 안정화 패치
create table if not exists public.boss_battle_sessions (
  id uuid primary key default gen_random_uuid(),
  class_code text not null,
  status text not null default 'waiting',
  boss_id text not null,
  boss_name text not null,
  question_count integer not null default 10 check (question_count between 1 and 50),
  time_limit_seconds integer not null default 20 check (time_limit_seconds between 5 and 180),
  boss_max_hp integer not null default 100,
  boss_hp integer not null default 100,
  session_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_boss_battle_sessions_class_status on public.boss_battle_sessions(class_code,status,created_at desc);

create table if not exists public.boss_battle_participants (
  session_id uuid not null references public.boss_battle_sessions(id) on delete cascade,
  class_code text not null,
  attendance_number text not null,
  student_id text,
  last_seen_at timestamptz not null default now()
);
alter table public.boss_battle_participants add column if not exists student_id text;
update public.boss_battle_participants set student_id = class_code || ':' || attendance_number where student_id is null or student_id = '';
alter table public.boss_battle_participants alter column student_id set not null;
alter table public.boss_battle_participants drop constraint if exists boss_battle_participants_pkey;
alter table public.boss_battle_participants add primary key(session_id, student_id);
create index if not exists idx_boss_participants_active on public.boss_battle_participants(session_id,last_seen_at desc);
create index if not exists idx_boss_participants_attendance on public.boss_battle_participants(session_id,attendance_number);

alter table public.boss_battle_sessions enable row level security;
alter table public.boss_battle_participants enable row level security;
drop policy if exists boss_sessions_read on public.boss_battle_sessions;
drop policy if exists boss_sessions_write on public.boss_battle_sessions;
drop policy if exists boss_participants_read on public.boss_battle_participants;
drop policy if exists boss_participants_write on public.boss_battle_participants;
create policy boss_sessions_read on public.boss_battle_sessions for select using (true);
create policy boss_sessions_write on public.boss_battle_sessions for all using (true) with check (true);
create policy boss_participants_read on public.boss_battle_participants for select using (true);
create policy boss_participants_write on public.boss_battle_participants for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.boss_battle_sessions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.boss_battle_participants;
exception when duplicate_object then null; end $$;

-- 보스전 2·3차: 전투 상태/답안/RPS 저장 확장
alter table public.boss_battle_participants add column if not exists participant_data jsonb not null default '{"hp":100,"maxHp":100,"totalDamage":0,"correctCount":0,"attackCorrectCount":0,"defenseSuccessCount":0,"knockedOut":false,"reviveProgress":0,"reviveCount":0,"lastDamage":0}'::jsonb;

create table if not exists public.boss_battle_answers (
  session_id uuid not null references public.boss_battle_sessions(id) on delete cascade,
  class_code text not null,
  round_index integer not null,
  student_id text not null,
  attendance_number text not null,
  answer_data jsonb not null default '{}'::jsonb,
  is_correct boolean,
  rps_choice text,
  submitted_at timestamptz not null default now(),
  primary key(session_id, round_index, student_id)
);
create index if not exists idx_boss_answers_round on public.boss_battle_answers(session_id, round_index, submitted_at);
alter table public.boss_battle_answers enable row level security;
drop policy if exists boss_answers_read on public.boss_battle_answers;
drop policy if exists boss_answers_write on public.boss_battle_answers;
create policy boss_answers_read on public.boss_battle_answers for select using (true);
create policy boss_answers_write on public.boss_battle_answers for all using (true) with check (true);
do $$ begin
  alter publication supabase_realtime add table public.boss_battle_answers;
exception when duplicate_object then null; end $$;
