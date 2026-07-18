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
