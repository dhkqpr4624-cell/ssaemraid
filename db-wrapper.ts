/**
 * 학급 게임화 앱 - localStorage 기반 데이터 저장소
 *
 * 이 파일은 모든 데이터 저장/로드 함수를 제공합니다.
 * DB 연결 시에는 이 함수들의 내부 구현만 교체하면 됩니다.
 */

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  CLASSROOMS: 'classrooms',
  STUDENTS: 'students',
  QUIZZES: 'quizzes',
  QUIZ_RESULTS: 'quiz_results',
  TEACHER_SESSIONS: 'teacher_sessions',
  STUDENT_SESSION: 'student_session',
  ACTIVITY_LOGS: 'activity_logs',
} as const;

// ============================================
// Utility Functions
// ============================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error(`Failed to save to localStorage: ${key}`);
  }
}

// ============================================
// Import Types
// ============================================

import { normalizeRoomRewardItem } from './room-items-registry';
import { REWARD_FOLDER_ITEMS } from './reward-folder-items';
import type {
  ClassRoom,
  Student,
  Quiz,
  QuizQuestion,
  StudentAnswer,
  StudentQuizResult,
  QuizRewardOption,
  Item,
  ItemType,
  AvatarSlot,
  AvatarState,
  RoomState,
  TeacherClassSession,
  StudentSession,
  ActivityLog,
  QuizInput,
  ReviewMode,
  RetryQuestionMode,
  RetryRewardMode,
} from './types';


function normalizeRoomInventoryItem(item: any): any {
  if (!item || item.type !== 'room') return item;
  const roomSize = item.roomSize;
  const fallbackFootprint = roomSize === '320x320'
    ? { w: 2, h: 2 }
    : roomSize === '320x160'
      ? { w: 2, h: 1 }
      : { w: 1, h: 1 };
  return {
    ...item,
    footprint: item.footprint || fallbackFootprint,
    availableDirections: item.availableDirections || (item.directionImages ? Object.keys(item.directionImages) : undefined),
    defaultDirection: item.defaultDirection || item.availableDirections?.[0] || (item.directionImages ? Object.keys(item.directionImages)[0] : undefined),
  };
}

function normalizeStoredStudent(student: Student): Student {
  return {
    ...student,
    items: Array.isArray(student.items) ? student.items.map(normalizeRoomInventoryItem) : [],
    roomState: student.roomState || { equipped: {}, placedItems: [] },
  };
}

// ============================================
// Classroom Functions
// ============================================

export function createClass(
  className: string,
  studentCount: number,
  teacherPassword: string
): { success: boolean; classroom?: ClassRoom; students?: Student[]; error?: string } {
  if (!className.trim()) return { success: false, error: '클래스 이름을 입력해주세요.' };
  if (studentCount < 1 || studentCount > 50) {
    return { success: false, error: '학생 수는 1~50명 사이여야 합니다.' };
  }

  const classrooms = getFromStorage<ClassRoom[]>(STORAGE_KEYS.CLASSROOMS, []);
  const classId = generateId('class');
  const classCode = generateClassCode();

  const classroom: ClassRoom = {
    id: classId,
    name: className.trim(),
    code: classCode,
    teacherPassword,
    studentCount,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
  };

  classrooms.push(classroom);
  saveToStorage(STORAGE_KEYS.CLASSROOMS, classrooms);

  const students = Array.from({ length: studentCount }, (_, i) => ({
    id: generateId('student'),
    classId,
    attendanceNumber: i + 1,
    nickname: `학생${i + 1}`,
    score: 0,
    coins: 0,
    items: [],
    avatarId: '',
    avatarState: {
      skinColor: '#FDB4B4',
      equipped: {},
    } as AvatarState,
    roomState: {
      skinColor: '#FFF8DC',
      equipped: {},
    } as RoomState,
    roomDecorations: [],
  }));

  const allStudents = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  allStudents.push(...students);
  saveToStorage(STORAGE_KEYS.STUDENTS, allStudents);

  return { success: true, classroom, students };
}

function generateClassCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function findClassByCode(code: string): ClassRoom | null {
  const classrooms = getFromStorage<ClassRoom[]>(STORAGE_KEYS.CLASSROOMS, []);
  return classrooms.find(c => c.code === code) ?? null;
}

export function getRecentClasses(): ClassRoom[] {
  const sessions = getTeacherClassSessions();
  const classrooms = getFromStorage<ClassRoom[]>(STORAGE_KEYS.CLASSROOMS, []);
  return sessions
    .map(s => classrooms.find(c => c.code === s.classCode))
    .filter((c): c is ClassRoom => c !== undefined)
    .slice(0, 5);
}

export function canQuickEnterClass(classCode: string): boolean {
  const sessions = getTeacherClassSessions();
  return sessions.some(s => s.classCode === classCode);
}

