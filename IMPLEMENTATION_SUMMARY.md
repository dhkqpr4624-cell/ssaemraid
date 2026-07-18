# 학급 게임화 웹앱 - 최종 구현 요약

## 📋 프로젝트 개요

이 프로젝트는 초등학생 대상의 학급 게임화 시스템으로, 교사가 퀴즈를 출제하고 학생이 풀어서 보상을 받는 통합 플랫폼입니다.

**기술 스택**: Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui + localStorage

---

## 🎯 주요 기능

### A. 퀴즈 시스템 (안정화 완료)

#### 1. 퀴즈 생성 (교사)
- **위치**: `/teacher/quiz/create?code={CODE}`
- **기능**:
  - 문항 유형: 객관식(단일/복수), 단답형, 장문형
  - 문항별 배점 설정
  - 보상 옵션 설정 (이미지 업로드 지원)
  - **중복 참여 옵션** (NEW):
    - `allowRetry`: 보상 수령 후 재도전 허용
    - `retryQuestionMode`: 동일/수정/랜덤/추가 문제 선택
    - `retryRewardMode`: 기존/별도/없음 보상 선택

#### 2. 퀴즈 풀기 (학생)
- **위치**: `/student/quiz?id={QUIZ_ID}`
- **기능**:
  - 문항 유형별 UI (객관식 라디오/체크박스, 텍스트 입력)
  - 자동채점: 객관식, 단답형
  - 장문형 미채점 상태 저장
  - 제출 후 결과 화면
  - **다중 시도 지원**:
    - `attemptNumber`: 시도 횟수 추적
    - `isRetryAttempt`: 재도전 여부 플래그
    - 보상 수령 후에도 재도전 가능 (설정에 따라)

#### 3. 장문형 채점 (교사)
- **위치**: `/teacher/quiz/grade?code={CODE}`
- **기능**:
  - 미채점 답안 목록 표시
  - 문항별 점수 입력
  - 채점 저장 시 학생 점수 반영
  - 자동으로 `fully_graded` 상태로 전환

#### 4. 보상 수령 (학생)
- **흐름**:
  1. 자동채점 완료 또는 교사 채점 완료
  2. 점수 기준 충족 보상 표시
  3. 학생이 1개 보상 선택 및 수령
  4. 인벤토리에 아이템 추가
  5. 중복 참여 설정에 따라 재도전 가능

---

### B. 아바타 시스템

#### 1. 아바타 꾸미기 (학생)
- **위치**: `/student/avatar`
- **기능**:
  - 10단계 레이어 구조 (배경 → 신발 → 액세서리)
  - 부위별 탭 (머리, 눈, 얼굴, 상의, 하의, 신발, 모자, 액세서리, 배경)
  - 피부색 선택
  - 아이템 장착/해제
  - 새로고침 유지

#### 2. 아바타 렌더링
- **컴포넌트**: `AvatarRenderer.tsx`
- **구조**: CSS position absolute로 레이어 겹침
- **확장성**: 나중에 PNG 파츠로 교체 가능

---

### C. 인벤토리 시스템 (NEW)

#### 1. 인벤토리 페이지
- **위치**: `/student/inventory`
- **기능**:
  - 아이템 유형별 필터 (avatar, room, badge, decoration, etc)
  - 장착/미장착 상태 표시
  - 아바타 파츠 → 아바타 꾸미기 페이지 연결
  - 방 꾸미기 아이템 → 방 꾸미기 페이지 연결

---

### D. 방 꾸미기 시스템 (NEW)

#### 1. 방 꾸미기 페이지
- **위치**: `/student/room`
- **기능**:
  - **고정 슬롯 방식** (5개 슬롯):
    - 배경 (background)
    - 바닥 (floor)
    - 책상 (desk)
    - 의자 (chair)
    - 장식 (decoration)
  - 방 미리보기 (레이어 구조)
  - 슬롯별 아이템 배치
  - 저장 기능
  - **확장성**: `itemId, slot, x, y, zIndex` 구조로 나중에 자유 배치 가능

#### 2. RoomState 타입
```typescript
interface RoomState {
  skinColor?: string;
  equipped: {
    background?: string;
    floor?: string;
    desk?: string;
    chair?: string;
    decoration?: string;
  };
}
```

---

## 🔄 데이터 흐름

### 퀴즈 제출 → 채점 → 보상 수령

```
1. 학생 퀴즈 제출
   ├─ 자동채점 (객관식, 단답형)
   ├─ 장문형 미채점 상태 저장
   └─ StudentQuizResult 생성 (attemptNumber, isRetryAttempt 포함)

2. 교사 채점 (장문형만)
   ├─ gradeEssayAnswer() 호출
   ├─ 점수 입력
   └─ gradingStatus → 'fully_graded'

3. 학생 보상 수령
   ├─ 점수 기준 충족 보상 표시
   ├─ 1개 보상 선택
   ├─ claimQuizReward() 호출
   ├─ 인벤토리에 아이템 추가
   └─ selectedRewardOptionId 저장

4. 중복 참여 (설정에 따라)
   ├─ allowRetry = true인 경우만 가능
   ├─ 새 시도 생성 (attemptNumber 증가)
   ├─ retryRewardMode에 따라 보상 결정
   └─ 반복
```

---

## 📊 타입 정의

### StudentQuizResult (다중 시도 지원)
```typescript
interface StudentQuizResult {
  // ... 기존 필드
  attemptNumber: number;        // 1, 2, 3, ...
  isRetryAttempt: boolean;      // 재도전 여부
  rewardClaimedPerAttempt?: Record<number, boolean>;
}
```

