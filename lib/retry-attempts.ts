import type { Quiz, StudentQuizResult } from './types';

function toPositiveInteger(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * 현재 퀴즈 설정 기준의 최대 재도전 횟수입니다.
 * 학생 결과에 저장된 과거 제한값이 아니라, 교사가 수정한 최신 퀴즈 설정을 기준으로 계산합니다.
 */
export function getEffectiveMaxRetryAttempts(quiz: Quiz | any): number {
  return (
    toPositiveInteger(quiz?.maxRetryAttempts) ??
    toPositiveInteger(quiz?.settings?.maxRetryAttempts) ??
    toPositiveInteger(quiz?.retryOptions?.maxAttempts) ??
    toPositiveInteger(quiz?.settings?.retryOptions?.maxAttempts) ??
    1
  );
}

export function getResultAttemptNumber(result: StudentQuizResult | null | undefined): number {
  return Math.max(1, Math.floor(Number(result?.attemptNumber || 1)));
}

/**
 * 첫 시도는 1회차이고, maxRetryAttempts는 추가 재도전 횟수입니다.
 * 예: maxRetryAttempts=8이면 총 9회차까지 가능하므로 현재 3회차 학생은 6회 더 가능합니다.
 */
export function canRetryQuizNow(quiz: Quiz | any, result: StudentQuizResult | null | undefined): boolean {
  const retryEnabled = Boolean(quiz?.allowRetry ?? quiz?.settings?.allowRetry ?? quiz?.retryOptions?.enabled ?? quiz?.settings?.retryOptions?.enabled);
  if (!retryEnabled || !result) return false;
  return getResultAttemptNumber(result) < getEffectiveMaxRetryAttempts(quiz) + 1;
}

export function getRemainingRetryAttempts(quiz: Quiz | any, result: StudentQuizResult | null | undefined): number {
  if (!result) return getEffectiveMaxRetryAttempts(quiz);
  return Math.max(0, getEffectiveMaxRetryAttempts(quiz) + 1 - getResultAttemptNumber(result));
}
