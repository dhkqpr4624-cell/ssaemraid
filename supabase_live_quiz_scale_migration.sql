-- 실시간 퀴즈 대규모 참여 안정화용 보조 테이블
-- Supabase SQL Editor에서 한 번 실행하면 됩니다. 이미 있으면 그대로 유지됩니다.

create table if not exists public.live_session_participants (
  class_code text not null,
  quiz_id text not null,
  attendance_number text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (class_code, quiz_id, attendance_number)
);

create index if not exists idx_live_session_participants_lookup
  on public.live_session_participants (class_code, quiz_id, last_seen_at desc);

create table if not exists public.live_session_answers (
  class_code text not null,
  quiz_id text not null,
  question_index integer not null,
  attendance_number text not null,
  answer jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (class_code, quiz_id, question_index, attendance_number)
);

create index if not exists idx_live_session_answers_lookup
  on public.live_session_answers (class_code, quiz_id, question_index);

alter table public.live_session_participants enable row level security;
alter table public.live_session_answers enable row level security;

-- 기존 프로젝트가 익명 클라이언트에서 직접 읽기/쓰기를 사용하므로, 같은 방식으로 허용합니다.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='live_session_participants' and policyname='Allow anon access live_session_participants') then
    create policy "Allow anon access live_session_participants" on public.live_session_participants for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='live_session_answers' and policyname='Allow anon access live_session_answers') then
    create policy "Allow anon access live_session_answers" on public.live_session_answers for all using (true) with check (true);
  end if;
end $$;
