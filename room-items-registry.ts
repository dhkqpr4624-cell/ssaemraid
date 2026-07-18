export type RewardGrade = '3' | '4' | '5' | '6';
export type RewardSemester = '1' | '2';
export type RewardSubject = 'math' | 'science' | 'social' | 'practical';

export interface RewardCategoryMeta {
  grade?: RewardGrade | string;
  semester?: RewardSemester | string;
  subject?: RewardSubject | string;
  unit?: string;
}

export interface RewardUnitCategory {
  id: string;
  name: string;
}

export const REWARD_GRADE_OPTIONS: RewardUnitCategory[] = [
  { id: '3', name: '3학년' },
  { id: '4', name: '4학년' },
  { id: '5', name: '5학년' },
  { id: '6', name: '6학년' },
];

export const REWARD_SEMESTER_OPTIONS: RewardUnitCategory[] = [
  { id: '1', name: '1학기' },
  { id: '2', name: '2학기' },
];

export const REWARD_SUBJECT_OPTIONS: RewardUnitCategory[] = [
  { id: 'math', name: '수학' },
  { id: 'science', name: '과학' },
  { id: 'social', name: '사회' },
];

export const PRACTICAL_SUBJECT_OPTION: RewardUnitCategory = { id: 'practical', name: '실과' };

// 단원은 이곳에 한 줄씩 추가하면 보상 검색 필터에 자동으로 나타납니다.
// 예: { grade: '5', semester: '1', subject: 'math', id: '5-1-math-1', name: '1. 약수와 배수' },
export const REWARD_UNIT_CATEGORIES: Array<RewardCategoryMeta & RewardUnitCategory> = [
  { grade: '5', semester: '1', subject: 'social', id: '5-1-social-2', name: '2단원' },
];

export function getRewardSubjectsForGrade(grade?: string): RewardUnitCategory[] {
  const subjects = [...REWARD_SUBJECT_OPTIONS];
  if (grade === '5' || grade === '6') subjects.push(PRACTICAL_SUBJECT_OPTION);
  return subjects;
}

export function getRewardUnits(filter: RewardCategoryMeta): RewardUnitCategory[] {
  return REWARD_UNIT_CATEGORIES.filter(unit =>
    (!filter.grade || unit.grade === filter.grade) &&
    (!filter.semester || unit.semester === filter.semester) &&
    (!filter.subject || unit.subject === filter.subject)
  );
}

export function getRewardCategoryMeta(item: any): RewardCategoryMeta {
  const curriculum = item?.curriculum || item?.rewardCategory || item?.categoryMeta || {};
  return {
    grade: item?.grade ?? curriculum.grade,
    semester: item?.semester ?? curriculum.semester,
    subject: item?.subject ?? curriculum.subject,
    unit: item?.unit ?? curriculum.unit,
  };
}

export function matchesRewardCategoryFilter(item: any, filter: RewardCategoryMeta): boolean {
  if (!filter.grade && !filter.semester && !filter.subject && !filter.unit) return true;
  const meta = getRewardCategoryMeta(item);
  return (!filter.grade || meta.grade === filter.grade) &&
    (!filter.semester || meta.semester === filter.semester) &&
    (!filter.subject || meta.subject === filter.subject) &&
    (!filter.unit || meta.unit === filter.unit);
}
