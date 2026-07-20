-- 스쿨레이드 40명 동시 입장 안정화 패치
-- 기존 초기 설정 SQL을 실행한 프로젝트에서 이 파일을 추가로 1회 실행하세요.

create or replace function public.ssaemraid_create_raid_guest(
  p_room_code text,
  p_nickname text,
  p_avatar_state jsonb,
  p_items jsonb
) returns public.raid_guests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_room_code));
  v_count integer;
  v_next_order integer;
  v_row public.raid_guests;
begin
  -- 같은 방의 동시 입장 요청을 아주 짧게 직렬화합니다.
  perform pg_advisory_xact_lock(hashtext('ssaemraid_guest:' || v_code));

  select count(*), coalesce(max(join_order), 0) + 1
    into v_count, v_next_order
  from public.raid_guests
  where room_code = v_code;

  if v_count >= 40 then
    raise exception '보스전에는 최대 40명까지 참여할 수 있습니다.';
  end if;

  insert into public.raid_guests(
    room_code, nickname, join_order, avatar_state, items
  ) values (
    v_code, trim(p_nickname), v_next_order,
    coalesce(p_avatar_state, '{}'::jsonb),
    coalesce(p_items, '[]'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.ssaemraid_create_raid_guest(text,text,jsonb,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
