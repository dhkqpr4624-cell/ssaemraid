# 쌤퀘스트 공유 퀴즈 안정화/보안 패치 적용 안내

## 1. GitHub에 업로드할 파일

이번 패치에서 바뀐 파일은 아래입니다.

```text
lib/shared-quizzes.ts
app/teacher/quiz/explore/page.tsx
app/api/shared-quizzes/admin/route.ts
supabase/shared_quizzes.sql
SUPABASE_SHARED_QUIZ_SETUP.md
```

## 2. Supabase SQL 실행

Supabase → SQL Editor에서 아래 파일 내용을 다시 실행하세요.

```text
supabase/shared_quizzes.sql
```

기존 공유 퀴즈 데이터는 유지됩니다.

## 3. Vercel 환경 변수

기존 값은 유지합니다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SHARED_QUIZ_ADMIN_PASSWORD
```

관리자 강제 삭제/숨김을 더 안전하게 처리하려면 아래 2개도 추가하는 것을 권장합니다.

```text
SUPABASE_SERVICE_ROLE_KEY
SHARED_QUIZ_ADMIN_PASSWORD
```

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Project Settings → API → service_role key
- `SHARED_QUIZ_ADMIN_PASSWORD`: 관리자 비밀번호. 기존 `NEXT_PUBLIC_SHARED_QUIZ_ADMIN_PASSWORD`와 같은 값으로 넣어도 됩니다.

주의: `SUPABASE_SERVICE_ROLE_KEY`는 절대 GitHub 코드에 넣지 말고 Vercel Environment Variables에만 넣으세요.

## 4. 보안 변경 내용

이전에는 anon key로 테이블 update/delete가 열려 있어, UI를 우회하면 다른 선생님 퀴즈도 수정/삭제할 수 있었습니다.

이번 패치 후에는 다음처럼 동작합니다.

```text
일반 교사
- 자신이 이 브라우저에서 업로드한 퀴즈만 수정/삭제 가능
- 업로드 비밀번호를 아는 경우에도 수정/삭제 가능
- 다른 선생님 퀴즈는 수정/삭제 불가

관리자
- Ctrl + Alt + A로 관리자 모드 활성화
- 모든 공유 퀴즈 숨김/삭제 가능
```

## 5. 기존 퀴즈의 주의점

이번 패치 이후 새로 업로드되는 퀴즈에는 브라우저별 owner token이 저장됩니다. 따라서 같은 브라우저에서는 비밀번호 없이도 내 퀴즈로 인식됩니다.

패치 이전에 업로드된 퀴즈는 owner token이 없을 수 있습니다. 이 경우:

- 업로드 당시 비밀번호가 있으면 그 비밀번호로 수정/삭제 가능
- 비밀번호가 없고 owner token도 없으면 일반 교사는 수정/삭제 불가
- 관리자는 삭제/숨김 가능

## 6. 배포 후 확인

1. Vercel Redeploy
2. 퀴즈 탐색 페이지 접속
3. 새 퀴즈 업로드
4. 같은 브라우저에서 수정/삭제 버튼 표시 확인
5. 다른 브라우저/시크릿 창에서 수정/삭제 버튼이 보이지 않는지 확인
6. 관리자 모드에서 강제 삭제가 되는지 확인


## 안정화 보안 패치 안내

`supabase/shared_quizzes.sql`을 다시 실행하면 공유 퀴즈 목록 조회 권한 오류를 방지하기 위해 `SELECT/INSERT`만 허용하고 `UPDATE/DELETE`는 RPC 함수로만 처리되도록 구성됩니다.


## 2026 보안 보완 패치

이번 패치는 원본 `shared_quizzes` 테이블을 브라우저에서 직접 수정/삭제하지 못하게 하고, 목록/상세 조회는 `shared_quizzes_public` view를 통해서만 수행합니다. 업로드/수정/삭제/신고/다운로드 카운트 증가는 RPC 함수로 처리됩니다.

SQL 실행 후에도 기존 공유 퀴즈 데이터는 유지됩니다. 단, Vercel에는 아래 서버 환경변수가 있어야 관리자 강제 삭제/숨김이 정상 작동합니다.

- `SUPABASE_SERVICE_ROLE_KEY`
- `SHARED_QUIZ_ADMIN_PASSWORD`

