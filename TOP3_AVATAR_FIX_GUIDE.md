# TOP 3 아바타 표시 수정

## 원인
전투 결과 스냅샷에는 학생의 `avatarState`만 저장되고, 장착 아이템을 렌더링하는 데 필요한 `items`가 저장되지 않았습니다. 또한 TOP 3 카드의 200px 스프라이트를 96px 영역 안에서 축소하는 기준점이 잘못되어 일부가 잘려 보일 수 있었습니다.

## 수정 내용
- 결과 스냅샷에 학생 아이템 목록(`items`) 저장
- 결과 화면에서 스냅샷 아이템으로 아바타 전체 파츠 복원
- 아직 방에 남아 있는 학생은 기존 실시간 데이터의 아이템을 보조값으로 사용
- TOP 3 카드 안에 96x96 고정 뷰포트를 만들고 200x200 아바타를 중앙 기준으로 0.48배 축소

## GitHub 업로드 파일
- `lib/boss-battle.ts`
- `app/teacher/boss-battle/page.tsx`
- `components/boss-battle/BossBattleArena.tsx`

## Supabase
실행할 SQL이 없습니다. 기존 `session_data` JSON 내부에 필드가 추가되는 방식이므로 테이블 변경이 필요하지 않습니다.