export function quickEnterClass(classCode: string): boolean {
  const classroom = findClassByCode(classCode);
  if (!classroom) return false;

  const sessions = getTeacherClassSessions();
  const existingIndex = sessions.findIndex(s => s.classCode === classCode);

  const newSession: TeacherClassSession = {
    classId: classroom.id,
    classCode: classroom.code,
    className: classroom.name,
    lastAccessedAt: new Date().toISOString(),
  };

  if (existingIndex !== -1) {
    sessions[existingIndex] = newSession;
  } else {
    sessions.unshift(newSession);
  }

  saveToStorage(STORAGE_KEYS.TEACHER_SESSIONS, sessions);
  return true;
}

export function authenticateTeacher(
  classCode: string,
  password: string
): { success: boolean; classroom?: ClassRoom; error?: string } {
  const classroom = findClassByCode(classCode);
  if (!classroom) return { success: false, error: '클래스를 찾을 수 없습니다.' };

  if (classroom.teacherPassword !== password) {
    return { success: false, error: '비밀번호가 일치하지 않습니다.' };
  }

  const sessions = getTeacherClassSessions();
  const existingIndex = sessions.findIndex(s => s.classCode === classCode);

  const newSession: TeacherClassSession = {
    classId: classroom.id,
    classCode: classroom.code,
    className: classroom.name,
    lastAccessedAt: new Date().toISOString(),
  };

  if (existingIndex !== -1) {
    sessions[existingIndex] = newSession;
  } else {
    sessions.unshift(newSession);
  }

  saveToStorage(STORAGE_KEYS.TEACHER_SESSIONS, sessions);

  return { success: true, classroom };
}


export function deleteClass(classCode: string): { success: boolean; error?: string } {
  const classroom = findClassByCode(classCode);
  if (!classroom) return { success: false, error: '클래스를 찾을 수 없습니다.' };

  const classrooms = getFromStorage<ClassRoom[]>(STORAGE_KEYS.CLASSROOMS, []);
  saveToStorage(STORAGE_KEYS.CLASSROOMS, classrooms.filter(c => c.code !== classCode));

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const deletedStudentIds = new Set(students.filter(s => s.classId === classroom.id).map(s => s.id));
  saveToStorage(STORAGE_KEYS.STUDENTS, students.filter(s => s.classId !== classroom.id));

  const quizzes = getFromStorage<Quiz[]>(STORAGE_KEYS.QUIZZES, []);
  const deletedQuizIds = new Set(quizzes.filter(q => q.classCode === classCode || q.classId === classroom.id).map(q => q.id));
  saveToStorage(STORAGE_KEYS.QUIZZES, quizzes.filter(q => q.classCode !== classCode && q.classId !== classroom.id));

  const results = getFromStorage<StudentQuizResult[]>(STORAGE_KEYS.QUIZ_RESULTS, []);
  saveToStorage(
    STORAGE_KEYS.QUIZ_RESULTS,
    results.filter(r => !deletedQuizIds.has(r.quizId) && !deletedStudentIds.has(r.studentId))
  );

  const logs = getFromStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
  saveToStorage(STORAGE_KEYS.ACTIVITY_LOGS, logs.filter(l => l.classId !== classroom.id));

  const sessions = getTeacherClassSessions();
  saveToStorage(STORAGE_KEYS.TEACHER_SESSIONS, sessions.filter(s => s.classCode !== classCode));

  const studentSession = getStudentSession();
  if (studentSession?.classCode === classCode) clearStudentSession();

  if (typeof window !== 'undefined') {
    const recent = JSON.parse(localStorage.getItem('recentTeacherClasses') || '[]');
    localStorage.setItem('recentTeacherClasses', JSON.stringify(recent.filter((c: any) => c.code !== classCode)));
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`liveQuizSession_${classCode}_`)) {
        localStorage.removeItem(key);
      }
    });
  }

  return { success: true };
}

export function addStudentToClass(classCode: string, attendanceNumber?: number): { success: boolean; student?: Student; error?: string } {
  const classroom = findClassByCode(classCode);
  if (!classroom) return { success: false, error: '클래스를 찾을 수 없습니다.' };

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const classStudents = students.filter(s => s.classId === classroom.id);
  const usedNumbers = new Set(classStudents.map(s => s.attendanceNumber));
  const targetNumber = attendanceNumber && attendanceNumber > 0
    ? attendanceNumber
    : Array.from({ length: Math.max(classroom.studentCount + 1, classStudents.length + 1) }, (_, i) => i + 1).find(n => !usedNumbers.has(n)) || classroom.studentCount + 1;

  if (usedNumbers.has(targetNumber)) {
    return { success: false, error: '이미 해당 번호의 학생이 있습니다.' };
  }

  const student: Student = {
    id: generateId('student'),
    classId: classroom.id,
    attendanceNumber: targetNumber,
    nickname: `학생${targetNumber}`,
    score: 0,
    coins: 0,
    items: [],
    avatarId: '',
    avatarState: {
      skinColor: '#FDB4B4',
      equipped: {},
    } as AvatarState,
    roomState: {
      skinColor: '#FFF8DC',
      equipped: {},
    } as RoomState,
    roomDecorations: [],
  };

  students.push(student);
  saveToStorage(STORAGE_KEYS.STUDENTS, students);

  const classrooms = getFromStorage<ClassRoom[]>(STORAGE_KEYS.CLASSROOMS, []);
  const index = classrooms.findIndex(c => c.id === classroom.id);
  if (index !== -1) {
    classrooms[index].studentCount = Math.max(classrooms[index].studentCount, targetNumber);
    saveToStorage(STORAGE_KEYS.CLASSROOMS, classrooms);
  }

  return { success: true, student };
}

