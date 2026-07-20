# 스쿨레이드 레이어·법전 포즈·대기실 설정 반영 패치

## 수정 파일
1. `components/avatar/AvatarRenderer.tsx`
   - 기본 아바타 레이어 순서를 명시적으로 재배치했습니다.
   - 기본 몸통 → 하의 → 망토 back → 상의 몸통 → 기본 오른팔 → 기본 왼팔 → 상의 왼팔 → 상의 오른팔 → 눈/입/눈썹 → 얼굴장식 → 머리카락 → 장신구 → 머리장식 → 펫 순서입니다.
   - `capeLayerPosition: 'front'`, 법 수호자 망토의 back/medium/front 분할, 모자 착용 시 upper hair 숨김 등 기존 아이템별 고유 규칙은 유지했습니다.
   - 이미 학생 인벤토리에 저장된 예전 법전 데이터가 `twoHanded`를 포함해도 법전만은 기본 팔 자세를 사용하도록 예외 처리했습니다.

2. `lib/reward-folder-items.ts`
   - 법전의 `rightArmPose`, `leftArmPose`를 `default`로 변경했습니다.
   - 법전의 양손 팔 이미지 강제 지정도 제거했습니다.

3. `app/teacher/boss-battle/page.tsx`
   - 방 생성 후 문제 수/제한시간 입력란에서 포커스가 빠질 때 대기 중 세션에 저장합니다.
   - 문제 수를 줄이면 기존 문제를 앞에서부터 유지해 줄이고, 늘리면 아직 선택되지 않은 문제를 무작위로 보충합니다.
   - 변경된 문제 수에 맞춰 라운드 계획과 대기 중 보스 최대 체력도 다시 계산합니다.
   - 사용자가 입력 직후 바로 `토벌전 시작`을 눌러도 시작 직전에 설정을 한 번 더 저장하므로 최신 값이 적용됩니다.

## GitHub 업로드
전체 수정본을 업로드해도 됩니다. 최소 업로드 시에는 아래 3개 파일만 기존 경로 그대로 덮어쓰면 됩니다.
- `components/avatar/AvatarRenderer.tsx`
- `lib/reward-folder-items.ts`
- `app/teacher/boss-battle/page.tsx`

## Supabase
추가 SQL 실행이나 테이블 변경은 필요하지 않습니다. 기존 `boss_battle_sessions`의 `question_count`, `time_limit_seconds`, `session_data` 필드를 그대로 사용합니다.
