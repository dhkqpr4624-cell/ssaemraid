/**
 * 쌤퀘스트 DB 래퍼
 * 
 * 이 파일은 localStorage와 Supabase를 투명하게 전환할 수 있도록 돕습니다.
 * 환경 변수 NEXT_PUBLIC_SUPABASE_URL이 설정되어 있으면 Supabase를 우선 사용합니다.
 */

import * as localStorageDB from './class-storage';
import * as supabaseDB from './supabase';
import { getEffectiveMaxRetryAttempts } from './retry-attempts';
import { ClassRoom, Student, Quiz, StudentQuizResult, LiveQuizSession, QuizRewardOption, AvatarState, RoomState } from './types';
import { ensureDefaultAvatarItems, ensureDefaultAvatarState } from './default-avatar-items';

const isSupabaseEnabled = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// 기본 avatar_state
const DEFAULT_AVATAR_STATE = {
  skinColor: '#F2C6A0',
  eyeColor: '#5B3A29',
  equipped: {},
  baseParts: {},
  animationState: 'idle',
  facing: 'front'
};

// 기본 room_state
const DEFAULT_ROOM_STATE = {
  background: null,
  floor: null,
  placedItems: [],
  playerPosition: { x: 3, y: 3, facing: 'front', isMoving: false }
};

function stableRewardId(reward: any, index: number) {
  const rawName = String(reward?.itemName || reward?.name || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  return `reward_${index + 1}_${rawName || 'item'}`;
}

function normalizeRewardOptions(rewards: any[] | undefined | null): QuizRewardOption[] {
  return (Array.isArray(rewards) ? rewards : []).map((reward, index) => {
    const id = reward?.id || reward?.itemId || stableRewardId(reward, index);
    return {
      ...reward,
      id,
      itemId: reward?.itemId || id,
      requiredScore: Number(reward?.requiredScore ?? 0),
      itemName: String(reward?.itemName ?? `보상 ${index + 1}`),
      itemIcon: String(reward?.itemIcon || '🎁'),
      itemType: reward?.itemType || 'badge',
      itemSlot: reward?.itemSlot,
      itemDescription: reward?.itemDescription || '',
      itemImageUrl: reward?.itemImageUrl,
      itemSpriteUrl: reward?.itemSpriteUrl,
      // custom item-editor metadata. 기본 보상/기존 퀴즈에는 영향이 없고, 제작 아이템만 사용합니다.
      roomSize: reward?.roomSize,
      spriteConfig: reward?.spriteConfig,
      directionImages: reward?.directionImages,
      availableDirections: reward?.availableDirections,
      defaultDirection: reward?.defaultDirection,
      footprint: reward?.footprint,
      hairLayerMode: reward?.hairLayerMode,
      tintMaskUrl: reward?.tintMaskUrl,
      shadowImageUrl: reward?.shadowImageUrl,
      outlineImageUrl: reward?.outlineImageUrl,
      overlayImageUrl: reward?.overlayImageUrl,
      eyeShadowImageUrl: reward?.eyeShadowImageUrl,
      underTintMaskUrl: reward?.underTintMaskUrl,
      underShadowImageUrl: reward?.underShadowImageUrl,
      underOutlineImageUrl: reward?.underOutlineImageUrl,
      upperTintMaskUrl: reward?.upperTintMaskUrl,
      upperShadowImageUrl: reward?.upperShadowImageUrl,
      upperOutlineImageUrl: reward?.upperOutlineImageUrl,
    } as QuizRewardOption & Record<string, any>;
  });
}
// 학생 데이터 정규화 함수
function normalizeRoomInventoryItem(item: any) {
  if (!item || item.type !== 'room') return item;
  const roomSize = item.roomSize;
  const fallbackFootprint = roomSize === '640x640'
    ? { w: 4, h: 4 }
    : roomSize === '480x480'
      ? { w: 3, h: 3 }
      : roomSize === '320x320'
        ? { w: 2, h: 2 }
        : roomSize === '640x160'
          ? { w: 4, h: 1 }
          : roomSize === '480x160'
            ? { w: 3, h: 1 }
            : roomSize === '320x160'
              ? { w: 2, h: 1 }
              : { w: 1, h: 1 };
  return {
    ...item,
    roomSize,
    footprint: item.footprint || fallbackFootprint,
    availableDirections: item.availableDirections || (item.directionImages ? Object.keys(item.directionImages) : undefined),
    defaultDirection: item.defaultDirection || item.availableDirections?.[0] || (item.directionImages ? Object.keys(item.directionImages)[0] : undefined),
  };
}

function getInventoryItemKey(item: any): string | null {
  const key = item?.catalogItemId || item?.itemId || item?.id;
  return key ? String(key) : null;
}

function isDuplicateRestrictedInventoryItem(item: any): boolean {
  return !!item && item.type !== 'room';
}

function dedupeInventoryItems(items: any[] = []): any[] {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const item of items || []) {
    const normalized = normalizeRoomInventoryItem(item);
    const key = getInventoryItemKey(normalized);
    if (isDuplicateRestrictedInventoryItem(normalized) && key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(normalized);
  }
  return result;
}

function normalizeStudentItems(items: any[] = []): any[] {
  return dedupeInventoryItems(ensureDefaultAvatarItems(items || []));
}

async function persistSupabaseInventoryDedupe(row: any): Promise<any> {
  const before = Array.isArray(row?.items) ? row.items : [];
  const after = dedupeInventoryItems(before);
  if (row?.id && after.length !== before.length) {
    const { data, error } = await supabaseDB.supabase
      .from('students')
      .update({ items: after })
      .eq('id', row.id)
      .select()
      .single();
    if (!error && data) return data;
  }
  return row;
}

function normalizeStudent(data: any) {
  const rawAvatarState = typeof data.avatar_state === 'object' ? data.avatar_state : {};
  const normalizedItems = normalizeStudentItems(data.items || []);
  return {
    id: data.id,
    classId: data.class_code,
    attendanceNumber: data.attendance_number,
    nickname: `학생${data.attendance_number}`,
    score: data.score || 0,
    coins: 0,
    items: normalizedItems,
    avatarState: ensureDefaultAvatarState({
      ...DEFAULT_AVATAR_STATE,
      ...rawAvatarState,
    }),
    roomState: {
      ...DEFAULT_ROOM_STATE,
      ...(typeof data.room_state === 'object' ? data.room_state : {})
    },
    avatarId: 'default',
    roomDecorations: [],
  };
}

// --- 클래스 관련 ---

export async function findClassByCode(code: string): Promise<ClassRoom | null> {
  if (isSupabaseEnabled) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const data = await supabaseDB.getSupabaseClass(normalizedCode);
    if (!data) return null;
    return {
      id: data.id,
      name: data.class_name || '클래스',
      code: data.class_code,
      teacherPassword: data.teacher_password,
      studentCount: data.student_count,
      createdAt: data.created_at,
      lastAccessedAt: data.created_at
    };
  }
  return localStorageDB.findClassByCode(String(code || '').trim().toUpperCase());
}

