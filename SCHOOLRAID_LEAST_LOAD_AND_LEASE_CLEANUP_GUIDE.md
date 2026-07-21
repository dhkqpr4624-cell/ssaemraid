# SchoolRaid 최소부하 서버 선택 + 분리형 heartbeat + 3분 정리 패치

## 핵심 변경

1. 접두사 없는 기존 6자리 방 코드는 더 이상 허용하지 않습니다. `A-XXXXX`, `B-XXXXX`, `C-XXXXX`만 사용합니다.
2. 브라우저별 Round Robin을 제거했습니다. 방 생성 시 Vercel API가 세 Supabase 프로젝트의 활성 방 수를 동시에 조회하고 가장 적은 서버를 선택합니다. 동률이면 동률 서버 중 무작위 선택합니다.
3. 교사 heartbeat는 `boss_battle_sessions.updated_at`을 건드리지 않고 별도 `boss_battle_room_leases` 테이블만 45초마다 갱신합니다. 따라서 heartbeat만으로 학생/교사 게임 화면의 세션 Realtime 갱신이나 전체 재조회가 발생하지 않습니다.
4. 교사가 처음으로 이동하거나 탭/브라우저를 닫을 때 cleanup API를 즉시 호출합니다. 요청이 누락되면 마지막 heartbeat 후 약 3~4분 사이에 pg_cron이 자동 삭제합니다.
5. SQL 실행 시 현재 이미 남아 있는 3분 초과 세션도 즉시 한 번 정리합니다.

## GitHub 업로드

패치 ZIP의 폴더 구조를 저장소 루트에 그대로 덮어씁니다.

- `app/api/boss-battle/cleanup/route.ts`
- `app/api/boss-battle/select-server/route.ts`
- `app/teacher/page.tsx`
- `app/teacher/boss-battle/page.tsx`
- `lib/boss-battle.ts`
- `lib/supabase-shards.ts`

## Supabase

세 프로젝트의 SQL Editor에서 각각 다음 파일 전체를 실행합니다.

`SUPABASE_SCHOOLRAID_LEAST_LOAD_AND_3MIN_CLEANUP_PATCH.sql`

이 SQL은 다음을 추가합니다.

- `boss_battle_room_leases`
- `ssaemraid_touch_room_lease`
- `ssaemraid_active_room_count`
- `ssaemraid_delete_room`
- `ssaemraid_cleanup_stale_rooms`
- 매분 실행되는 `schoolraid-cleanup-stale-rooms` cron job

기존에 남은 오래된 데이터도 SQL 실행 시 정리됩니다.

## Vercel

새 환경 변수는 없습니다. 기존 6개 변수를 그대로 사용합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL_2`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_2`
- `NEXT_PUBLIC_SUPABASE_URL_3`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_3`

GitHub 반영 후 새 배포가 완료되는지 확인합니다.

## 확인 방법

### 최소부하 배정 로그

Vercel Function 로그 또는 브라우저 Console에서 아래 형태를 확인합니다.

`[SchoolRaid Load Balancer] selected SERVER 2 { activeRooms: ... }`

응답의 `activeRooms`에는 서버별 활성 방 수가 표시됩니다.

### heartbeat 분리 확인

`boss_battle_room_leases`의 `teacher_last_seen_at`은 약 45초마다 바뀌지만, `boss_battle_sessions.updated_at`은 heartbeat 때문에 바뀌지 않아야 합니다.

### cron 확인

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'schoolraid-cleanup-stale-rooms';
```

### 활성 방 수 직접 확인

```sql
select public.ssaemraid_active_room_count(interval '3 minutes');
```

### 오래된 데이터 수동 정리

```sql
select public.ssaemraid_cleanup_stale_rooms(interval '3 minutes');
```
