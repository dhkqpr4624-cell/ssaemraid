/**
 * 자동 채점 로직
 * 
 * 각 문항 타입별로 정답 여부를 판단합니다.
 */

import type { StudentAnswer, QuizQuestion } from './types';

export interface GradingResult {
  questionId: string;
  isCorrect: boolean;
  earnedPoints: number;
  needsReview: boolean;
}

/**
 * 단일 선택형 채점
 */
function gradeMultipleChoice(
  answer: StudentAnswer,
  question: QuizQuestion
): GradingResult {
  const isCorrect =
    answer.selectedOptions.length > 0 &&
    answer.selectedOptions[0] === question.correctAnswers?.[0];

  return {
    questionId: answer.questionId,
    isCorrect,
    earnedPoints: isCorrect ? (question.points || 0) : 0,
    needsReview: false,
  };
}

/**
 * 복수 선택형 채점
 */
function gradeMultipleSelect(
  answer: StudentAnswer,
  question: QuizQuestion
): GradingResult {
  const correctAnswers = question.correctAnswers || [];
  const selectedOptions = answer.selectedOptions || [];

  // 선택한 답과 정답이 정확히 일치해야 함
  const isCorrect =
    selectedOptions.length === correctAnswers.length &&
    selectedOptions.every((idx) => correctAnswers.includes(idx));

  return {
    questionId: answer.questionId,
    isCorrect,
    earnedPoints: isCorrect ? (question.points || 0) : 0,
    needsReview: false,
  };
}

/**
 * 단답형 채점
 */
function gradeShortAnswer(
  answer: StudentAnswer,
  question: QuizQuestion
): GradingResult {
  const shortAnswers = question.shortAnswers || [];
  const userAnswer = answer.textAnswer?.trim().toLowerCase() || '';

  // 정답 중 하나와 일치하면 정답 (대소문자 무시)
  const isCorrect = shortAnswers.some(
    (correct) => correct.trim().toLowerCase() === userAnswer
  );

  return {
    questionId: answer.questionId,
    isCorrect,
    earnedPoints: isCorrect ? (question.points || 0) : 0,
    needsReview: false,
  };
}

/**
 * 장문형 채점 (수동 채점 필요)
 */
function gradeEssay(
  answer: StudentAnswer,
  question: QuizQuestion
): GradingResult {
  return {
    questionId: answer.questionId,
    isCorrect: false, // 자동 채점 불가
    earnedPoints: 0,
    needsReview: true, // 수동 채점 필요
  };
}

/**
 * 문항 타입별 자동 채점
 */
export function gradeAnswer(
  answer: StudentAnswer,
  question: QuizQuestion
): GradingResult {
  if (!question.type) {
    console.warn('[AutoGrade] Question type is missing:', question);
    return {
      questionId: answer.questionId,
      isCorrect: false,
      earnedPoints: 0,
      needsReview: true,
    };
  }

  switch (question.type) {
    case 'single':
      return gradeMultipleChoice(answer, question);
    case 'multiple':
      return gradeMultipleSelect(answer, question);
    case 'short':
      return gradeShortAnswer(answer, question);
    case 'essay':
      return gradeEssay(answer, question);
    default:
      console.warn('[AutoGrade] Unknown question type:', question.type);
      return {
        questionId: answer.questionId,
        isCorrect: false,
        earnedPoints: 0,
        needsReview: true,
      };
  }
}

/**
 * 모든 답안 채점
 */
export function gradeAllAnswers(
  answers: StudentAnswer[],
  questions: QuizQuestion[]
): {
  results: GradingResult[];
  totalScore: number;
  correctCount: number;
} {
  const results: GradingResult[] = [];
  let totalScore = 0;
  let correctCount = 0;

  for (const answer of answers) {
    const question = questions.find((q) => q.id === answer.questionId);
    if (!question) {
      console.warn('[AutoGrade] Question not found for answer:', answer);
      continue;
    }

    const result = gradeAnswer(answer, question);
    results.push(result);

    if (result.isCorrect) {
      correctCount++;
    }
    totalScore += result.earnedPoints;
  }

  return { results, totalScore, correctCount };
}
