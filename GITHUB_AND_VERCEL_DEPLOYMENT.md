# 쌤퀘스트(SAMQUEST) - GitHub 업로드 및 Vercel 배포 가이드

이 문서는 프로젝트를 GitHub에 업로드하고 Vercel에 배포하는 전체 과정을 단계별로 설명합니다.

---

## 📋 목차

1. [GitHub 업로드](#1-github-업로드)
2. [Vercel 배포](#2-vercel-배포)
3. [환경 변수 설정](#3-환경-변수-설정)
4. [배포 후 테스트](#4-배포-후-테스트)
5. [트러블슈팅](#5-트러블슈팅)

---

## 1. GitHub 업로드

### 1.1 웹 인터페이스를 통한 업로드 (권장)

GitHub 웹사이트에서 직접 파일을 업로드하는 방법입니다.

#### 단계 1: GitHub 저장소 접속
1. [GitHub](https://github.com/)에 로그인합니다.
2. 생성한 Private 저장소 `SSaemquest`로 이동합니다.
3. URL: `https://github.com/dhkqpr4624-cell/SSaemquest`

#### 단계 2: 파일 업로드
1. **"Add file"** 버튼 클릭 → **"Upload files"** 선택
2. 다운로드한 `samquest-production.zip` 파일 선택
3. 또는 폴더 전체를 드래그 앤 드롭

#### 단계 3: 커밋 메시지 작성
```
Initial commit: SAMQUEST production deployment

- Supabase integration with password hashing
- Row Level Security (RLS) policies
- No personal information collection
- Teacher authentication with hashed passwords
- Real-time quiz synchronization
```

#### 단계 4: Commit 클릭
파일이 저장소에 업로드됩니다.

### 1.2 명령어를 통한 업로드 (대안)

터미널에서 다음 명령어를 실행합니다:

```bash
cd samquest-production  # 압축 해제된 폴더로 이동

# Git 초기화 (이미 되어있으면 생략)
git init

# 모든 파일 추가
git add .

# 커밋
git commit -m "Initial commit: SAMQUEST production deployment"

# 원격 저장소 연결
git remote add origin https://github.com/dhkqpr4624-cell/SSaemquest.git

# 메인 브랜치로 변경
git branch -M main

# Push
git push -u origin main
```

---

## 2. Vercel 배포

### 2.1 Vercel 계정 생성 및 연결

1. [Vercel](https://vercel.com/)에 접속합니다.
2. GitHub 계정으로 로그인합니다.
3. GitHub 저장소 연동 권한을 승인합니다.

### 2.2 프로젝트 배포

#### 단계 1: 새 프로젝트 생성
1. Vercel 대시보드에서 **"Add New"** → **"Project"** 클릭
2. GitHub 저장소 목록에서 `SSaemquest` 선택
3. **"Import"** 클릭

#### 단계 2: 프로젝트 설정
- **Project Name**: `samquest` (또는 원하는 이름)
- **Framework Preset**: `Next.js`
- **Root Directory**: `./` (기본값)

#### 단계 3: 환경 변수 설정
**"Environment Variables"** 섹션에서 다음을 추가합니다:

| 이름 | 값 | 설명 |
|------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | Supabase 익명 키 |

**⚠️ 주의**: 절대로 `SUPABASE_SERVICE_ROLE_KEY`를 공개 환경 변수로 설정하지 마세요!

#### 단계 4: 배포 시작
**"Deploy"** 버튼을 클릭하여 배포를 시작합니다.

배포 진행 상황은 실시간으로 확인할 수 있습니다.

### 2.3 배포 완료

배포가 완료되면 다음과 같은 정보를 받게 됩니다:

- **프로덕션 URL**: `https://samquest.vercel.app` (예시)
- **배포 상태**: ✓ Ready for Production

---

## 3. 환경 변수 설정

### 3.1 Supabase 정보 확인

1. [Supabase](https://supabase.com/)에 로그인합니다.
2. 프로젝트 선택 → **"Settings"** → **"API"**
3. 다음 정보를 복사합니다:
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3.2 Vercel 환경 변수 설정

1. Vercel 프로젝트 대시보드 접속
2. **"Settings"** → **"Environment Variables"**
3. 각 환경(Production, Preview, Development)에 변수 추가:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3.3 로컬 개발 환경 설정

프로젝트 루트에 `.env.local` 파일 생성:

```bash
cp .env.example .env.local
```

`.env.local` 파일 내용:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 4. 배포 후 테스트

### 4.1 기본 기능 테스트

배포된 URL에서 다음을 확인합니다:

#### 학생 입장 테스트
1. **"학생 입장"** 클릭
2. 클래스 코드 입력 (예: `AB12CD`)
3. 출석번호 입력 (예: `1`)
4. **"입장하기"** 클릭
5. 학생 대시보드 로드 확인

#### 교사 입장 테스트
1. **"교사 입장"** 클릭
2. 클래스 코드 입력
3. 교사용 비밀번호 입력
4. **"입장하기"** 클릭
5. 교사 대시보드 로드 확인

### 4.2 Supabase 연결 확인

1. Supabase 대시보드 → **"SQL Editor"**
2. 다음 쿼리 실행:
   ```sql
   SELECT COUNT(*) FROM classes;
   SELECT COUNT(*) FROM students;
   ```
3. 데이터가 정상적으로 저장되는지 확인

### 4.3 실시간 기능 테스트

1. 두 개의 브라우저 탭에서 동일한 클래스에 접속
2. 한 탭에서 퀴즈 시작
3. 다른 탭에서 실시간으로 업데이트 확인

---

## 5. 트러블슈팅

### 5.1 배포 오류: "Build failed"

**원인**: 환경 변수 누락 또는 빌드 오류

**해결 방법**:
1. Vercel 빌드 로그 확인
2. 환경 변수가 모두 설정되었는지 확인
3. 로컬에서 `pnpm build` 실행하여 빌드 오류 확인

### 5.2 "supabaseUrl is required" 오류

**원인**: `NEXT_PUBLIC_SUPABASE_URL` 환경 변수 누락

**해결 방법**:
1. Vercel 프로젝트 설정에서 환경 변수 확인
2. 변수명이 정확한지 확인 (대소문자 구분)
3. 배포 재시작

### 5.3 Supabase 연결 오류

**원인**: 잘못된 URL 또는 키

**해결 방법**:
1. Supabase 프로젝트 설정에서 정확한 URL과 키 복사
2. 환경 변수 업데이트
3. Vercel에서 배포 재시작

### 5.4 RLS 정책 오류

**원인**: Row Level Security 정책이 설정되지 않음

**해결 방법**:
1. Supabase SQL Editor에서 `supabase_schema.sql` 실행
2. RLS 정책이 모든 테이블에 활성화되었는지 확인

---

## 📱 배포 후 사용 방법

### 교사 입장 흐름
1. 배포된 URL 접속
2. **"교사 입장"** 클릭
3. 클래스 생성 또는 기존 클래스 입장
4. 퀴즈 출제 및 관리
5. 실시간 퀴즈 진행

### 학생 입장 흐름
1. 배포된 URL 접속
2. **"학생 입장"** 클릭
3. 교사로부터 받은 클래스 코드 입력
4. 자신의 출석번호 입력
5. 퀴즈 풀이 및 보상 획득

---

## 🔐 보안 체크리스트

배포 전 다음을 확인하세요:

- [ ] `.env` 파일이 GitHub에 커밋되지 않았는가?
- [ ] Supabase 서비스 역할 키가 공개되지 않았는가?
- [ ] RLS 정책이 모든 테이블에 활성화되었는가?
- [ ] 교사 비밀번호가 해시되어 저장되는가?
- [ ] 학생 개인정보(이름, 이메일 등)를 수집하지 않는가?
- [ ] Vercel 환경 변수가 모두 설정되었는가?

---

## 📞 지원

문제가 발생하면:

1. **Vercel 빌드 로그** 확인: Vercel 대시보드 → Deployments → 빌드 로그
2. **Supabase 로그** 확인: Supabase 대시보드 → Logs
3. **브라우저 콘솔** 확인: F12 → Console 탭

---

**축하합니다! 쌤퀘스트가 성공적으로 배포되었습니다! 🎉**
