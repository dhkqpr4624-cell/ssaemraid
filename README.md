# 쌤퀘스트 (SAMQUEST) - 게임화 학습 플랫폼

**쌤퀘스트**는 교실 수업을 게임처럼 재미있게 만드는 웹 기반 플랫폼입니다. 선생님은 퀴즈를 출제하고 학생들의 참여를 유도하며, 학생들은 아바타를 꾸미고 보상을 획득하며 학습합니다.

## 🎮 주요 기능

### 선생님 기능
- **클래스 관리**: 고유한 클래스 코드로 학생들을 관리
- **퀴즈 출제**: 객관식, 단답형, 에세이형 문제 출제
- **실시간 퀴즈**: 함께 풀기 모드로 전체 학생과 동시에 퀴즈 진행
- **학생 관리**: 점수, 코인 수동 조정 및 활동 로그 확인
- **보상 설정**: 퀴즈 완료 시 학생들이 선택할 수 있는 보상 옵션 설정

### 학생 기능
- **클래스 입장**: 클래스 코드 + 출석번호로 간단하게 입장 (개인정보 불필요)
- **퀴즈 풀이**: 다양한 형식의 문제 풀이
- **아바타 커스터마이징**: 스킨색, 의류, 액세서리로 캐릭터 꾸미기
- **보상 획득**: 퀴즈 완료 후 점수, 코인, 아이템 획득
- **방 꾸미기**: 자신의 가상 공간에 아이템 배치

## 🛠️ 기술 스택

- **프론트엔드**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **백엔드**: Supabase (PostgreSQL, Realtime, Storage)
- **배포**: Vercel
- **인증**: 클래스 코드 + 비밀번호 (개인정보 보호 중심)

## 📋 프로젝트 구조

```
project_analysis/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # 랜딩 페이지
│   ├── student/                 # 학생 페이지
│   │   ├── page.tsx            # 학생 로그인
│   │   ├── dashboard/          # 학생 대시보드
│   │   ├── avatar/             # 아바타 커스터마이징
│   │   ├── room/               # 방 꾸미기
│   │   ├── quiz/               # 퀴즈 풀이
│   │   ├── live-quiz/          # 실시간 퀴즈
│   │   └── inventory/          # 인벤토리
│   └── teacher/                 # 선생님 페이지
│       ├── page.tsx            # 선생님 로그인
│       ├── create/             # 클래스 생성
│       ├── dashboard/          # 선생님 대시보드
│       ├── quiz/               # 퀴즈 관리
│       ├── live-quiz/          # 실시간 퀴즈 진행
│       ├── item-editor/        # 아이템 편집
│       └── settings/           # 설정
├── lib/                          # 유틸리티 및 데이터 관리
│   ├── db-wrapper.ts           # localStorage/Supabase 추상화 레이어
│   ├── supabase.ts             # Supabase 클라이언트 및 함수
│   ├── class-storage.ts        # localStorage 기반 데이터 관리
│   ├── types.ts                # TypeScript 타입 정의
│   ├── live-quiz.ts            # 실시간 퀴즈 로직
│   └── ...
├── components/                   # 재사용 가능한 컴포넌트
│   ├── ui/                     # UI 컴포넌트 (Button, Card 등)
│   ├── avatar/                 # 아바타 렌더러
│   └── ...
├── public/                       # 정적 자산
│   └── assets/
│       └── logo.png            # 쌤퀨스트 로고
├── supabase_schema.sql         # Supabase 데이터베이스 스키마
├── DEPLOYMENT_GUIDE.md         # 배포 가이드
└── README.md                   # 이 파일
```

## 🚀 시작하기

### 로컬 개발 환경 설정

1. **저장소 클론**
   ```bash
   git clone <repository-url>
   cd project_analysis
   ```

2. **의존성 설치**
   ```bash
   pnpm install
   ```

3. **환경 변수 설정**
   ```bash
   cp .env.example .env.local
   ```
   `.env.local` 파일에 Supabase 정보를 입력합니다:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

