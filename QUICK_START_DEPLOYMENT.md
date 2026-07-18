# 쌤퀘스트(SAMQUEST) - 빠른 배포 가이드

이 문서는 GitHub 업로드부터 Vercel 배포까지의 **최소 필수 단계**를 설명합니다.

---

## 🚀 5분 안에 배포하기

### 단계 1: GitHub에 파일 업로드 (2분)

1. GitHub 저장소 접속: `https://github.com/dhkqpr4624-cell/SSaemquest`
2. **"Add file"** → **"Upload files"** 클릭
3. `samquest-production-final.zip` 파일 업로드
4. 커밋 메시지 입력: `Initial commit: SAMQUEST production`
5. **"Commit changes"** 클릭

### 단계 2: Vercel 배포 설정 (3분)

1. [Vercel](https://vercel.com/)에 접속 (GitHub로 로그인)
2. **"Add New"** → **"Project"** 클릭
3. `SSaemquest` 저장소 선택
4. **"Import"** 클릭
5. 환경 변수 추가:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
6. **"Deploy"** 클릭

**완료! 배포 URL이 제공됩니다.**

---

## 📝 필수 정보

배포 전 다음을 준비하세요:

### Supabase 정보
1. [Supabase](https://supabase.com/)에서 프로젝트 생성
2. **Settings** → **API** 에서 다음 복사:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. SQL Editor에서 `supabase_schema.sql` 실행

### GitHub 저장소
- 사용자명: `dhkqpr4624-cell`
- 저장소명: `SSaemquest`
- 상태: **Private**

---

## ✅ 배포 후 확인 사항

배포 완료 후 다음을 확인하세요:

### 1. 기본 접속 테스트
- [ ] 배포 URL 접속 가능
- [ ] 학생 입장 페이지 로드
- [ ] 교사 입장 페이지 로드

### 2. 학생 입장 테스트
- [ ] 클래스 코드 입력
- [ ] 출석번호 입력
- [ ] 대시보드 로드

### 3. 교사 입장 테스트
- [ ] 클래스 코드 입력
- [ ] 교사 비밀번호 입력
- [ ] 대시보드 로드

### 4. Supabase 연결 확인
- [ ] Supabase 대시보드에서 데이터 저장 확인
- [ ] RLS 정책 활성화 확인

---

## 🔧 문제 해결

### 배포 실패
1. Vercel 빌드 로그 확인
2. 환경 변수 재확인
3. 배포 재시작

### Supabase 연결 오류
1. 환경 변수 정확성 확인
2. Supabase RLS 정책 확인
3. 네트워크 연결 확인

### 학생/교사 입장 실패
1. 클래스 코드 정확성 확인
2. 출석번호/비밀번호 확인
3. 브라우저 콘솔 오류 확인

---

## 📚 상세 가이드

더 자세한 정보는 다음 문서를 참조하세요:

- **[GitHub 및 Vercel 배포 가이드](./GITHUB_AND_VERCEL_DEPLOYMENT.md)** - 단계별 상세 설명
- **[보안 및 개인정보 보호](./SECURITY_AND_PRIVACY.md)** - 보안 정책 및 설정
- **[README](./README.md)** - 프로젝트 개요 및 기능

---

## 🎉 축하합니다!

쌤퀘스트가 성공적으로 배포되었습니다!

**배포 URL**: `https://samquest.vercel.app` (예시)

이제 다음을 할 수 있습니다:
- ✅ 교사가 클래스 생성 및 퀴즈 출제
- ✅ 학생이 클래스 코드로 입장
- ✅ 실시간 퀴즈 진행
- ✅ 아바타 커스터마이징
- ✅ 보상 획득

**즐거운 학습을 경험하세요! 📚🎮**
