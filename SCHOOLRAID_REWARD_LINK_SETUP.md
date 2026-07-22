# 쌤퀘스트 보상 연동 적용

스쿨레이드 Vercel 환경 변수에 다음 값을 추가한 뒤 재배포합니다.

- `SSAEMQUEST_URL`: 실제 쌤퀘스트 주소 (예: `https://ssaemquest.vercel.app`)
- `SCHOOLRAID_REWARD_SECRET`: 쌤퀘스트 Vercel에 설정한 값과 완전히 같은 긴 임의 문자열

승리 시 `법 수호자 해태`, 도망 시 `해태의 눈물` 코드가 발급됩니다. 전멸 시에는 버튼이 나타나지 않습니다.