### Quiz (중복 참여 옵션)
```typescript
interface Quiz {
  // ... 기존 필드
  allowRetry: boolean;
  retryQuestionMode?: RetryQuestionMode;
  retryRewardMode?: RetryRewardMode;
  retryRewardOptions?: QuizRewardOption[];
}
```

### Item (이미지 지원)
```typescript
interface Item {
  id: string;
  name: string;
  type: ItemType;
  slot?: AvatarSlot;
  icon: string;           // emoji (fallback)
  iconUrl?: string;
  imageUrl?: string;      // Base64 또는 URL
  layerImageUrl?: string;
  description?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  acquiredAt: string;
}
```

---

## 💾 localStorage 구조

| Key | 설명 | 타입 |
|-----|------|------|
| `classrooms` | 클래스 목록 | ClassRoom[] |
| `students` | 학생 목록 | Student[] |
| `quizzes` | 퀴즈 목록 | Quiz[] |
| `quiz_results` | 퀴즈 결과 (다중 시도 지원) | StudentQuizResult[] |
| `teacher_sessions` | 교사 세션 | TeacherClassSession[] |
| `student_session` | 학생 세션 | StudentSession |
| `activity_logs` | 활동 로그 | ActivityLog[] |

---

## 🔧 주요 함수

### 퀴즈 관련
- `createQuiz(input)`: 퀴즈 생성 (중복 참여 옵션 포함)
- `submitQuizAnswers()`: 답안 제출 (다중 시도 지원)
- `gradeEssayAnswer()`: 장문형 채점
- `claimQuizReward()`: 보상 수령
- `getPendingReviewResults()`: 미채점 답안 조회

### 아바타 관련
- `equipAvatarItem()`: 아바타 아이템 장착
- `unequipAvatarItem()`: 아바타 아이템 해제
- `getStudentAvatarState()`: 아바타 상태 조회
- `updateStudentAvatarState()`: 아바타 상태 저장

### 방 관련
- `getRoomState()`: 방 상태 조회
- `updateRoomState()`: 방 상태 저장

---

## 📄 페이지 목록

| 경로 | 역할 | 설명 |
|------|------|------|
| `/` | 메인 | 교사/학생 선택 |
| `/teacher` | 교사 로그인 | 클래스 코드 + 비밀번호 |
| `/teacher/create` | 클래스 생성 | 클래스 이름, 학생 수, 비밀번호 |
| `/teacher/dashboard?code={CODE}` | 교사 대시보드 | 학생 관리, 퀴즈 관리, 채점 필요 표시 |
| `/teacher/quiz/create?code={CODE}` | 퀴즈 생성 | 문항, 보상, 중복 참여 옵션 설정 |
| `/teacher/quiz/grade?code={CODE}` | 장문형 채점 | 미채점 답안 채점 |
| `/student` | 학생 로그인 | 클래스 코드 + 출석번호 |
| `/student/dashboard` | 학생 대시보드 | 퀴즈 목록, 보상 상태, 아바타 미리보기 |
| `/student/quiz?id={QUIZ_ID}` | 퀴즈 풀기 | 문항 풀이, 자동채점, 결과 확인 |
| `/student/avatar` | 아바타 꾸미기 | 부위별 아이템 장착 |
| `/student/inventory` | 인벤토리 | 아이템 관리, 필터링 |
| `/student/room` | 방 꾸미기 | 슬롯별 아이템 배치 |

---

## 🚀 배포 준비

### 빌드 확인
```bash
pnpm build
# ✓ 14 pages generated
# ✓ 모든 페이지 정상 생성
```

### 개발 서버 실행
```bash
pnpm dev
# 포트 3000에서 실행
```

---

## 📝 다음 단계 (TODO)

### 1. DB 마이그레이션
- `class-storage.ts`의 함수 내부만 교체
- 타입 정의는 그대로 유지
- Supabase 또는 Firebase 연동

### 2. 고급 기능
- 문제 수정 (modified mode)
- 문제은행 (random mode)
- 추가 문제 (extended mode)
- 자유 배치 (drag & drop)

### 3. 실제 이미지 자산
- 아바타 PNG 파츠
- 방 꾸미기 아이템 이미지
- 배경 이미지

### 4. 성능 최적화
- 이미지 최적화 (WebP, 압축)
- 가상 스크롤링
- 코드 스플리팅

### 5. 보안 강화
- 교사 인증 개선
- 학생 세션 타임아웃
- CSRF 방지

---

## 🎓 사용 시나리오

### 교사 입장
1. 클래스 생성 (학생 20명)
2. 퀴즈 생성 (5개 문항, 3개 보상, 중복 참여 허용)
3. 학생 답안 채점 (장문형만)
4. 채점 필요 수 확인

### 학생 입장
1. 로그인 (클래스 코드 + 출석번호)
2. 퀴즈 풀기 (약 5분)
3. 점수 확인 및 보상 선택
4. 아바타 꾸미기 (보상 아이템 장착)
5. 방 꾸미기 (보상 아이템 배치)
6. 중복 참여 (설정된 경우)

---

## 📞 문제 해결

### 빌드 에러
- TypeScript 에러 확인: `pnpm build`
- 타입 정의 확인: `lib/types.ts`
- 함수 export 확인: `lib/class-storage.ts`

### 데이터 손실
- localStorage 확인: `F12 → Application → Local Storage`
- 브라우저 캐시 삭제 후 재시도

### 성능 문제
- 개발자 도구 Performance 탭 확인
- 불필요한 re-render 제거
- 이미지 최적화

---

## 📚 참고 자료

- [Next.js 공식 문서](https://nextjs.org)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [shadcn/ui 컴포넌트](https://ui.shadcn.com)

---

**마지막 업데이트**: 2026-04-28  
**버전**: 2.0 (중복 참여 + 인벤토리 + 방 꾸미기)
