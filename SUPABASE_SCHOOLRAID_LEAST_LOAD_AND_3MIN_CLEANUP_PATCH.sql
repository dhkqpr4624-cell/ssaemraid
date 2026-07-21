-- SchoolRaid 3서버 최소부하 배정 + 분리형 교사 heartbeat + 3분 자동 정리 패치
-- 중요: SERVER 1, SERVER 2, SERVER 3의 SQL Editor에서 각각 1회 실행하세요.

-- 1) 게임 세션과 별도로 관리되는 가벼운 교사 heartbeat(lease) 테이블입니다.
-- 이 테이블은 학생/교사 게임 화면에서 Realtime 구독하지 않습니다.
create table if not exists public.boss_battle_room_leases (
  class_code text primary key,
  session_id uuid not null,
  teacher_last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint boss_battle_room_leases_code_check
    check (class_code ~ '^[ABC]-[A-Z2-9]{5}$')
);

create index if not exists boss_battle_room_leases_last_seen_idx
  on public.boss_battle_room_leases (teacher_last_seen_at);

alter table public.boss_battle_room_leases enable row level security;

-- 직접 테이블 쓰기 대신 아래 SECURITY DEFINER RPC만 사용합니다.
revoke all on public.boss_battle_room_leases from anon, authenticated;

-- 2) 교사 탭이 살아 있는 동안 45초마다 호출되는 heartbeat입니다.
create or replace function public.ssaemraid_touch_room_lease(
  p_class_code text,
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_class_code));
begin
  if v_code !~ '^[ABC]-[A-Z2-9]{5}$' then
    raise exception 'invalid SchoolRaid room code: %', v_code;
  end if;

  if not exists (
    select 1
    from public.boss_battle_sessions
    where id = p_session_id and class_code = v_code and status <> 'ended'
  ) then
    raise exception 'active SchoolRaid session not found: %', v_code;
  end if;

  insert into public.boss_battle_room_leases(class_code, session_id, teacher_last_seen_at)
  values (v_code, p_session_id, now())
  on conflict (class_code) do update
    set session_id = excluded.session_id,
        teacher_last_seen_at = excluded.teacher_last_seen_at;
end;
$$;

grant execute on function public.ssaemraid_touch_room_lease(text, uuid) to anon, authenticated;

-- 3) 로드밸런서가 현재 서버의 활성 방 수를 확인할 때 사용합니다.
-- 방이 막 생성되어 첫 heartbeat 전인 짧은 구간도 created_at 기준으로 활성 방에 포함합니다.
create or replace function public.ssaemraid_active_room_count(
  p_active_within interval default interval '3 minutes'
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.boss_battle_sessions s
  where s.status <> 'ended'
    and (
      s.created_at >= now() - p_active_within
      or exists (
        select 1
        from public.boss_battle_room_leases l
        where l.class_code = s.class_code
          and l.session_id = s.id
          and l.teacher_last_seen_at >= now() - p_active_within
      )
    );
$$;

grant execute on function public.ssaemraid_active_room_count(interval) to anon, authenticated;

-- 4) 방 코드 하나를 기준으로 관련 데이터를 즉시 삭제합니다.
create or replace function public.ssaemraid_delete_room(p_class_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_class_code));
begin
  if v_code !~ '^[ABC]-[A-Z2-9]{5}$' then
    raise exception 'invalid SchoolRaid room code: %', v_code;
  end if;

  delete from public.boss_battle_room_leases where class_code = v_code;
  delete from public.raid_guests where room_code = v_code;
  -- 기존 스키마의 FK가 CASCADE라면 participant/answer도 함께 삭제됩니다.
  -- CASCADE가 없더라도 안전하도록 먼저 직접 삭제합니다.
  delete from public.boss_battle_answers
    where session_id in (select id from public.boss_battle_sessions where class_code = v_code);
  delete from public.boss_battle_participants
    where session_id in (select id from public.boss_battle_sessions where class_code = v_code);
  delete from public.boss_battle_sessions where class_code = v_code;
end;
$$;

grant execute on function public.ssaemraid_delete_room(text) to anon, authenticated;

-- 5) heartbeat가 3분 이상 멈춘 방과, lease 생성 전 비정상 종료된 오래된 방을 정리합니다.
create or replace function public.ssaemraid_cleanup_stale_rooms(
  p_stale_after interval default interval '3 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_count integer := 0;
begin
  for v_code in
    select distinct s.class_code
    from public.boss_battle_sessions s
    left join public.boss_battle_room_leases l
      on l.class_code = s.class_code and l.session_id = s.id
    where
      (l.class_code is not null and l.teacher_last_seen_at < now() - p_stale_after)
      or
      (l.class_code is null and s.created_at < now() - p_stale_after)
  loop
    perform public.ssaemraid_delete_room(v_code);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.ssaemraid_cleanup_stale_rooms(interval) to anon, authenticated;

-- 6) 현재 이미 남아 있는 오래된 방을 즉시 1회 정리합니다.
-- 이번 SQL을 실행하는 시점에 3분보다 오래된 기존 세션은 정리됩니다.
select public.ssaemraid_cleanup_stale_rooms(interval '3 minutes');

-- 7) 이후 매분 자동으로 검사합니다. 실제 삭제는 마지막 heartbeat 후 약 3~4분 사이입니다.
create extension if not exists pg_cron;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'schoolraid-cleanup-stale-rooms'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end $$;

select cron.schedule(
  'schoolraid-cleanup-stale-rooms',
  '* * * * *',
  $cron$select public.ssaemraid_cleanup_stale_rooms(interval '3 minutes');$cron$
);
