# 쌤퀘스트 (SAMQUEST) 배포 가이드

이 문서는 쌤퀘스트 서비스를 Vercel과 Supabase를 사용하여 배포하는 방법을 설명합니다.

## 1. Supabase 설정

### 프로젝트 생성
1. [Supabase](https://supabase.com/)에서 새 프로젝트를 생성합니다.
2. `Project Settings > API`에서 `URL`과 `anon public` 키를 복사해 둡니다.

### 데이터베이스 스키마 설정
1. Supabase 대시보드의 `SQL Editor`로 이동합니다.
2. `supabase_schema.sql` 파일의 내용을 복사하여 붙여넣고 실행합니다.
   - 이 스크립트는 `classes`, `students`, `quizzes`, `quiz_results`, `live_sessions` 테이블을 생성합니다.
   - 실시간 동기화를 위한 Row Level Security(RLS) 정책도 함께 설정됩니다.

### 실시간(Realtime) 활성화
1. `Database > Replication` 메뉴로 이동합니다.
2. `supabase_realtime` 게시물(Publication)의 `Source tables`에서 다음 테이블들을 선택합니다:
   - `live_sessions`
   - `students` (학생 위치/상태 실시간 공유용)

## 2. Vercel 배포

### 프로젝트 연결
1. GitHub 등에 코드를 푸시합니다.
2. [Vercel](https://vercel.com/)에서 `Add New > Project`를 선택하고 해당 저장소를 연결합니다.

### 환경 변수 설정
Vercel 프로젝트 설정의 `Environment Variables` 섹션에 다음 항목을 추가합니다:

| 이름 | 값 |
|------|----|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 |

### 빌드 및 배포
1. `Deploy` 버튼을 클릭합니다.
2. 빌드가 완료되면 제공된 URL로 접속하여 서비스를 확인합니다.

## 3. 로컬 개발 환경 설정

1. `.env.example` 파일을 `.env.local`로 복사합니다.
2. 실제 Supabase 정보를 입력합니다.
3. 의존성을 설치하고 서버를 실행합니다:
   ```bash
   pnpm install
   pnpm dev
   ```

## 4. 주의 사항
- **개인정보 보호**: 이 서비스는 학생의 개인정보(이메일, 전화번호 등)를 수집하지 않도록 설계되었습니다.
- **클래스 코드**: 클래스 코드는 6자리 영문/숫자 조합으로 생성되며, 선생님 비밀번호와 함께 클래스를 식별합니다.
- **실시간 기능**: 실시간 퀴즈 기능은 Supabase Realtime을 사용하므로, Supabase 프로젝트 설정에서 Realtime이 활성화되어 있어야 합니다.
