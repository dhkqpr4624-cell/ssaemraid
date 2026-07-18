# 학급 게임화 웹앱 - 실제 퀴즈 문항 시스템 구현 문서

## 1. 프로젝트 실행 방법

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행 (http://localhost:3000)
pnpm dev

# 프로덕션 빌드
pnpm build

# 프로덕션 서버 실행
pnpm start
```

---

## 2. 현재 폴더 구조

```
project/
├── app/
│   ├── page.tsx                      # 교사/학생 선택 첫 화면
│   ├── teacher/
│   │   ├── page.tsx                  # 교사 홈 (클래스 목록/생성)
│   │   ├── create/page.tsx           # 클래스 생성
│   │   ├── dashboard/page.tsx        # 교사 대시보드 ★수정됨
│   │   └── quiz/
│   │       ├── create/page.tsx       # 퀴즈 문항 생성 ★신규
│   │       └── grade/page.tsx        # 장문형 채점 ★신규
│   └── student/
│       ├── page.tsx                  # 학생 입장 (클래스코드 + 출석번호)
│       ├── dashboard/page.tsx        # 학생 대시보드 ★수정됨
│       └── quiz/page.tsx             # 퀴즈 풀기 ★신규
├── components/
│   ├── quiz/
│   │   └── QuestionEditor.tsx        # 문항 편집기 컴포넌트 ★신규
│   └── ui/                           # shadcn/ui 컴포넌트들
├── lib/
│   ├── types.ts                      # 타입 정의 ★대폭 확장
│   └── class-storage.ts              # localStorage 저장 함수 ★대폭 확장
└── public/
```

---

## 3. 주요 타입 정의 (`lib/types.ts`)

### QuizQuestion (문항 타입)

```typescript
interface QuizQuestion {
  id: string;
  quizId: string;
  order: number;
  type: 'single' | 'multiple' | 'short' | 'essay';
  text: string;
  points: number;
  options?: string[];           // 객관식 보기 목록
  correctAnswers?: number[];    // 객관식 정답 인덱스
  shortAnswers?: string[];      // 단답형 정답 목록 (공백 무시, 대소문자 무시)
  hint?: string;                // 힌트 (선택)
}
```

### Quiz (퀴즈 타입)

```typescript
interface Quiz {
  id: string;
  classId: string;
  classCode: string;
  title: string;
  description?: string;
  totalScore: number;           // 자동 계산 (문항 배점 합계)
  isActive: boolean;            // 학생에게 공개 여부
  isReviewEnabled: boolean;     // 반복학습 허용 여부
  reviewMode: 'same' | 'new';   // 반복학습 모드
  createdAt: string;
  rewardOptions: QuizRewardOption[];
  questions: QuizQuestion[];
}
```

### QuizRewardOption (보상 아이템 타입)

```typescript
interface QuizRewardOption {
  id: string;
  itemId: string;
  requiredScore: number;        // 이 점수 이상이면 선택 가능
  itemName: string;
  itemIcon: string;             // 이모지
  itemType: 'badge' | 'decoration' | 'avatar' | 'special';
  itemDescription?: string;
}
```

### StudentQuizResult (학생 퀴즈 결과 타입)

```typescript
interface StudentQuizResult {
  id: string;
  quizId: string;
  classCode: string;
  studentId: string;
  attendanceNumber: number;
  submittedAt: string;
  answers: StudentAnswer[];
  score: number;                // 자동채점 점수 (장문형 제외)
  pendingScore: number;         // 장문형 채점 대기 점수
  gradingStatus: 'auto_complete' | 'pending_review' | 'fully_graded';
  eligibleRewardOptionIds: string[];
  selectedRewardOptionId?: string;
  rewardClaimedAt?: string;
}
```

### StudentAnswer (학생 답안 타입)

```typescript
interface StudentAnswer {
  questionId: string;
  selectedOptions?: number[];   // 객관식 선택 인덱스
  textAnswer?: string;          // 단답형/장문형 텍스트
  isAutoGraded: boolean;
  earnedPoints: number;
  needsReview: boolean;         // 장문형 = true (교사 채점 필요)
}
```

---

## 4. localStorage 구조

| 키 | 타입 | 설명 |
|---|---|---|
| `classroom_app_classes` | `ClassRoom[]` | 클래스 목록 |
| `classroom_app_students` | `Student[]` | 전체 학생 목록 |
| `classroom_app_sessions` | `SessionRecord[]` | 수업 기록 |
| `classroom_app_activity_logs` | `ActivityLog[]` | 점수/코인 변경 로그 |
| `classroom_app_teacher_sessions` | `TeacherSession[]` | 교사 최근 접속 기록 |
| `classroom_app_quizzes` | `Quiz[]` | 퀴즈 목록 (문항 포함) |
| `classroom_app_quiz_results` | `StudentQuizResult[]` | 학생 퀴즈 결과 |

### DB 마이그레이션 가이드

`lib/class-storage.ts`의 모든 함수는 localStorage를 추상화하여 분리되어 있습니다.
DB로 전환 시 각 함수의 내부 구현만 교체하면 됩니다:

```typescript
// 현재: localStorage
export function getQuizById(quizId: string): Quiz | null {
  const quizzes = getQuizzes();
  return quizzes.find(q => q.id === quizId) ?? null;
}

// DB 전환 후 (예시):
export async function getQuizById(quizId: string): Promise<Quiz | null> {
  return await db.quiz.findUnique({ where: { id: quizId } });
}
```

---

## 5. 구현된 기능 목록

### 교사 기능

| 기능 | 경로 | 설명 |
|---|---|---|
| 퀴즈 생성 | `/teacher/quiz/create?code={CODE}` | 문항 추가, 보상 설정, 활성화 |
| 장문형 채점 | `/teacher/quiz/grade?code={CODE}` | 미채점 답안 목록, 점수 부여 |
| 채점 대기 알림 | 대시보드 | 미채점 답안 수 뱃지 표시 |

### 학생 기능

| 기능 | 경로 | 설명 |
|---|---|---|
| 퀴즈 풀기 | `/student/quiz?id={QUIZ_ID}` | 문항 유형별 UI, 진행률 표시 |
| 결과 확인 | 퀴즈 제출 후 | 자동채점 결과, 문항별 점수 |
| 보상 선택 | 결과 화면 | 점수 조건 충족 보상 중 1개 선택 |
| 채점 대기 표시 | 대시보드 | 장문형 채점 대기 중 상태 표시 |

### 자동채점 로직

| 문항 유형 | 채점 방식 |
|---|---|
| 객관식 (단일정답) | 선택한 인덱스 = 정답 인덱스 → 만점 |
| 객관식 (복수정답) | 선택 집합 = 정답 집합 (완전 일치) → 만점 |
| 단답형 | 입력값 공백 제거 + 소문자 변환 후 정답 목록과 비교 → 만점 |
| 장문형 | 자동채점 불가 → `needsReview: true`, 교사 채점 대기 |

---

## 6. 수정된 파일 목록

### 신규 생성 파일

- `app/teacher/quiz/create/page.tsx` — 교사용 퀴즈 문항 생성 페이지
- `app/teacher/quiz/grade/page.tsx` — 교사용 장문형 채점 페이지
- `app/student/quiz/page.tsx` — 학생용 퀴즈 풀기 페이지
- `components/quiz/QuestionEditor.tsx` — 문항 편집기 재사용 컴포넌트

### 수정된 파일

- `lib/types.ts` — `QuizQuestion`, `Quiz`, `QuizRewardOption`, `StudentAnswer`, `StudentQuizResult` 타입 추가
- `lib/class-storage.ts` — 퀴즈 CRUD, 답안 제출, 자동채점, 장문형 채점, 보상 수령 함수 추가
- `app/teacher/dashboard/page.tsx` — 퀴즈 목록, 채점 대기 알림 섹션 추가
- `app/student/dashboard/page.tsx` — 진행 중 퀴즈 목록, 보상 선택 안내 추가
- `next.config.mjs` — `allowedDevOrigins` 추가 (개발 환경 CORS)

---

## 7. 주요 함수 목록 (`lib/class-storage.ts`)

```typescript
// 퀴즈 관련
createQuiz(input: QuizInput): { success: boolean; quiz?: Quiz; error?: string }
updateQuiz(quizId: string, input: QuizInput): { success: boolean; error?: string }
getQuizById(quizId: string): Quiz | null
getQuizzesByClass(classCode: string): Quiz[]
getActiveQuizzes(classCode: string): Quiz[]

// 답안 제출 및 채점
submitQuizAnswers(
  classCode: string,
  attendanceNumber: number,
  quizId: string,
  rawAnswers: RawAnswer[]
): { success: boolean; result?: StudentQuizResult; eligibleRewards?: QuizRewardOption[]; error?: string }

gradeEssayAnswer(
  classCode: string,
  resultId: string,
  questionId: string,
  score: number
): { success: boolean; error?: string }

// 보상
getEligibleRewards(quizId: string, score: number): QuizRewardOption[]
claimQuizReward(
  classCode: string,
  attendanceNumber: number,
  quizId: string,
  rewardOptionId: string
): { success: boolean; item?: { name: string; icon: string }; error?: string }

// 결과 조회
getStudentQuizResult(quizId: string, studentId: string): StudentQuizResult | null
getPendingReviewResults(classCode: string): StudentQuizResult[]
```