export function deleteStudentFromClass(classCode: string, attendanceNumber: number): { success: boolean; error?: string } {
  const classroom = findClassByCode(classCode);
  if (!classroom) return { success: false, error: '클래스를 찾을 수 없습니다.' };

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const student = students.find(s => s.classId === classroom.id && s.attendanceNumber === attendanceNumber);
  if (!student) return { success: false, error: '학생을 찾을 수 없습니다.' };

  saveToStorage(STORAGE_KEYS.STUDENTS, students.filter(s => s.id !== student.id));

  const results = getFromStorage<StudentQuizResult[]>(STORAGE_KEYS.QUIZ_RESULTS, []);
  saveToStorage(STORAGE_KEYS.QUIZ_RESULTS, results.filter(r => r.studentId !== student.id));

  const logs = getFromStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
  saveToStorage(STORAGE_KEYS.ACTIVITY_LOGS, logs.filter(l => l.studentId !== student.id));

  const session = getStudentSession();
  if (session?.studentId === student.id) clearStudentSession();

  return { success: true };
}

// ============================================
// Student Functions
// ============================================

export function findStudent(
  classCode: string,
  attendanceNumber: number
): { success: boolean; student?: Student; error?: string } {
  const classroom = findClassByCode(classCode);
  if (!classroom) return { success: false, error: '클래스를 찾을 수 없습니다.' };

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const student = students.find(
    s => s.classId === classroom.id && s.attendanceNumber === attendanceNumber
  );

  if (!student) return { success: false, error: '학생을 찾을 수 없습니다.' };

  return { success: true, student: normalizeStoredStudent(student) };
}

export function getStudentsByClassId(classId: string): Student[] {
  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  return students.filter(s => s.classId === classId).map(normalizeStoredStudent);
}

export function getStudentForSession(
  classCode: string,
  attendanceNumber: number
): StudentSession | null {
  const result = findStudent(classCode, attendanceNumber);
  if (!result.success || !result.student) return null;

  const classroom = findClassByCode(classCode);
  if (!classroom) return null;

  return {
    classCode,
    classId: classroom.id,
    className: classroom.name,
    attendanceNumber,
    studentId: result.student.id,
    nickname: result.student.nickname,
  };
}

export function saveStudentSession(session: StudentSession): void {
  saveToStorage(STORAGE_KEYS.STUDENT_SESSION, session);
}

export function getStudentSession(): StudentSession | null {
  return getFromStorage<StudentSession | null>(STORAGE_KEYS.STUDENT_SESSION, null);
}

export function clearStudentSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
  }
}

export function updateStudentStats(
  classCode: string,
  attendanceNumber: number,
  deltaScore: number,
  deltaCoins: number,
  reason: string
): { success: boolean; student?: Student; error?: string } {
  const result = findStudent(classCode, attendanceNumber);
  if (!result.success || !result.student) {
    return { success: false, error: result.error };
  }

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const index = students.findIndex(s => s.id === result.student!.id);
  if (index === -1) return { success: false, error: '학생을 찾을 수 없습니다.' };

  students[index].score += deltaScore;
  students[index].coins += deltaCoins;
  saveToStorage(STORAGE_KEYS.STUDENTS, students);

  const log: ActivityLog = {
    id: generateId('log'),
    classId: result.student.classId,
    studentId: result.student.id,
    attendanceNumber,
    studentNickname: result.student.nickname,
    type: deltaScore !== 0 && deltaCoins !== 0 ? 'both' : deltaScore !== 0 ? 'points' : 'coins',
    deltaPoints: deltaScore,
    deltaCoins,
    reason,
    createdAt: new Date().toISOString(),
  };

  const logs = getFromStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
  logs.push(log);
  saveToStorage(STORAGE_KEYS.ACTIVITY_LOGS, logs);

  return { success: true, student: students[index] };
}

