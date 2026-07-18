/**
 * Mock Data for Classroom Gamification App
 * TODO: Replace with actual database queries (Supabase/PostgreSQL/Prisma)
 * 
 * 이 파일의 모든 데이터는 나중에 실제 DB로 교체해야 합니다.
 * 함수들은 async로 작성되어 있어 DB 연결 시 수정이 최소화됩니다.
 */

// ============================================
// Types - 나중에 별도 types 파일로 분리 가능
// ============================================

export interface Student {
  id: string;
  classId: string;
  attendanceNumber: number; // 출석번호
  nickname: string;
  score: number;
  coins: number;
  items: Item[];
  avatarId: string;
  roomDecorations: string[];
}

export interface Item {
  id: string;
  name: string;
  icon: string;
  type: 'avatar' | 'decoration' | 'badge';
}

export interface ClassRoom {
  id: string;
  name: string;
  code: string; // 6자리 클래스 코드
  teacherPassword: string;
  studentCount: number;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface Quiz {
  id: string;
  classId: string;
  title: string;
  questions: QuizQuestion[];
  isActive: boolean;
  createdAt: Date;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface SessionRecord {
  id: string;
  classId: string;
  sessionNumber: number;
  date: Date;
  summary: string;
  totalPointsAwarded: number;
}

// ============================================
// Mock Data
// ============================================

export const mockItems: Item[] = [
  { id: 'item-1', name: '황금 왕관', icon: '👑', type: 'avatar' },
  { id: 'item-2', name: '무지개 날개', icon: '🦋', type: 'avatar' },
  { id: 'item-3', name: '별 스티커', icon: '⭐', type: 'badge' },
  { id: 'item-4', name: '귀여운 식물', icon: '🌱', type: 'decoration' },
  { id: 'item-5', name: '책상 램프', icon: '💡', type: 'decoration' },
];

export const mockStudents: Student[] = [
  {
    id: 'student-1',
    classId: 'class-1',
    attendanceNumber: 1,
    nickname: '빛나는별',
    score: 450,
    coins: 120,
    items: [mockItems[0], mockItems[2]],
    avatarId: 'avatar-1',
    roomDecorations: ['deco-1'],
  },
  {
    id: 'student-2',
    classId: 'class-1',
    attendanceNumber: 2,
    nickname: '하늘구름',
    score: 380,
    coins: 95,
    items: [mockItems[1]],
    avatarId: 'avatar-2',
    roomDecorations: [],
  },
  {
    id: 'student-3',
    classId: 'class-1',
    attendanceNumber: 3,
    nickname: '달빛요정',
    score: 520,
    coins: 150,
    items: [mockItems[0], mockItems[3], mockItems[4]],
    avatarId: 'avatar-3',
    roomDecorations: ['deco-2', 'deco-3'],
  },
  {
    id: 'student-4',
    classId: 'class-1',
    attendanceNumber: 4,
    nickname: '바다소리',
    score: 290,
    coins: 75,
    items: [],
    avatarId: 'avatar-1',
    roomDecorations: [],
  },
  {
    id: 'student-5',
    classId: 'class-1',
    attendanceNumber: 5,
    nickname: '햇살친구',
    score: 410,
    coins: 110,
    items: [mockItems[2]],
    avatarId: 'avatar-2',
    roomDecorations: ['deco-1'],
  },
];

export const mockClassRooms: ClassRoom[] = [
  {
    id: 'class-1',
    name: '3학년 2반 수학',
    code: 'ABC123',
    teacherPassword: '1234',
    studentCount: 25,
    createdAt: new Date('2024-03-01'),
    lastAccessedAt: new Date('2024-03-15'),
  },
  {
    id: 'class-2',
    name: '4학년 1반 과학',
    code: 'XYZ789',
    teacherPassword: '5678',
    studentCount: 28,
    createdAt: new Date('2024-02-15'),
    lastAccessedAt: new Date('2024-03-14'),
  },
];

export const mockQuizzes: Quiz[] = [
  {
    id: 'quiz-1',
    classId: 'class-1',
    title: '덧셈 퀴즈',
    isActive: true,
    createdAt: new Date('2024-03-15'),
    questions: [
      {
        id: 'q-1',
        question: '5 + 3 = ?',
        options: ['6', '7', '8', '9'],
        correctAnswer: 2,
      },
      {
        id: 'q-2',
        question: '12 + 7 = ?',
        options: ['17', '18', '19', '20'],
        correctAnswer: 2,
      },
    ],
  },
];

export const mockSessionRecords: SessionRecord[] = [
  {
    id: 'session-1',
    classId: 'class-1',
    sessionNumber: 1,
    date: new Date('2024-03-13'),
    summary: '덧셈과 뺄셈 기초',
    totalPointsAwarded: 450,
  },
  {
    id: 'session-2',
    classId: 'class-1',
    sessionNumber: 2,
    date: new Date('2024-03-14'),
    summary: '곱셈 시작하기',
    totalPointsAwarded: 380,
  },
];

// ============================================
// Data Access Functions
// TODO: 이 함수들을 실제 DB 쿼리로 교체
// ============================================

/**
 * 클래스 코드로 클래스 찾기
 * TODO: Replace with Supabase query
 */
export async function findClassByCode(code: string): Promise<ClassRoom | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockClassRooms.find(c => c.code === code) || null;
}

/**
 * 교사 인증
 * TODO: Replace with proper authentication
 */
export async function authenticateTeacher(
  code: string,
  password: string
): Promise<ClassRoom | null> {
  const classroom = await findClassByCode(code);
  if (classroom && classroom.teacherPassword === password) {
    return classroom;
  }
  return null;
}

/**
 * 학생 입장
 * TODO: Replace with Supabase query
 */
export async function findStudent(
  classCode: string,
  attendanceNumber: number
): Promise<Student | null> {
  const classroom = await findClassByCode(classCode);
  if (!classroom) return null;
  
  return mockStudents.find(
    s => s.classId === classroom.id && s.attendanceNumber === attendanceNumber
  ) || null;
}

/**
 * 클래스의 모든 학생 조회
 * TODO: Replace with Supabase query
 */
export async function getStudentsByClassId(classId: string): Promise<Student[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockStudents.filter(s => s.classId === classId);
}

/**
 * 새 클래스 생성
 * TODO: Replace with Supabase insert
 */
export async function createClass(
  name: string,
  studentCount: number,
  teacherPassword: string
): Promise<ClassRoom> {
  // Generate random 6-character code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const newClass: ClassRoom = {
    id: `class-${Date.now()}`,
    name,
    code,
    teacherPassword,
    studentCount,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
  };
  
  // In real implementation, this would insert into database
  mockClassRooms.push(newClass);
  
  return newClass;
}

/**
 * 최근 접속한 클래스 목록 (로컬 스토리지 기반)
 * TODO: Replace with user-specific database query
 */
export function getRecentClasses(): ClassRoom[] {
  // In real implementation, this would fetch from user's history in DB
  return mockClassRooms.slice(0, 5);
}

/**
 * 클래스의 세션 기록 조회
 * TODO: Replace with Supabase query
 */
export async function getSessionRecords(classId: string): Promise<SessionRecord[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockSessionRecords.filter(s => s.classId === classId);
}

/**
 * 클래스의 활성 퀴즈 조회
 * TODO: Replace with Supabase query
 */
export async function getActiveQuizzes(classId: string): Promise<Quiz[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockQuizzes.filter(q => q.classId === classId && q.isActive);
}
