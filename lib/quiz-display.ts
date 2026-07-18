import type { Quiz } from './types';

/**
 * 교사/학생 화면에 표시할 실제 출제 문항 수 라벨입니다.
 *
 * 랜덤 출제가 켜져 있고, 설정 문항 수가 전체 문항 수보다 작으면
 * 학생이 실제로 풀게 되는 문항 수를 `(랜덤)5개`처럼 표시합니다.
 */
export function getQuizQuestionCountLabel(quiz: Pick<Quiz, 'questions' | 'randomPickEnabled' | 'randomPickCount'>): string {
  const totalCount = quiz.questions?.length || 0;
  const randomCount = Number(quiz.randomPickCount || 0);

  if (quiz.randomPickEnabled && randomCount > 0 && randomCount < totalCount) {
    return `(랜덤)${randomCount}개`;
  }

  return `${totalCount}개`;
}