export async function createClass(className: string, studentCount: number, teacherPassword: string) {
  if (isSupabaseEnabled) {
    try {
      const data = await supabaseDB.createSupabaseClass(className, teacherPassword, studentCount);
      const classroom: ClassRoom = {
        id: data.id,
        name: data.class_name || className,
        code: data.class_code,
        teacherPassword: data.teacher_password,
        studentCount: data.student_count,
        createdAt: data.created_at,
        lastAccessedAt: data.created_at
      };
      return { success: true, classroom };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
  return localStorageDB.createClass(className, studentCount, teacherPassword);
}


export async function deleteClass(classCode: string) {
  if (isSupabaseEnabled) {
    try {
      const { error } = await supabaseDB.supabase
        .from('classes')
        .delete()
        .eq('class_code', classCode);
      if (error) throw error;

      if (typeof window !== 'undefined') {
        const recent = JSON.parse(localStorage.getItem('recentTeacherClasses') || '[]');
        localStorage.setItem('recentTeacherClasses', JSON.stringify(recent.filter((c: any) => c.code !== classCode)));
      }
      return { success: true };
    } catch (err: any) {
      console.error('[DB Wrapper] deleteClass error:', err);
      return { success: false, error: err.message || '클래스 삭제 중 오류가 발생했습니다.' };
    }
  }
  return localStorageDB.deleteClass(classCode);
}

export async function addStudentToClass(classCode: string, attendanceNumber?: number) {
  if (isSupabaseEnabled) {
    try {
      const { data: existing, error: listError } = await supabaseDB.supabase
        .from('students')
        .select('attendance_number')
        .eq('class_code', classCode);
      if (listError) throw listError;

      const usedNumbers = new Set((existing || []).map((s: any) => s.attendance_number));
      const targetNumber = attendanceNumber && attendanceNumber > 0
        ? attendanceNumber
        : (() => {
            let n = 1;
            while (usedNumbers.has(n)) n += 1;
            return n;
          })();

      if (usedNumbers.has(targetNumber)) {
        return { success: false, error: '이미 해당 번호의 학생이 있습니다.' };
      }

      const { data, error } = await supabaseDB.supabase
        .from('students')
        .insert([{
          class_code: classCode,
          attendance_number: targetNumber,
          score: 0,
          items: [],
          avatar_state: DEFAULT_AVATAR_STATE,
          room_state: DEFAULT_ROOM_STATE,
        }])
        .select()
        .single();
      if (error) throw error;

      const classroom = await findClassByCode(classCode);
      if (classroom && targetNumber > classroom.studentCount) {
        await supabaseDB.supabase
          .from('classes')
          .update({ student_count: targetNumber })
          .eq('class_code', classCode);
      }

      return { success: true, student: normalizeStudent(data) };
    } catch (err: any) {
      console.error('[DB Wrapper] addStudentToClass error:', err);
      return { success: false, error: err.message || '학생 추가 중 오류가 발생했습니다.' };
    }
  }
  return localStorageDB.addStudentToClass(classCode, attendanceNumber);
}

export async function deleteStudentFromClass(classCode: string, attendanceNumber: number) {
  if (isSupabaseEnabled) {
    try {
      const { error } = await supabaseDB.supabase
        .from('students')
        .delete()
        .eq('class_code', classCode)
        .eq('attendance_number', attendanceNumber);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('[DB Wrapper] deleteStudentFromClass error:', err);
      return { success: false, error: err.message || '학생 삭제 중 오류가 발생했습니다.' };
    }
  }
  return localStorageDB.deleteStudentFromClass(classCode, attendanceNumber);
}

// --- 학생 관련 ---

export async function findStudent(classCode: string, attendanceNumber: number) {
  if (isSupabaseEnabled) {
    const data = await supabaseDB.getSupabaseStudent(classCode, attendanceNumber);
    if (!data) return { success: false, error: '학생을 찾을 수 없습니다.' };
    const migrated = await persistSupabaseInventoryDedupe(data);
    return { 
      success: true, 
      student: normalizeStudent(migrated) as any
    };
  }
  return localStorageDB.findStudent(classCode, attendanceNumber);
}

/**
 * 교사용 전체 학생 목록 조회
 * (1번부터 끝번까지 모든 학생 정보를 정규화하여 반환)
 */
export async function getStudentsByClassCode(classCode: string) {
  if (isSupabaseEnabled) {
    try {
      const classroom = await findClassByCode(classCode);
      if (!classroom) return [];
      
      const { data, error } = await supabaseDB.supabase
        .from('students')
        .select('*')
        .eq('class_code', classCode)
        .order('attendance_number', { ascending: true });
        
      if (error) throw error;
      
      const migratedRows = await Promise.all((data || []).map((s: any) => persistSupabaseInventoryDedupe(s)));
      const studentMap = new Map();
      migratedRows.forEach((s: any) => studentMap.set(s.attendance_number, s));
      
      const fullList = [];
      for (let i = 1; i <= classroom.studentCount; i++) {
        const s = studentMap.get(i);
        if (s) {
          fullList.push(normalizeStudent(s));
        } else {
          // 입장 전 학생 가상 데이터
          fullList.push({
            id: `virtual-${i}`,
            classId: classCode,
            attendanceNumber: i,
            nickname: `학생${i}`,
            score: 0,
            coins: 0,
            items: [],
            isVirtual: true // 입장 전 표시용
          });
        }
      }
      return fullList;
    } catch (err) {
      console.error('[DB Wrapper] getStudentsByClassCode error:', err);
      return [];
    }
  }
  
  // LocalStorage fallback
  const classroom = localStorageDB.findClassByCode(classCode);
  if (!classroom) return [];
  const students = localStorageDB.getStudentsByClassId(classroom.id);
  const studentMap = new Map();
  students.forEach(s => studentMap.set(s.attendanceNumber, s));
  
  const fullList = [];
  for (let i = 1; i <= classroom.studentCount; i++) {
    const s = studentMap.get(i);
    fullList.push(s || {
      id: `virtual-${i}`,
      classId: classroom.id,
      attendanceNumber: i,
      nickname: `학생${i}`,
      score: 0,
      coins: 0,
      items: [],
      isVirtual: true
    });
  }
  return fullList;
}

export async function saveStudentAvatarState(
  classCode: string,
  attendanceNumber: number,
  avatarState: AvatarState,
  items?: any[]
) {
  if (isSupabaseEnabled) {
    try {
      const found = await supabaseDB.getSupabaseStudent(classCode, attendanceNumber);
      if (!found) return { success: false, error: '학생을 찾을 수 없습니다.' };
      const payload: any = { avatar_state: avatarState };
      if (items) payload.items = items;
      const { data, error } = await supabaseDB.supabase
        .from('students')
        .update(payload)
        .eq('id', found.id)
        .select()
        .single();
      if (error) throw error;
      return { success: true, student: normalizeStudent(data) };
    } catch (err: any) {
      return { success: false, error: err.message || '아바타 저장 중 오류가 발생했습니다.' };
    }
  }
  return localStorageDB.updateStudentAvatarState(classCode, attendanceNumber, avatarState);
}

export async function saveStudentRoomState(
  classCode: string,
  attendanceNumber: number,
  roomState: RoomState
) {
  if (isSupabaseEnabled) {
    try {
      const found = await supabaseDB.getSupabaseStudent(classCode, attendanceNumber);
      if (!found) return { success: false, error: '학생을 찾을 수 없습니다.' };
      const { data, error } = await supabaseDB.supabase
        .from('students')
        .update({ room_state: roomState })
        .eq('id', found.id)
        .select()
        .single();
      if (error) throw error;
      return { success: true, student: normalizeStudent(data) };
    } catch (err: any) {
      return { success: false, error: err.message || '방 저장 중 오류가 발생했습니다.' };
    }
  }
  return localStorageDB.updateRoomState(classCode, attendanceNumber, roomState);
}

export async function updateStudentStats(classCode: string, attendanceNumber: number, deltaScore: number, deltaCoins: number, reason: string) {
  if (isSupabaseEnabled) {
    const studentRes = await findStudent(classCode, attendanceNumber);
    if (!studentRes.success || !studentRes.student) return studentRes;
    
    const newScore = studentRes.student.score + deltaScore;
    await supabaseDB.updateSupabaseStudent(studentRes.student.id, { score: newScore } as any);
    return { success: true, student: { ...studentRes.student, score: newScore } };
  }
  return localStorageDB.updateStudentStats(classCode, attendanceNumber, deltaScore, deltaCoins, reason);
}

// --- 퀴즈 관련 ---

export async function getQuizzes(classCode: string) {
  if (isSupabaseEnabled) {
    const data = await supabaseDB.getSupabaseQuizzes(classCode);
    console.log('[DB Wrapper] Raw quizzes from Supabase:', data);

    return data.map((d: any) => {
      const settings = d.settings || {};
      const questions = (d.questions || []).map((q: any) => ({
        ...q,
        id: q.id || crypto.randomUUID(),
        options: q.options || [],
        correctAnswers: q.correctAnswers || [],
        shortAnswers: q.shortAnswers || [],
        points: q.points || 0,
      }));

      return {
        id: d.quiz_id,
        quiz_id: d.quiz_id,
        classId: d.class_code,
        classCode: d.class_code,
        title: d.title,
        description: d.description || '',
        totalScore: questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0),
        questions: questions,
        rewardOptions: normalizeRewardOptions(d.reward_options),
        isActive: settings.isActive !== false,
        isReviewEnabled: settings.isReviewEnabled || false,
        reviewMode: settings.reviewMode || 'same',
        allowRetry: d.allow_retry ?? settings.allowRetry ?? settings.retryOptions?.enabled ?? false,
        retryQuestionMode: settings.retryQuestionMode || settings.retryOptions?.questionMode || 'same',
        retryRewardMode: settings.retryRewardMode || settings.retryOptions?.rewardMode || 'same',
        retryRewardOptions: normalizeRewardOptions(settings.retryRewardOptions),
        maxRetryAttempts: getEffectiveMaxRetryAttempts({ ...d, settings }),
        randomPickEnabled: settings.randomPickEnabled || false,
        randomPickCount: settings.randomPickCount || 0,
        shuffleQuestionsEnabled: settings.shuffleQuestionsEnabled || false,
        retryOptions: settings.retryOptions || {},
        quizMode: settings.quizMode || 'normal',
        createdAt: d.created_at || new Date().toISOString(),
      };
    });
  }
  return localStorageDB.getQuizzesByClassCode(classCode);
}

export async function saveQuiz(quiz: any, isEditMode: boolean = false) {
  // Ensure all questions have an ID
  const processedQuiz = {
    ...quiz,
    questions: quiz.questions.map((q: any) => ({ ...q, id: q.id || crypto.randomUUID() }))
  };
  console.log('[DB Wrapper] saveQuiz called - isEditMode:', isEditMode, 'quiz_id:', quiz.quiz_id, 'classCode:', quiz.classCode);
  
  if (isSupabaseEnabled) {
    if (!quiz.classCode) {
      return { 
        success: false, 
        error: '클래스 코드가 없습니다. 교사 대시보드로 돌아가서 다시 시도해주세요.' 
      };
    }
    
    // 수정 모드: quiz_id가 있으면 update, 없으면 insert
    if (isEditMode && quiz.quiz_id) {
      console.log('[DB Wrapper] Calling updateSupabaseQuiz');
      return supabaseDB.updateSupabaseQuiz(processedQuiz);
    }
    
    console.log('[DB Wrapper] Calling saveSupabaseQuiz');
    return supabaseDB.saveSupabaseQuiz(processedQuiz);
  }
  
  if (isEditMode && quiz.quiz_id) {
    return localStorageDB.updateQuiz(quiz.quiz_id, processedQuiz);
  }
  
  return localStorageDB.createQuiz({
    title: quiz.title,
    description: quiz.description || '',
    isActive: quiz.isActive ?? true,
    isReviewEnabled: quiz.isReviewEnabled ?? false,
    reviewMode: quiz.reviewMode ?? 'same',
    questions: processedQuiz.questions,
    rewardOptions: quiz.rewardOptions,
    allowRetry: quiz.allowRetry,
    retryQuestionMode: quiz.retryQuestionMode,
    retryRewardMode: quiz.retryRewardMode,
    retryRewardOptions: quiz.retryRewardOptions,
    maxRetryAttempts: quiz.maxRetryAttempts,
    randomPickEnabled: quiz.randomPickEnabled,
    randomPickCount: quiz.randomPickCount,
    shuffleQuestionsEnabled: quiz.shuffleQuestionsEnabled,
    quizMode: quiz.quizMode || 'normal',
    curriculum: quiz.curriculum,
    grade: quiz.grade,
    semester: quiz.semester,
    subject: quiz.subject,
    unit: quiz.unit,
  } as any);
}

export async function deleteQuiz(quizId: string) {
  if (isSupabaseEnabled) {
    try {
      // Supabase cascade delete handles quiz_results and live_sessions
      const { error } = await supabaseDB.supabase
        .from('quizzes')
        .delete()
        .eq('quiz_id', quizId);
        
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('[DB Wrapper] deleteQuiz error:', err);
      return { success: false, error: err.message };
    }
  }
  
  // LocalStorage fallback
  try {
    const quizzes = localStorageDB.getAllQuizzes();
    const filtered = quizzes.filter(q => q.id !== quizId);
    localStorage.setItem('quizzes', JSON.stringify(filtered));
    
    const results = localStorageDB.getAllQuizResults();
    const filteredResults = results.filter(r => r.quizId !== quizId);
    localStorage.setItem('quiz_results', JSON.stringify(filteredResults));
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// --- 퀴즈 결과 ---

export async function submitQuizResult(result: StudentQuizResult) {
  if (isSupabaseEnabled) {
    return supabaseDB.submitSupabaseQuizResult(result);
  }
  if (typeof window !== 'undefined') {
    const allResults = localStorageDB.getAllQuizResults();
    const quiz = localStorageDB.getAllQuizzes().find(q => q.id === result.quizId);
    const studentResults = allResults
      .filter(r => r.quizId === result.quizId && r.studentId === result.studentId)
      .sort((a, b) => Number(b.attemptNumber || 1) - Number(a.attemptNumber || 1));
    const latestAttempt = Number(studentResults[0]?.attemptNumber || 0);
    const attemptNumber = Math.max(1, Math.floor(Number(result.attemptNumber || 1)));
    const maxRetries = getEffectiveMaxRetryAttempts(quiz as any);

    if (attemptNumber > maxRetries + 1) {
      return { success: false, error: `재도전 가능 횟수(${maxRetries}회)를 모두 사용했습니다.` };
    }
    if (latestAttempt === 0 && attemptNumber !== 1) {
      return { success: false, error: '첫 시도 회차가 올바르지 않습니다.' };
    }
    if (latestAttempt > 0 && (!quiz?.allowRetry || attemptNumber !== latestAttempt + 1)) {
      return { success: false, error: '이미 처리되었거나 올바르지 않은 재도전 회차입니다.' };
    }

    localStorage.setItem('quiz_results', JSON.stringify([...allResults, { ...result, attemptNumber }]));
  }
  return { success: true, data: result };
}

export async function getQuizResult(quizId: string, studentId: string) {
  if (isSupabaseEnabled) {
    return supabaseDB.getSupabaseQuizResult(quizId, studentId);
  }
  return localStorageDB.getStudentQuizResult(quizId, studentId);
}

/**
 * 특정 퀴즈의 모든 결과 조회 (교사용)
 */
export async function getQuizResults(quizId: string) {
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabaseDB.supabase
        .from('quiz_results')
        .select('*')
        .eq('quiz_id', quizId)
        .order('submitted_at', { ascending: false });
        
      if (error) throw error;
      return (data || []).map(supabaseDB.normalizeQuizResult);
    } catch (err) {
      console.error('[DB Wrapper] getQuizResults error:', err);
      return [];
    }
  }
  
  // LocalStorage fallback
  const allResults = localStorageDB.getAllQuizResults();
  return allResults.filter(r => r.quizId === quizId).sort((a, b) => 
    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export async function claimReward(
  quizId: string,
  studentId: string,
  rewardOptionId: string,
  attemptNumber?: number
) {
  if (isSupabaseEnabled) {
    return supabaseDB.claimSupabaseQuizReward(quizId, studentId, rewardOptionId, attemptNumber);
  }

  const session = localStorageDB.getStudentSession();
  if (session) {
    return localStorageDB.claimQuizReward(session.classCode, session.attendanceNumber, quizId, rewardOptionId);
  }

  return {
    success: false,
    error: '학생 세션을 찾을 수 없습니다.',
  };
}

export async function markRewardUnavailableAsClaimed(
  quizId: string,
  studentId: string,
  attemptNumber?: number
) {
  if (isSupabaseEnabled) {
    return supabaseDB.markSupabaseRewardUnavailableAsClaimed(quizId, studentId, attemptNumber);
  }

  const session = localStorageDB.getStudentSession();
  if (session) {
    return localStorageDB.markQuizRewardUnavailableAsClaimed(
      session.classCode,
      session.attendanceNumber,
      quizId,
      attemptNumber
    );
  }

  return {
    success: false,
    error: '학생 세션을 찾을 수 없습니다.',
  };
}

// --- 실시간 세션 ---

function toCamelLiveSession(row: any, classCode?: string, quizId?: string): LiveQuizSession | null {
  if (!row) return null;
  const data = row.session_data || {};
  return {
    id: row.id || data.id || `${classCode || row.class_code}_${quizId || row.quiz_id}`,
    quizId: row.quiz_id || row.quizId || data.quizId || quizId || '',
    classCode: row.class_code || row.classCode || data.classCode || classCode || '',
    status: row.status || data.status || 'waiting',
    currentQuestionIndex: Number(row.current_question_index ?? row.currentQuestionIndex ?? data.currentQuestionIndex ?? 0),
    selectedQuestionIds: row.selected_question_ids || row.selectedQuestionIds || data.selectedQuestionIds || [],
    participatingStudents: row.participating_students || row.participatingStudents || data.participatingStudents || [],
    submittedStudents: row.submitted_students || row.submittedStudents || data.submittedStudents || [],
    startedAt: row.started_at || row.startedAt || data.startedAt || row.created_at || new Date().toISOString(),
    questionStartedAt: row.question_started_at || row.questionStartedAt || data.questionStartedAt,
    timeLimitSeconds: Number(row.time_limit_seconds ?? row.timeLimitSeconds ?? data.timeLimitSeconds ?? 60),
    createdAt: row.created_at || row.createdAt || data.createdAt || new Date().toISOString(),
    ...(data || {}),
  } as any;
}


function isLiveTeacherHeartbeatFresh(session: any) {
  if (!session || session.isTeacherLiveOpen !== true) return false;
  const heartbeat = session.teacherLiveHeartbeat || session.updatedAt || session.updated_at;
  if (!heartbeat) return false;
  return Date.now() - new Date(heartbeat).getTime() < 60000;
}

function shouldExposeLiveSession(session: any) {
  if (!session || session.status === 'ended') return false;
  // 준비 화면(waiting)은 교사가 현재 화면을 열고 있을 때만 학생에게 노출합니다.
  // 문제 풀이가 이미 시작된 세션은 교사가 실수로 나갔다가 돌아와도 이어 할 수 있도록 유지합니다.
  if (session.status === 'waiting') return isLiveTeacherHeartbeatFresh(session);
  return session.isTeacherLiveOpen === true || ['question_active', 'showing_answer', 'answers_submitted', 'started'].includes(session.status);
}

function pruneLiveParticipants(session: any) {
  if (!session) return session;
  const heartbeats = session.participantHeartbeats || {};
  const now = Date.now();
  const active = (session.participatingStudents || []).filter((no: any) => {
    const beat = heartbeats[String(no)];
    if (!beat) return true;
    return now - new Date(beat).getTime() < 90000;
  }).map((no: any) => String(no));
  return {
    ...session,
    participatingStudents: active,
    submittedStudents: (session.submittedStudents || []).filter((no: any) => active.includes(String(no))),
  };
}

function toLiveSessionRow(classCode: string, quizId: string, updates: any) {
  const sessionData = {
    ...updates,
    classCode,
    quizId,
  };

  const row: any = {
    id: updates.id,
    class_code: classCode,
    quiz_id: quizId,
    status: updates.status,
    current_question_index: updates.currentQuestionIndex ?? updates.current_question_index,
    question_started_at: updates.questionStartedAt ?? updates.question_started_at,
    session_data: sessionData,
    updated_at: new Date().toISOString(),
  };
  Object.keys(row).forEach(key => row[key] === undefined && delete row[key]);
  return row;
}

export async function getLiveSession(classCode: string, quizId: string) {
  if (isSupabaseEnabled) {
    const row = await supabaseDB.getSupabaseLiveSession(classCode, quizId);
    return pruneLiveParticipants(toCamelLiveSession(row, classCode, quizId));
  }
  const sessionKey = `liveQuizSession_${classCode}_${quizId}`;
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(sessionKey);
    return data ? pruneLiveParticipants(JSON.parse(data)) : null;
  }
  return null;
}

export async function getLiveSessionsForClass(classCode: string) {
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabaseDB.supabase
        .from('live_sessions')
        .select('*')
        .eq('class_code', classCode)
        .neq('status', 'ended');
      if (error) throw error;
      return (data || [])
        .map(row => pruneLiveParticipants(toCamelLiveSession(row, classCode)))
        .filter((session: any) => shouldExposeLiveSession(session)) as LiveQuizSession[];
    } catch (err) {
      console.error('[DB Wrapper] getLiveSessionsForClass error:', err);
      return [];
    }
  }
  if (typeof window === 'undefined') return [];
  return Object.keys(localStorage)
    .filter(key => key.startsWith(`liveQuizSession_${classCode}_`))
    .map(key => {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
    })
    .map((session: any) => pruneLiveParticipants(session))
    .filter((session: any) => shouldExposeLiveSession(session));
}

