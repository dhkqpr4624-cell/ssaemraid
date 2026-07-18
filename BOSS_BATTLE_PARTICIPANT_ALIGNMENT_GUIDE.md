# 보스전 대기실 아바타·이름표 정렬 수정

## 수정 이유

`AvatarRenderer`의 sprite 모드는 실제 200×200px 캔버스를 반환합니다. 기존 보스전 대기실에서는 이를 160×160px 래퍼 안에 넣은 뒤 `translateX(-64px)` 같은 개별 오프셋으로 위치를 맞추고 있어, 아바타와 이름표의 기준축이 서로 달라졌습니다.

## 수정 방식

새 공통 컴포넌트 `components/boss-battle/BossWaitingParticipant.tsx`를 추가했습니다.

- 200×200 아바타 캔버스를 0.8배로 축소하여 정확히 160×160으로 표시
- 아바타와 이름표를 하나의 `flex flex-col items-center` 컨테이너에 배치
- 이름표는 동일한 160px 중심축을 기준으로 정렬
- 교사 대기실과 학생 대기실에서 같은 컴포넌트를 재사용
- 기존의 임의 `translateX(-64px)`, `margin-left` 위치 보정 제거

## GitHub 업로드 파일

```text
components/boss-battle/BossWaitingParticipant.tsx
app/teacher/boss-battle/page.tsx
app/student/boss-battle/page.tsx
```

## Supabase

추가 SQL 작업은 없습니다.


## 미세 조정
- 닉네임 바를 아바타 기준으로 왼쪽 10px, 아래쪽 8px 정도 이동했습니다.
- 아바타 위치와 참가자 슬롯 좌표는 변경하지 않았습니다.
