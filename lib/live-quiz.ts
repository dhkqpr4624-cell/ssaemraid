import { LiveQuizSession, Quiz, QuizQuestion } from './types';

/**
 * 간단한 UUID 생성
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 랜덤하게 문제 선택
 */
export function selectRandomQuestions(
  questions: QuizQuestion[],
  count: number
): QuizQuestion[] {
  if (count >= questions.length) {
    return questions;
  }

  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * 문제 순서 섞기
 */
export function shuffleQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  return [...questions].sort(() => Math.random() - 0.5);
}

/**
 * 함께 풀기 세션 생성
 */
export function createLiveQuizSession(
  quiz: Quiz,
  classCode: string,
  participatingStudents: string[]
): LiveQuizSession {
  let selectedQuestions = [...quiz.questions];

  // 랜덤 출제
  if (quiz.randomPickEnabled && quiz.randomPickCount) {
    selectedQuestions = selectRandomQuestions(selectedQuestions, quiz.randomPickCount);
  }

  // 문제 순서 섞기
  if (quiz.shuffleQuestionsEnabled) {
    selectedQuestions = shuffleQuestions(selectedQuestions);
  }

  return {
    id: generateUUID(),
    quizId: quiz.id,
    classCode,
    status: 'waiting',
    currentQuestionIndex: 0,
    selectedQuestionIds: selectedQuestions.map(q => q.id),
    participatingStudents,
    submittedStudents: [],
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    timeLimitSeconds: 60, // 기본값: 60초
  };
}

/**
 * 현재 문제 가져오기
 */
export function getCurrentQuestion(
  session: LiveQuizSession,
  questions: QuizQuestion[]
): QuizQuestion | null {
  const questionId = session.selectedQuestionIds[session.currentQuestionIndex];
  return questions.find(q => q.id === questionId) || null;
}

/**
 * 다음 문제로 이동
 */
export function moveToNextQuestion(session: LiveQuizSession): LiveQuizSession {
  const nextIndex = session.currentQuestionIndex + 1;
  const isLastQuestion = nextIndex >= session.selectedQuestionIds.length;

  return {
    ...session,
    currentQuestionIndex: nextIndex,
    submittedStudents: [],
    status: isLastQuestion ? 'ended' : 'question_active',
    questionStartedAt: new Date().toISOString(),
  };
}

/**
 * 세션 상태 업데이트
 */
export function updateSessionStatus(
  session: LiveQuizSession,
  newStatus: LiveQuizSession['status']
): LiveQuizSession {
  return {
    ...session,
    status: newStatus,
  };
}

/**
 * 학생 제출 등록
 */
export function registerStudentSubmission(
  session: LiveQuizSession,
  attendanceNumber: string
): LiveQuizSession {
  const alreadySubmitted = session.submittedStudents.includes(attendanceNumber);
  if (alreadySubmitted) {
    return session;
  }

  return {
    ...session,
    submittedStudents: [...session.submittedStudents, attendanceNumber],
  };
}

/**
 * 모든 학생이 제출했는지 확인
 */
export function areAllStudentsSubmitted(session: LiveQuizSession): boolean {
  return session.submittedStudents.length === session.participatingStudents.length;
}

/**
 * 시간 초과 확인
 */
export function isTimeExpired(session: LiveQuizSession, timeLimitSeconds: number): boolean {
  if (!session.questionStartedAt) return false;

  const startTime = new Date(session.questionStartedAt).getTime();
  const currentTime = new Date().getTime();
  const elapsedSeconds = (currentTime - startTime) / 1000;

  return elapsedSeconds >= timeLimitSeconds;
}

/**
 * 세션 진행 상태 계산
 */
export function getSessionProgress(session: LiveQuizSession, totalQuestions: number) {
  return {
    currentQuestion: session.currentQuestionIndex + 1,
    totalQuestions,
    percentage: Math.round((session.currentQuestionIndex / totalQuestions) * 100),
    submittedCount: session.submittedStudents.length,
    totalStudents: session.participatingStudents.length,
  };
}