4. **개발 서버 실행**
   ```bash
   pnpm dev
   ```
   브라우저에서 `http://localhost:3000`으로 접속합니다.

## 📦 Supabase 설정

### 1. Supabase 프로젝트 생성
- [Supabase](https://supabase.com/)에서 새 프로젝트 생성
- Project Settings > API에서 URL과 anon key 복사

### 2. 데이터베이스 스키마 설정
- Supabase 대시보드의 SQL Editor에서 `supabase_schema.sql` 실행
- 다음 테이블이 생성됩니다:
  - `classes`: 클래스 정보
  - `students`: 학생 정보
  - `quizzes`: 퀴즈 정보
  - `quiz_results`: 퀴즈 결과
  - `live_sessions`: 실시간 세션

### 3. Realtime 활성화
- Database > Replication에서 `live_sessions` 테이블 선택
- 실시간 동기화 활성화

자세한 내용은 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)를 참조하세요.

## 🌐 배포

### Vercel 배포

1. **GitHub에 푸시**
   ```bash
   git push origin main
   ```

2. **Vercel 연결**
   - [Vercel](https://vercel.com/)에서 GitHub 저장소 연결
   - 환경 변수 설정 (Supabase URL, Anon Key)
   - Deploy 버튼 클릭

3. **배포 완료**
   - Vercel이 제공하는 URL로 서비스 접속

## 🔐 개인정보 보호

쌤퀘스트는 **개인정보 보호를 최우선**으로 설계되었습니다:

- ✅ 학생 이름, 이메일, 전화번호를 수집하지 않음
- ✅ 학생은 **클래스 코드 + 출석번호**로만 입장
- ✅ 모든 데이터는 암호화되어 Supabase에 저장
- ✅ 선생님 비밀번호로 클래스 보호

## 📱 사용 시나리오

### 선생님 입장
1. 쌤퀘스트 접속 → "교사 입장" 클릭
2. 새 클래스 생성 (클래스명, 학생 수, 비밀번호 입력)
3. 클래스 코드 학생들에게 공유
4. 퀴즈 출제 및 관리
5. 실시간 퀴즈로 학생들과 함께 풀이

### 학생 입장
1. 쌤퀘스트 접속 → "학생 입장" 클릭
2. 선생님이 알려준 클래스 코드 입력
3. 자신의 출석번호 입력
4. 대시보드에서 진행 중인 퀴즈 확인
5. 퀴즈 풀이 → 보상 선택 → 아바타/방 꾸미기

## 🎨 커스터마이징

### 아이템 추가
1. 선생님 대시보드 → "아이템 편집"
2. 새 아이템 추가 (이름, 가격, 이미지)
3. 학생들이 코인으로 구매 가능

### 보상 옵션 설정
1. 퀴즈 생성 시 "보상 옵션" 탭
2. 학생들이 선택할 수 있는 보상 추가
3. 각 보상에 대한 점수/코인/아이템 설정

## 🐛 트러블슈팅

### 환경 변수 오류
```
Error: supabaseUrl is required
```
→ `.env.local` 파일에 `NEXT_PUBLIC_SUPABASE_URL` 설정 확인

### 실시간 동기화 안 됨
→ Supabase 프로젝트에서 Realtime 활성화 확인

### 로그인 실패
→ 클래스 코드와 출석번호 정확성 확인

## 📚 문서

- [배포 가이드](./DEPLOYMENT_GUIDE.md) - Vercel 및 Supabase 배포 방법
- [데이터베이스 스키마](./supabase_schema.sql) - Supabase 테이블 구조

## 📝 라이선스

이 프로젝트는 교육 목적으로 제작되었습니다.

## 🤝 기여

버그 리포트 및 기능 요청은 이슈 탭에서 제출해주세요.

---

**쌤퀘스트와 함께 즐거운 학습을 경험하세요! 🎮📚**
