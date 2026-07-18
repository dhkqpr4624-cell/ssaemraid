export type BossCatalogEntry = {
  id: string;
  name: string;
  grade: number;
  semester: 1 | 2;
  unit: 1 | 2 | 3;
  subject: 'social';
  enabled: boolean;
  subtitle: string;
  description: string;
  maxPlayers: number;
  accent: string;
};

const READY_BOSS: BossCatalogEntry = {
  id: 'corrupted-haetae',
  name: '타락한 해태',
  grade: 5,
  semester: 1,
  unit: 3,
  subject: 'social',
  enabled: true,
  subtitle: '5학년 1학기 사회 3단원 전체 퀴즈',
  description: '법과 인권 단원의 문제를 함께 풀며 타락한 해태를 물리치는 최대 40인 협동 보스전입니다.',
  maxPlayers: 40,
  accent: '법 · 인권',
};

export const BOSS_CATALOG: BossCatalogEntry[] = Array.from({ length: 4 }, (_, gradeIndex) => gradeIndex + 3)
  .flatMap((grade) => ([1, 2] as const).flatMap((semester) => ([1, 2, 3] as const).map((unit) => {
    if (grade === 5 && semester === 1 && unit === 3) return READY_BOSS;
    return {
      id: `social-${grade}-${semester}-${unit}-coming-soon`,
      name: '준비 중',
      grade,
      semester,
      unit,
      subject: 'social' as const,
      enabled: false,
      subtitle: `${grade}학년 ${semester}학기 사회 ${unit}단원`,
      description: '해당 단원의 보스전은 현재 준비 중입니다.',
      maxPlayers: 40,
      accent: 'COMING SOON',
    };
  })));

export const DEFAULT_BOSS_ID = READY_BOSS.id;

export function getBossById(id?: string | null) {
  return BOSS_CATALOG.find((boss) => boss.id === id) ?? READY_BOSS;
}
