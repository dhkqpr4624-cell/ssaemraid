# SchoolRaid Supabase 3서버 분산 패치

## 실제 분산 범위

새 보스전 방 코드는 다음 형식입니다.

- `A-XXXXX` → SERVER 1
- `B-XXXXX` → SERVER 2
- `C-XXXXX` → SERVER 3

아래 데이터는 방 코드에 따라 실제로 서로 다른 Supabase 프로젝트에 저장됩니다.

- `boss_battle_sessions`
- `boss_battle_participants`
- `boss_battle_answers`
- `raid_guests`
- 위 테이블의 Realtime 채널과 RPC

기존 6자리 방 코드는 호환을 위해 SERVER 1로 연결됩니다.

## 디버깅

교사 보스전 화면과 학생 입장/보스전 화면 오른쪽 아래에 다음 배지가 표시됩니다.

`SERVER 2 · abcdefghijklmnop`

- SERVER 번호: 방 코드가 연결된 서버
- 뒤 문자열: Supabase URL의 project ref
- `ENV 없음`: 해당 서버 환경 변수가 배포에 설정되지 않음

브라우저 개발자 도구 Console에도 `[SchoolRaid Shard]` 로그가 출력됩니다.

## Supabase: 신규 프로젝트 2곳에서 실행

각 신규 프로젝트의 SQL Editor에서 다음 두 파일을 순서대로 실행합니다.

1. `SUPABASE_SSAEMRAID_SETUP.sql`
2. `SUPABASE_SCHOOLRAID_40_PLAYER_JOIN_STABILITY_PATCH.sql`

두 SQL 모두 성공해야 합니다. 기존 SERVER 1은 이미 같은 구조라면 다시 실행하지 않아도 됩니다. 구조가 확실하지 않으면 두 파일을 같은 순서로 다시 실행해도 대부분 `if not exists` / `create or replace` 방식으로 안전하게 보정됩니다.

## Vercel 환경 변수

Vercel 프로젝트 → Settings → Environment Variables에 다음 6개를 등록합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL_2`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_2`
- `NEXT_PUBLIC_SUPABASE_URL_3`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_3`

각 변수는 Production, Preview, Development에 적용하는 것을 권장합니다.

변수 등록 후 반드시 새 배포를 실행합니다. 기존 배포는 새 환경 변수를 자동으로 반영하지 않습니다.

## GitHub 업로드

패치 ZIP의 폴더 구조를 유지하여 저장소 루트에 덮어씁니다. 업로드 대상은 다음과 같습니다.

- `lib/supabase-shards.ts`
- `lib/boss-battle.ts`
- `lib/raid-guests.ts`
- `components/debug/SupabaseShardBadge.tsx`
- `app/teacher/page.tsx`
- `app/teacher/boss-battle/page.tsx`
- `app/student/page.tsx`
- `app/student/boss-battle/page.tsx`
- `.env.shards.example`
- 본 안내서
- SQL 2개

실제 URL과 anon key를 GitHub 파일에 직접 적지 마세요. Vercel 환경 변수에만 입력합니다.

## 동작 확인

1. 교사 시작 화면에서 `서버 분산 상태: 3/3개 연결됨` 확인
2. 방을 여러 번 새로 생성하여 A/B/C 방 코드가 모두 나오는지 확인
3. 교사 화면 오른쪽 아래 SERVER 번호와 project ref 확인
4. 학생이 같은 방 코드로 입장했을 때 동일한 SERVER 번호/project ref인지 확인
5. 각 Supabase 프로젝트의 Table Editor에서 해당 접두사의 방 데이터가 그 프로젝트에만 생성되는지 확인
   - A 방은 SERVER 1
   - B 방은 SERVER 2
   - C 방은 SERVER 3

무작위 배정이므로 방 3개만 만들었을 때 A/B/C가 정확히 한 번씩 나오지는 않을 수 있습니다. 10~20개 테스트하면 대체로 분산 여부를 확인할 수 있습니다.

## 주의 사항

- 세 프로젝트의 SQL 구조와 RPC가 항상 같아야 합니다.
- 이후 DB 구조를 바꾸는 SQL 패치는 세 프로젝트 모두에 실행해야 합니다.
- 공유 퀴즈 관리자 API 등 기존 일반 기능은 SERVER 1 환경 변수를 계속 사용합니다. 이번 패치는 SchoolRaid 보스전 실시간 데이터만 3개 프로젝트로 분산합니다.
