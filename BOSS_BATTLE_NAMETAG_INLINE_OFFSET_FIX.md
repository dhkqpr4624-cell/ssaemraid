# 보스전 대기실 닉네임 위치 수정

## 원인
이전 수정은 Tailwind의 임의 음수 위치 클래스(`left-[-10px]`)와 여백 클래스에 의존했습니다.
배포 환경의 Tailwind 빌드/캐시 상태에 따라 해당 임의 클래스가 CSS에 포함되지 않으면 화면에서 변화가 나타나지 않을 수 있습니다.

## 수정
`BossWaitingParticipant.tsx`의 닉네임 바에 인라인 transform을 적용했습니다.

- 왼쪽: 20px
- 아래: 10px

인라인 스타일은 Tailwind CSS 생성 여부와 관계없이 브라우저에 직접 적용됩니다.

## GitHub 업로드
components/boss-battle/BossWaitingParticipant.tsx

## Supabase
추가 작업 없음