export function getActivityLogs(classId: string): ActivityLog[] {
  const logs = getFromStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
  return logs.filter(l => l.classId === classId).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ============================================
// Avatar Functions
// ============================================

export function getStudentAvatarState(
  classCode: string,
  attendanceNumber: number
): AvatarState | null {
  const result = findStudent(classCode, attendanceNumber);
  if (!result.success || !result.student) return null;
  return result.student.avatarState ?? { skinColor: '#FDB4B4', equipped: {} };
}

export function updateStudentAvatarState(
  classCode: string,
  attendanceNumber: number,
  avatarState: AvatarState
): { success: boolean; student?: Student; error?: string } {
  const result = findStudent(classCode, attendanceNumber);
  if (!result.success || !result.student) {
    return { success: false, error: result.error };
  }

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const index = students.findIndex(s => s.id === result.student!.id);
  if (index === -1) return { success: false, error: '학생을 찾을 수 없습니다.' };

  students[index].avatarState = avatarState;
  saveToStorage(STORAGE_KEYS.STUDENTS, students);

  return { success: true, student: students[index] };
}

export function equipAvatarItem(
  classCode: string,
  attendanceNumber: number,
  slot: AvatarSlot,
  itemId: string
): { success: boolean; student?: Student; error?: string } {
  const result = findStudent(classCode, attendanceNumber);
  if (!result.success || !result.student) {
    return { success: false, error: result.error };
  }

  const item = result.student.items.find(i => i.id === itemId);
  if (!item) return { success: false, error: '아이템을 찾을 수 없습니다.' };

  if (item.type !== 'avatar' || item.slot !== slot) {
    return { success: false, error: '이 슬롯에 장착할 수 없는 아이템입니다.' };
  }

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const index = students.findIndex(s => s.id === result.student!.id);
  if (index === -1) return { success: false, error: '학생을 찾을 수 없습니다.' };

  if (!students[index].avatarState) {
    students[index].avatarState = { skinColor: '#FDB4B4', equipped: {} };
  }

  students[index].avatarState!.equipped[slot] = itemId;
  saveToStorage(STORAGE_KEYS.STUDENTS, students);

  return { success: true, student: students[index] };
}

export function unequipAvatarItem(
  classCode: string,
  attendanceNumber: number,
  slot: AvatarSlot
): { success: boolean; student?: Student; error?: string } {
  const result = findStudent(classCode, attendanceNumber);
  if (!result.success || !result.student) {
    return { success: false, error: result.error };
  }

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const index = students.findIndex(s => s.id === result.student!.id);
  if (index === -1) return { success: false, error: '학생을 찾을 수 없습니다.' };

  if (!students[index].avatarState) {
    students[index].avatarState = { skinColor: '#FDB4B4', equipped: {} };
  }

  delete students[index].avatarState!.equipped[slot];
  saveToStorage(STORAGE_KEYS.STUDENTS, students);

  return { success: true, student: students[index] };
}

// ============================================
// Room Functions
// ============================================

export function getRoomState(
  classCode: string,
  attendanceNumber: number
): RoomState | null {
  const result = findStudent(classCode, attendanceNumber);
  if (!result.success || !result.student) return null;
  return result.student.roomState ?? { skinColor: '#FFF8DC', equipped: {} };
}

export function updateRoomState(
  classCode: string,
  attendanceNumber: number,
  roomState: RoomState
): { success: boolean; student?: Student; error?: string } {
  const result = findStudent(classCode, attendanceNumber);
  if (!result.success || !result.student) {
    return { success: false, error: result.error };
  }

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const index = students.findIndex(s => s.id === result.student!.id);
  if (index === -1) return { success: false, error: '학생을 찾을 수 없습니다.' };

  students[index].roomState = roomState;
  saveToStorage(STORAGE_KEYS.STUDENTS, students);

  return { success: true, student: students[index] };
}

// ============================================
// Session Functions
// ============================================

export function getTeacherClassSessions(): TeacherClassSession[] {
  return getFromStorage<TeacherClassSession[]>(STORAGE_KEYS.TEACHER_SESSIONS, []);
}

// ============================================
// Quiz Functions
// ============================================

export function getAllQuizzes(): Quiz[] {
  return getFromStorage<Quiz[]>(STORAGE_KEYS.QUIZZES, []);
}

export function getQuizById(quizId: string): Quiz | null {
  const quizzes = getAllQuizzes();
  return quizzes.find(q => q.id === quizId) ?? null;
}

export function getQuizzesByClassCode(classCode: string): Quiz[] {
  const quizzes = getAllQuizzes();
  return quizzes.filter(q => q.classCode === classCode);
}

export function createQuiz(input: QuizInput): { success: boolean; quiz?: Quiz; error?: string } {
  const session = getTeacherClassSessions()[0];
  if (!session) return { success: false, error: '교사 세션이 만료되었습니다.' };

  const classroom = findClassByCode(session.classCode);
  if (!classroom) return { success: false, error: '클래스를 찾을 수 없습니다.' };

  const quizId = generateId('quiz');
  const questions = input.questions.map((q, idx) => ({
    ...q,
    id: generateId('q'),
    quizId,
    order: idx + 1,
  }));

  const totalScore = questions.reduce((sum, q) => sum + q.points, 0);

  const rewardOptions: QuizRewardOption[] = input.rewardOptions.map(opt => ({
    ...opt,
    id: generateId('reward'),
    itemId: opt.itemId || generateId('item'),
  }));

  const retryRewardOptions: QuizRewardOption[] | undefined = input.retryRewardOptions?.map(opt => ({
    ...opt,
    id: generateId('reward'),
    itemId: opt.itemId || generateId('item'),
  }));

  const quiz: Quiz = {
    id: quizId,
    classId: classroom.id,
    classCode: classroom.code,
    title: input.title.trim(),
    description: input.description.trim(),
    totalScore,
    isActive: input.isActive,
    isReviewEnabled: input.isReviewEnabled,
    reviewMode: input.reviewMode,
    createdAt: new Date().toISOString(),
    rewardOptions,
    questions,
    allowRetry: input.allowRetry ?? false,
    retryQuestionMode: input.retryQuestionMode,
    retryRewardMode: input.retryRewardMode,
    retryRewardOptions,
  };

  const quizzes = getAllQuizzes();
  quizzes.push(quiz);
  saveToStorage(STORAGE_KEYS.QUIZZES, quizzes);

  return { success: true, quiz };
}

/**
 * 퀴즈 수정 (문항 포함)
 */
export function updateQuiz(
  quizId: string,
  input: Partial<QuizInput>
): { success: boolean; quiz?: Quiz; error?: string } {
  const quizzes = getAllQuizzes();
  const index = quizzes.findIndex(q => q.id === quizId);
  if (index === -1) return { success: false, error: '퀴즈를 찾을 수 없습니다.' };

  const existing = quizzes[index];
  let updated = { ...existing };

  if (input.title !== undefined) updated.title = input.title.trim();
  if (input.description !== undefined) updated.description = input.description.trim();
  if (input.isActive !== undefined) updated.isActive = input.isActive;
  if (input.isReviewEnabled !== undefined) updated.isReviewEnabled = input.isReviewEnabled;
  if (input.reviewMode !== undefined) updated.reviewMode = input.reviewMode;

  if (input.questions !== undefined) {
    updated.questions = input.questions.map((q, idx) => ({
      ...q,
      id: generateId('q'),
      quizId,
      order: idx + 1,
    }));
    updated.totalScore = updated.questions.reduce((sum, q) => sum + q.points, 0);
  }

  if (input.rewardOptions !== undefined) {
    updated.rewardOptions = input.rewardOptions.map(opt => ({
      id: generateId('reward'),
      itemId: opt.itemId || generateId('item'),
      requiredScore: opt.requiredScore,
      itemName: opt.itemName,
      itemIcon: opt.itemIcon,
      itemImageUrl: opt.itemImageUrl,
      itemSpriteUrl: (opt as any).itemSpriteUrl,
      itemType: opt.itemType,
      itemSlot: opt.itemSlot,
      itemDescription: opt.itemDescription,
      hairLayerMode: (opt as any).hairLayerMode,
      tintMaskUrl: (opt as any).tintMaskUrl,
      shadowImageUrl: (opt as any).shadowImageUrl,
      outlineImageUrl: (opt as any).outlineImageUrl,
      overlayImageUrl: (opt as any).overlayImageUrl,
      eyeShadowImageUrl: (opt as any).eyeShadowImageUrl,
      underTintMaskUrl: (opt as any).underTintMaskUrl,
      underShadowImageUrl: (opt as any).underShadowImageUrl,
      underOutlineImageUrl: (opt as any).underOutlineImageUrl,
      upperTintMaskUrl: (opt as any).upperTintMaskUrl,
      upperShadowImageUrl: (opt as any).upperShadowImageUrl,
      upperOutlineImageUrl: (opt as any).upperOutlineImageUrl,
    } as any));
  }

  quizzes[index] = updated;
  saveToStorage(STORAGE_KEYS.QUIZZES, quizzes);

  return { success: true, quiz: updated };
}

// ============================================
// Answer Grading
// ============================================

function gradeAnswer(question: QuizQuestion, answer: Partial<StudentAnswer>): StudentAnswer {
  const base: StudentAnswer = {
    questionId: question.id,
    selectedOptions: answer.selectedOptions,
    textAnswer: answer.textAnswer,
    isAutoGraded: false,
    earnedPoints: 0,
    needsReview: false,
  };

  switch (question.type) {
    case 'single': {
      const selected = answer.selectedOptions?.[0];
      const correct = question.correctAnswers?.[0];
      if (selected === correct) base.earnedPoints = question.points;
      base.isAutoGraded = true;
      break;
    }
    case 'multiple': {
      const selected = new Set(answer.selectedOptions ?? []);
      const correct = new Set(question.correctAnswers ?? []);
      const isCorrect =
        selected.size === correct.size && [...selected].every(v => correct.has(v));
      if (isCorrect) base.earnedPoints = question.points;
      base.isAutoGraded = true;
      break;
    }
    case 'short': {
      const userText = (answer.textAnswer ?? '').trim().toLowerCase().replace(/\s+/g, '');
      const keywords = (question.shortAnswers ?? []).map(k =>
        k.trim().toLowerCase().replace(/\s+/g, '')
      );
      if (keywords.some(k => k === userText)) {
        base.earnedPoints = question.points;
      }
      base.isAutoGraded = true;
      break;
    }
    case 'essay': {
      base.isAutoGraded = false;
      base.needsReview = true;
      base.earnedPoints = 0;
      break;
    }
  }

  return base;
}

// ============================================
// Quiz Results & Rewards
// ============================================

export function getAllQuizResults(): StudentQuizResult[] {
  return getFromStorage<StudentQuizResult[]>(STORAGE_KEYS.QUIZ_RESULTS, []);
}

export function getEligibleRewards(quizId: string, score: number): QuizRewardOption[] {
  const quiz = getQuizById(quizId);
  if (!quiz) return [];
  return quiz.rewardOptions
    .filter(opt => opt.requiredScore <= score)
    .sort((a, b) => b.requiredScore - a.requiredScore);
}

export function submitQuizAnswers(
  classCode: string,
  attendanceNumber: number,
  quizId: string,
  rawAnswers: Omit<StudentAnswer, 'isAutoGraded' | 'earnedPoints' | 'needsReview'>[]
): { success: boolean; result?: StudentQuizResult; eligibleRewards?: QuizRewardOption[]; error?: string } {
  const quiz = getQuizById(quizId);
  if (!quiz) return { success: false, error: '퀴즈를 찾을 수 없습니다.' };

  const studentResult = findStudent(classCode, attendanceNumber);
  if (!studentResult.success || !studentResult.student) {
    return { success: false, error: studentResult.error };
  }

  const allResults = getAllQuizResults();
  const existingResults = allResults.filter(
    r => r.quizId === quizId && r.studentId === studentResult.student!.id
  );
  const lastResult = existingResults.length > 0 ? existingResults[existingResults.length - 1] : null;

  // 보상을 받았고 중복 참여가 불가능한 경우
  if (lastResult?.selectedRewardOptionId && !quiz.allowRetry) {
    return { success: false, error: '이미 이 퀴즈의 보상을 받았습니다.' };
  }

  const gradedAnswers: StudentAnswer[] = quiz.questions.map(question => {
    const raw = rawAnswers.find(a => a.questionId === question.id) ?? { questionId: question.id };
    return gradeAnswer(question, raw);
  });

  const autoScore = gradedAnswers.reduce((sum, a) => sum + (a.isAutoGraded ? a.earnedPoints : 0), 0);
  const pendingScore = gradedAnswers
    .filter(a => a.needsReview)
    .reduce((sum, a) => {
      const q = quiz.questions.find(q => q.id === a.questionId);
      return sum + (q?.points ?? 0);
    }, 0);

  const hasEssay = gradedAnswers.some(a => a.needsReview);
  const gradingStatus: StudentQuizResult['gradingStatus'] = hasEssay ? 'pending_review' : 'auto_complete';
  const score = autoScore;

  const baseEligibleRewards = getEligibleRewards(quizId, score);

  const attemptNumber = existingResults.length + 1;
  const isRetryAttempt = attemptNumber > 1;

  // 재도전 시 보상 옵션 결정
  let finalRewards = baseEligibleRewards;
  if (isRetryAttempt && quiz.retryRewardMode === 'different' && quiz.retryRewardOptions) {
    finalRewards = quiz.retryRewardOptions.filter(opt => opt.requiredScore <= score);
  } else if (isRetryAttempt && quiz.retryRewardMode === 'none') {
    finalRewards = [];
  }
  const eligibleIds = finalRewards.map(r => r.id);

  const newResult: StudentQuizResult = {
    id: generateId('result'),
    quizId,
    classId: quiz.classId,
    classCode,
    attendanceNumber,
    studentId: studentResult.student.id,
    score,
    autoScore,
    pendingScore,
    answers: gradedAnswers,
    eligibleRewardOptionIds: eligibleIds,
    submittedAt: new Date().toISOString(),
    gradingStatus,
    attemptNumber,
    isRetryAttempt,
  };

  allResults.push(newResult);
  saveToStorage(STORAGE_KEYS.QUIZ_RESULTS, allResults);

  return { success: true, result: newResult, eligibleRewards: finalRewards };
}

export function gradeEssayAnswer(
  _classCode: string,
  resultId: string,
  questionId: string,
  teacherScore: number,
  teacherComment: string = ''
): { success: boolean; result?: StudentQuizResult; error?: string } {
  const allResults = getAllQuizResults();
  const index = allResults.findIndex(r => r.id === resultId);
  if (index === -1) return { success: false, error: '결과를 찾을 수 없습니다.' };

  const result = allResults[index];
  const quiz = getQuizById(result.quizId);
  if (!quiz) return { success: false, error: '퀴즈를 찾을 수 없습니다.' };

  const question = quiz.questions.find(q => q.id === questionId);
  if (!question) return { success: false, error: '문항을 찾을 수 없습니다.' };

  if (teacherScore < 0 || teacherScore > question.points) {
    return { success: false, error: `점수는 0~${question.points} 사이여야 합니다.` };
  }

  const updatedAnswers = result.answers.map(a => {
    if (a.questionId !== questionId) return a;
    return {
      ...a,
      teacherScore,
      teacherComment,
      earnedPoints: teacherScore,
      needsReview: false,
    };
  });

  const allReviewed = updatedAnswers.every(a => !a.needsReview);
  const newScore = updatedAnswers.reduce((sum, a) => sum + a.earnedPoints, 0);
  const newGradingStatus: StudentQuizResult['gradingStatus'] = allReviewed ? 'fully_graded' : 'pending_review';

  const eligibleRewards = getEligibleRewards(result.quizId, newScore);
  const eligibleIds = eligibleRewards.map(r => r.id);

  const updatedResult: StudentQuizResult = {
    ...result,
    answers: updatedAnswers,
    score: newScore,
    autoScore: result.autoScore,
    pendingScore: updatedAnswers.filter(a => a.needsReview).reduce((sum, a) => {
      const q = quiz.questions.find(q => q.id === a.questionId);
      return sum + (q?.points ?? 0);
    }, 0),
    eligibleRewardOptionIds: eligibleIds,
    gradingStatus: newGradingStatus,
  };

  allResults[index] = updatedResult;
  saveToStorage(STORAGE_KEYS.QUIZ_RESULTS, allResults);

  return { success: true, result: updatedResult };
}

export function claimQuizReward(
  classCode: string,
  attendanceNumber: number,
  quizId: string,
  rewardOptionId: string
): { success: boolean; item?: Item; error?: string } {
  const allResults = getAllQuizResults();
  const resultIndex = allResults.findIndex(r =>
    r.quizId === quizId &&
    r.classCode === classCode &&
    r.attendanceNumber === attendanceNumber &&
    !r.selectedRewardOptionId
  );

  if (resultIndex === -1) {
    return { success: false, error: '퀴즈 결과를 찾을 수 없거나 이미 보상을 받았습니다.' };
  }

  const result = allResults[resultIndex];

  const quiz = getQuizById(quizId);
  if (!quiz) return { success: false, error: '퀴즈 정보를 찾을 수 없습니다.' };

  // 재도전 시 보상 옵션 결정
  let rewardOption: QuizRewardOption | undefined;
  if (result.isRetryAttempt && quiz.retryRewardMode === 'none') {
    return { success: false, error: '이 회차에는 받을 수 있는 보상이 없습니다.' };
  }
  if (result.isRetryAttempt && quiz.retryRewardMode === 'different' && quiz.retryRewardOptions) {
    rewardOption = quiz.retryRewardOptions.find(opt => opt.id === rewardOptionId);
  } else {
    rewardOption = quiz.rewardOptions.find(opt => opt.id === rewardOptionId);
  }

  if (!rewardOption) return { success: false, error: '존재하지 않는 보상 옵션입니다.' };

  const studentResult = findStudent(classCode, attendanceNumber);
  if (!studentResult.success || !studentResult.student) {
    return { success: false, error: studentResult.error };
  }

  const catalogItem = REWARD_FOLDER_ITEMS.find(item => item.id === rewardOption.itemId);
  const spriteUrl = (rewardOption as any).itemSpriteUrl || catalogItem?.imageUrl || rewardOption.itemImageUrl;
  const iconUrl = rewardOption.itemImageUrl || catalogItem?.iconUrl || spriteUrl;

  const item: Item & Record<string, any> = rewardOption.itemType === 'room'
    ? normalizeRoomRewardItem(rewardOption)
    : {
        id: rewardOption.itemId,
        itemId: rewardOption.itemId,
        catalogItemId: rewardOption.itemId,
        name: rewardOption.itemName,
        type: rewardOption.itemType,
        slot: rewardOption.itemSlot,
        icon: rewardOption.itemIcon,
        iconUrl,
        imageUrl: spriteUrl,
        hairLayerMode: (rewardOption as any).hairLayerMode || catalogItem?.hairLayerMode,
        tintMaskUrl: (rewardOption as any).tintMaskUrl || catalogItem?.tintMaskUrl,
        shadowImageUrl: (rewardOption as any).shadowImageUrl || catalogItem?.shadowImageUrl,
        outlineImageUrl: (rewardOption as any).outlineImageUrl || catalogItem?.outlineImageUrl,
        overlayImageUrl: (rewardOption as any).overlayImageUrl || catalogItem?.overlayImageUrl,
        eyeShadowImageUrl: (rewardOption as any).eyeShadowImageUrl || catalogItem?.eyeShadowImageUrl,
        occupiesSlots: (rewardOption as any).occupiesSlots || catalogItem?.occupiesSlots,
        underTintMaskUrl: (rewardOption as any).underTintMaskUrl || catalogItem?.underTintMaskUrl,
        underShadowImageUrl: (rewardOption as any).underShadowImageUrl || catalogItem?.underShadowImageUrl,
        underOutlineImageUrl: (rewardOption as any).underOutlineImageUrl || catalogItem?.underOutlineImageUrl,
        upperTintMaskUrl: (rewardOption as any).upperTintMaskUrl || catalogItem?.upperTintMaskUrl,
        upperShadowImageUrl: (rewardOption as any).upperShadowImageUrl || catalogItem?.upperShadowImageUrl,
        upperOutlineImageUrl: (rewardOption as any).upperOutlineImageUrl || catalogItem?.upperOutlineImageUrl,
        description: rewardOption.itemDescription,
        rarity: 'common',
        acquiredAt: new Date().toISOString(),
      };

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  const studentIndex = students.findIndex(s => s.id === studentResult.student!.id);
  if (studentIndex === -1) return { success: false, error: '학생을 찾을 수 없습니다.' };

  students[studentIndex].items.push(item);
  saveToStorage(STORAGE_KEYS.STUDENTS, students);

  result.selectedRewardOptionId = rewardOptionId;
  result.rewardClaimedAt = new Date().toISOString();
  allResults[resultIndex] = result;
  saveToStorage(STORAGE_KEYS.QUIZ_RESULTS, allResults);

  return { success: true, item };
}

export function getPendingReviewResults(classCode: string): StudentQuizResult[] {
  const allResults = getAllQuizResults();
  const quiz = getQuizzesByClassCode(classCode);
  const quizIds = new Set(quiz.map(q => q.id));

  return allResults.filter(
    r => quizIds.has(r.quizId) && r.gradingStatus === 'pending_review'
  );
}

export function getStudentQuizResults(
  classCode: string,
  attendanceNumber: number
): StudentQuizResult[] {
  const allResults = getAllQuizResults();
  const quiz = getQuizzesByClassCode(classCode);
  const quizIds = new Set(quiz.map(q => q.id));

  return allResults.filter(
    r => quizIds.has(r.quizId) && r.attendanceNumber === attendanceNumber
  );
}

export function getQuizResultById(resultId: string): StudentQuizResult | null {
  const allResults = getAllQuizResults();
  return allResults.find(r => r.id === resultId) ?? null;
}


// ============================================
// Additional Helper Functions
// ============================================

export function getStudentById(classCode: string, studentId: string): Student | null {
  const classroom = findClassByCode(classCode);
  if (!classroom) return null;

  const students = getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  return students.find(s => s.id === studentId && s.classId === classroom.id) ?? null;
}

export function getActiveQuizzes(classCode: string): Quiz[] {
  const quizzes = getQuizzesByClassCode(classCode);
  return quizzes.filter(q => q.isActive);
}

export function getReviewableQuizzes(classCode: string): Quiz[] {
  const quizzes = getQuizzesByClassCode(classCode);
  return quizzes.filter(q => q.isReviewEnabled);
}

export function getStudentQuizResult(quizId: string, studentId: string): StudentQuizResult | null {
  const allResults = getAllQuizResults();
  const results = allResults.filter(r => r.quizId === quizId && r.studentId === studentId);
  return results.length > 0 ? results[results.length - 1] : null;
}

export function getQuizzesByClass(classCode: string): Quiz[] {
  return getQuizzesByClassCode(classCode);
}


export function updateClassLastAccess(classCode: string): void {
  const classrooms = getFromStorage<ClassRoom[]>(STORAGE_KEYS.CLASSROOMS, []);
  const index = classrooms.findIndex(c => c.code === classCode);
  if (index !== -1) {
    classrooms[index].lastAccessedAt = new Date().toISOString();
    saveToStorage(STORAGE_KEYS.CLASSROOMS, classrooms);
  }
}


export function getSessionRecords(classId: string): any[] {
  // TODO: 세션 기록 구현 (현재는 빈 배열 반환)
  return [];
}