export async function updateLiveSession(classCode: string, quizId: string, updates: any) {
  const existing = await getLiveSession(classCode, quizId);
  const now = new Date().toISOString();
  const merged: any = {
    id: existing?.id || updates.id || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${classCode}_${quizId}_${Date.now()}`),
    quizId,
    classCode,
    status: 'waiting',
    currentQuestionIndex: 0,
    selectedQuestionIds: [],
    participatingStudents: [],
    submittedStudents: [],
    startedAt: existing?.startedAt || now,
    createdAt: existing?.createdAt || now,
    timeLimitSeconds: 60,
    ...(existing || {}),
    ...updates,
  };

  if (isSupabaseEnabled) {
    try {
      const row = await supabaseDB.updateSupabaseLiveSession(classCode, quizId, toLiveSessionRow(classCode, quizId, merged));
      return toCamelLiveSession(row, classCode, quizId) || merged;
    } catch (err) {
      console.error('[DB Wrapper] updateLiveSession error:', err);
      return merged;
    }
  }

  const sessionKey = `liveQuizSession_${classCode}_${quizId}`;
  if (typeof window !== 'undefined') {
    localStorage.setItem(sessionKey, JSON.stringify(merged));
  }
  return merged;
}


// --- 실시간 대규모 참여 안정화: 참여자/답안은 별도 테이블을 우선 사용 ---
// 여러 학생이 동시에 같은 live_sessions row를 덮어쓰면 참여자/답안이 유실될 수 있으므로,
// 35명 이상 동시 접속 환경에서는 행 단위 upsert가 가능한 보조 테이블을 사용합니다.
// 테이블이 아직 없으면 기존 session_data 방식으로 자동 fallback합니다.
export async function upsertLiveParticipantHeartbeat(classCode: string, quizId: string, attendanceNumber: string) {
  const now = new Date().toISOString();
  if (isSupabaseEnabled) {
    try {
      const { error } = await supabaseDB.supabase
        .from('live_session_participants')
        .upsert([{ class_code: classCode, quiz_id: quizId, attendance_number: String(attendanceNumber), last_seen_at: now }], {
          onConflict: 'class_code,quiz_id,attendance_number',
        });
      if (!error) return { success: true, usedTable: true };
      console.warn('[Live Quiz] live_session_participants fallback:', error.message);
    } catch (err) {
      console.warn('[Live Quiz] live_session_participants fallback:', err);
    }
  }

  const latest: any = await getLiveSession(classCode, quizId);
  if (!latest) return { success: false, usedTable: false };
  const no = String(attendanceNumber);
  const heartbeats = { ...((latest as any).participantHeartbeats || {}), [no]: now };
  await updateLiveSession(classCode, quizId, {
    participatingStudents: Array.from(new Set([...(latest.participatingStudents || []).map(String), no])),
    participantHeartbeats: heartbeats,
  });
  return { success: true, usedTable: false };
}

export async function getLiveParticipants(classCode: string, quizId: string) {
  const cutoff = new Date(Date.now() - 90000).toISOString();
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabaseDB.supabase
        .from('live_session_participants')
        .select('attendance_number,last_seen_at')
        .eq('class_code', classCode)
        .eq('quiz_id', quizId)
        .gte('last_seen_at', cutoff)
        .order('attendance_number', { ascending: true });
      if (!error) return (data || []).map((row: any) => String(row.attendance_number));
      console.warn('[Live Quiz] getLiveParticipants fallback:', error.message);
    } catch (err) {
      console.warn('[Live Quiz] getLiveParticipants fallback:', err);
    }
  }
  const session: any = await getLiveSession(classCode, quizId);
  return (session?.participatingStudents || []).map(String);
}

export async function clearLiveParticipants(classCode: string, quizId: string) {
  if (isSupabaseEnabled) {
    try {
      await supabaseDB.supabase
        .from('live_session_participants')
        .delete()
        .eq('class_code', classCode)
        .eq('quiz_id', quizId);
    } catch (err) {
      console.warn('[Live Quiz] clearLiveParticipants skipped:', err);
    }
  }
}


export async function clearLiveAnswers(classCode: string, quizId: string) {
  if (isSupabaseEnabled) {
    try {
      await supabaseDB.supabase
        .from('live_session_answers')
        .delete()
        .eq('class_code', classCode)
        .eq('quiz_id', quizId);
    } catch (err) {
      console.warn('[Live Quiz] clearLiveAnswers skipped:', err);
    }
  }
}

export async function upsertLiveAnswer(classCode: string, quizId: string, questionIndex: number, attendanceNumber: string, answer: any) {
  const now = new Date().toISOString();
  if (isSupabaseEnabled) {
    try {
      const { error } = await supabaseDB.supabase
        .from('live_session_answers')
        .upsert([{
          class_code: classCode,
          quiz_id: quizId,
          question_index: Number(questionIndex),
          attendance_number: String(attendanceNumber),
          answer,
          submitted_at: now,
        }], { onConflict: 'class_code,quiz_id,question_index,attendance_number' });
      if (!error) return { success: true, usedTable: true };
      console.warn('[Live Quiz] live_session_answers fallback:', error.message);
    } catch (err) {
      console.warn('[Live Quiz] live_session_answers fallback:', err);
    }
  }

  const latest: any = await getLiveSession(classCode, quizId);
  if (!latest) return { success: false, usedTable: false };
  const q = String(questionIndex);
  const no = String(attendanceNumber);
  const studentAnswers = { ...((latest as any).studentAnswers || {}) };
  studentAnswers[q] = { ...(studentAnswers[q] || {}), [no]: answer };
  const submittedStudents = Array.from(new Set([...(latest.submittedStudents || []).map(String), no]));
  await updateLiveSession(classCode, quizId, { studentAnswers, submittedStudents });
  return { success: true, usedTable: false };
}

export async function getLiveAnswers(classCode: string, quizId: string, questionIndex: number) {
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabaseDB.supabase
        .from('live_session_answers')
        .select('attendance_number,answer')
        .eq('class_code', classCode)
        .eq('quiz_id', quizId)
        .eq('question_index', Number(questionIndex));
      if (!error) {
        return Object.fromEntries((data || []).map((row: any) => [String(row.attendance_number), row.answer]));
      }
      console.warn('[Live Quiz] getLiveAnswers fallback:', error.message);
    } catch (err) {
      console.warn('[Live Quiz] getLiveAnswers fallback:', err);
    }
  }
  const session: any = await getLiveSession(classCode, quizId);
  return ((session as any)?.studentAnswers || {})[String(questionIndex)] || {};
}

// --- 채점 관련 ---
export async function getPendingReviewResults(classCode: string) {
  if (isSupabaseEnabled) {
    return supabaseDB.getPendingReviewResults(classCode);
  }
  return localStorageDB.getPendingReviewResults(classCode);
}

export async function gradeEssayAnswer(
  classCode: string,
  resultId: string,
  questionId: string,
  teacherScore: number,
  teacherComment?: string
) {
  if (isSupabaseEnabled) {
    return supabaseDB.gradeSupabaseEssayAnswer(classCode, resultId, questionId, teacherScore, teacherComment);
  }
  return localStorageDB.gradeEssayAnswer(classCode, resultId, questionId, teacherScore, teacherComment);
}

// --- 교사 인증 관련 ---
export async function authenticateTeacher(classCode: string, password: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseEnabled) {
    try {
      const normalizedCode = String(classCode || '').trim().toUpperCase();
      const classroom = await supabaseDB.getSupabaseClass(normalizedCode);
      if (!classroom) {
        return { success: false, error: '클래스를 찾을 수 없습니다.' };
      }
      const isPasswordValid = await supabaseDB.comparePassword(password, classroom.teacher_password);
      if (!isPasswordValid) {
        return { success: false, error: '비밀번호가 일치하지 않습니다.' };
      }
      return { success: true };
    } catch (e: any) {
      console.error('Supabase 인증 오류:', e);
      return { success: false, error: '인증 중 오류가 발생했습니다.' };
    }
  }
  // localStorage 기반 인증
  return localStorageDB.authenticateTeacher(String(classCode || '').trim().toUpperCase(), password);
}
