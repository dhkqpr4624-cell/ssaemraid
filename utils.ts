'use client';

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import type { Quiz, LiveQuizSession, StudentQuizResult, Student, Item, QuizRewardOption } from './types';
import { DEFAULT_AVATAR_ITEMS, ensureDefaultAvatarState } from './default-avatar-items';
import { normalizeRoomRewardItem } from './room-items-registry';
import { REWARD_FOLDER_ITEMS } from './reward-folder-items';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 환경 변수 검증
if (typeof window !== 'undefined') {
  console.log('[Supabase Init] URL:', supabaseUrl ? '✓ Set' : '✗ Not set');
  console.log('[Supabase Init] Key:', supabaseAnonKey ? '✓ Set' : '✗ Not set');
}

// Supabase 클라이언트 초기화
let supabase: any;

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    if (typeof window !== 'undefined') {
      console.log('[Supabase] Client initialized with real credentials');
    }
  } else {
    // 더미 클라이언트 (개발/테스트용)
    supabase = createClient('https://dummy.supabase.co', 'dummy-key');
    if (typeof window !== 'undefined') {
      console.warn('[Supabase] Using dummy client - environment variables not set');
    }
  }
} catch (err) {
  console.error('[Supabase] Initialization error:', err);
  supabase = createClient('https://dummy.supabase.co', 'dummy-key');
}

export { supabase };

// --- DB Wrapper Functions ---

// 1. 클래스 관련
export async function getSupabaseClass(classCode: string) {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('class_code', classCode)
      .single();
    
    if (error) {
      console.error('[Supabase] getSupabaseClass error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase] getSupabaseClass exception:', err);
    return null;
  }
}

export async function createSupabaseClass(className: string, teacherPassword: string, studentCount: number) {
  try {
    const hashedPassword = await bcrypt.hash(teacherPassword, 10);
    
    // 클래스 코드 생성 (6자리 랜덤)
    const classCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    console.log('[Supabase] Creating class:', { classCode, className, studentCount });
    
    const { data, error } = await supabase
      .from('classes')
      .insert([{ 
        class_code: classCode, 
        class_name: className, 
        teacher_password: hashedPassword, 
        student_count: studentCount 
      }])
      .select()
      .single();
    
    if (error) {
      console.error('[Supabase] createSupabaseClass insert error:', error);
      throw new Error(`클래스 생성 실패: ${error.message}`);
    }
    
    console.log('[Supabase] Class created successfully:', data);
    
    // 학생 자동 생성 (기본 avatar_state, room_state 포함)
    const DEFAULT_AVATAR_STATE = {
      skinColor: '#F2C6A0',
      eyeColor: '#5B3A29',
      equipped: {},
      baseParts: {},
      animationState: 'idle',
      facing: 'front'
    };
    
    const DEFAULT_ROOM_STATE = {
      background: null,
      floor: null,
      placedItems: [],
      playerPosition: { x: 3, y: 3, facing: 'front', isMoving: false }
    };
    
    const students = Array.from({ length: studentCount }, (_, i) => ({
      class_code: classCode,
      attendance_number: i + 1,
      score: 0,
      items: DEFAULT_AVATAR_ITEMS,
      avatar_state: ensureDefaultAvatarState(DEFAULT_AVATAR_STATE),
      room_state: DEFAULT_ROOM_STATE
    }));
    
    const { error: studentError } = await supabase
      .from('students')
      .insert(students);
    
    if (studentError) {
      console.error('[Supabase] Student creation error:', studentError);
      throw new Error(`학생 생성 실패: ${studentError.message}`);
    }
    
    console.log('[Supabase] Students created successfully');
    
    return data;
  } catch (err: any) {
    console.error('[Supabase] createSupabaseClass exception:', err);
    throw err;
  }
}

export async function createSupabaseStudents(classCode: string, studentCount: number) {
  try {
    const students = Array.from({ length: studentCount }, (_, i) => ({
      class_code: classCode,
      attendance_number: i + 1,
      score: 0,
      items: DEFAULT_AVATAR_ITEMS,
      avatar_state: ensureDefaultAvatarState({}),
      room_state: {}
    }));
    
    const { data, error } = await supabase
      .from('students')
      .insert(students)
      .select();
    
    if (error) {
      console.error('[Supabase] createSupabaseStudents error:', error);
      throw error;
    }
    return data;
  } catch (err) {
    console.error('[Supabase] createSupabaseStudents exception:', err);
    throw err;
  }
}

// 2. 학생 관련
export async function getSupabaseStudent(classCode: string, attendanceNumber: number) {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_code', classCode)
      .eq('attendance_number', attendanceNumber)
      .single();
    
    if (error) {
      console.error('[Supabase] getSupabaseStudent error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase] getSupabaseStudent exception:', err);
    return null;
  }
}

export async function updateSupabaseStudent(id: string, updates: Partial<Student>) {
  try {
    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[Supabase] updateSupabaseStudent error:', error);
      throw error;
    }
    return data;
  } catch (err) {
    console.error('[Supabase] updateSupabaseStudent exception:', err);
    throw err;
  }
}

// 3. 퀴즈 관련
export async function getSupabaseQuizzes(classCode: string) {
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('class_code', classCode);

    if (error) {
      console.error('[Supabase] getSupabaseQuizzes error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Supabase] getSupabaseQuizzes exception:', err);
    return [];
  }
}

function stableRewardId(reward: any, index: number) {
  const rawName = String(reward?.itemName || reward?.name || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  return `reward_${index + 1}_${rawName || 'item'}`;
}

function normalizeRewardOptionsForStorage(rewards: any[] | undefined | null): QuizRewardOption[] {
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
    } as QuizRewardOption & Record<string, any>;
  });
}
function getRetryRewardModeFromSettings(settings: any): 'same' | 'different' | 'none' {
  return settings?.retryRewardMode || settings?.retryOptions?.rewardMode || 'same';
}

function getRewardOptionsForAttemptFromQuizRow(quizRow: any, attemptNumber?: number): QuizRewardOption[] {
  const settings = quizRow?.settings || {};
  const isRetryAttempt = (attemptNumber || 1) > 1;

  if (!isRetryAttempt) {
    return normalizeRewardOptionsForStorage(quizRow?.reward_options || []);
  }

  const retryRewardMode = getRetryRewardModeFromSettings(settings);

  if (retryRewardMode === 'none') return [];

  if (retryRewardMode === 'different') {
    return normalizeRewardOptionsForStorage(settings?.retryRewardOptions || []);
  }

  return normalizeRewardOptionsForStorage(quizRow?.reward_options || []);
}

function buildQuizPayload(quiz: Quiz) {
  const quizId = quiz.quiz_id || quiz.id || crypto.randomUUID();

  if (!quizId) throw new Error('quiz_id를 생성할 수 없습니다.');
  if (!quiz.classCode) throw new Error('classCode가 없습니다.');
  if (!quiz.title) throw new Error('title이 없습니다.');

  return {
    quiz_id: quizId,
    class_code: quiz.classCode,
    title: quiz.title,
    description: quiz.description || '',
    questions: quiz.questions || [],
    reward_options: normalizeRewardOptionsForStorage(quiz.rewardOptions),
    allow_retry: quiz.allowRetry || false,
    settings: {
      isActive: quiz.isActive !== false,
      isReviewEnabled: quiz.isReviewEnabled || false,
      reviewMode: quiz.reviewMode || 'same',
      randomPickEnabled: quiz.randomPickEnabled || false,
      randomPickCount: quiz.randomPickCount || 0,
      shuffleQuestionsEnabled: quiz.shuffleQuestionsEnabled || false,
      retryQuestionMode: quiz.retryQuestionMode || quiz.retryOptions?.questionMode || 'same',
      retryRewardMode: quiz.retryRewardMode || quiz.retryOptions?.rewardMode || 'same',
      retryRewardOptions: normalizeRewardOptionsForStorage(quiz.retryRewardOptions),
      retryOptions: {
        enabled: quiz.allowRetry || false,
        questionMode: quiz.retryQuestionMode || quiz.retryOptions?.questionMode || 'same',
        rewardMode: quiz.retryRewardMode || quiz.retryOptions?.rewardMode || 'same',
      },
      quizMode: quiz.quizMode || 'normal',
    },
  };
}

export async function saveSupabaseQuiz(quiz: Quiz) {
  try {
    const payload = buildQuizPayload(quiz);

    console.log('[Supabase] saveSupabaseQuiz payload:', payload);

    const { data, error } = await supabase
      .from('quizzes')
      .upsert([payload], { onConflict: 'quiz_id' })
      .select()
      .single();

    if (error) {
      console.error('[Supabase] saveSupabaseQuiz error:', error);
      console.error('[Supabase] Failed payload:', payload);
      throw error;
    }
    console.log('[Supabase] saveSupabaseQuiz success:', data);
    return { success: true, data };
  } catch (err: any) {
    console.error('[Supabase] saveSupabaseQuiz exception:', err);
    return { success: false, error: err.message };
  }
}

// 퀴즈 수정 (Supabase update)
export async function updateSupabaseQuiz(quiz: Quiz) {
  try {
    const quizId = quiz.quiz_id || quiz.id;
    if (!quizId) throw new Error("quiz_id가 없습니다.");

    const payload = buildQuizPayload({ ...quiz, id: quizId, quiz_id: quizId });

    console.log("[Supabase] updateSupabaseQuiz payload:", payload);

    const { data, error } = await supabase
      .from("quizzes")
      .update(payload)
      .eq("quiz_id", quizId)
      .select()
      .single();

    if (error) {
      console.error("[Supabase] updateSupabaseQuiz error:", error);
      console.error("[Supabase] Failed payload:", payload);
      throw error;
    }
    console.log("[Supabase] updateSupabaseQuiz success:", data);
    return { success: true, data };
  } catch (err: any) {
    console.error("[Supabase] updateSupabaseQuiz exception:", err);
    return { success: false, error: err.message };
  }
}

export function normalizeQuizResult(data: any): StudentQuizResult {
  const attemptNumber = data.attempt_number || 1;
  return {
    id: data.id,
    quizId: data.quiz_id,
    classId: data.class_code || '',
    classCode: data.class_code || '',
    attendanceNumber: data.attendance_number || 0,
    studentId: data.student_id,
    score: data.score || 0,
    autoScore: data.auto_score ?? data.score ?? 0,
    pendingScore: data.pending_score || 0,
    answers: Array.isArray(data.answers)
      ? data.answers
      : Object.entries(data.answers || {}).map(([questionId, value]: [string, any]) => ({
          questionId,
          selectedOptions: value?.selectedOptions || [],
          textAnswer: value?.textAnswer || '',
          isAutoGraded: Boolean(value?.isAutoGraded),
          earnedPoints: Number(value?.earnedPoints || 0),
          needsReview: Boolean(value?.needsReview),
          teacherScore: value?.teacherScore,
          teacherComment: value?.teacherComment,
        })),
    eligibleRewardOptionIds: data.eligible_reward_option_ids || [],
    selectedRewardOptionId: data.selected_reward_option_id || data.selected_reward || undefined,
    submittedAt: data.submitted_at || data.updated_at || data.created_at,
    rewardClaimedAt: data.reward_claimed_at || undefined,
    gradingStatus: data.grading_status || 'auto_complete',
    attemptNumber,
    isRetryAttempt: data.is_retry_attempt || attemptNumber > 1,
    rewardClaimedPerAttempt: data.reward_claimed_per_attempt || {},
    totalScore: data.total_score || 0,
    isCompleted: data.is_completed ?? true,
    correctCount: data.correct_count || 0,
    totalCount: data.total_count || 0,
    questionSnapshot: data.question_snapshot || [],
  };
}

// 퀴즈 결과 관련
export async function submitSupabaseQuizResult(result: StudentQuizResult) {
  try {
    const attemptNumber = result.attemptNumber || 1;

    const payload = {
      quiz_id: result.quizId,
      student_id: result.studentId,
      class_code: result.classCode || null,
      attendance_number: result.attendanceNumber || null,
      score: result.score,
      auto_score: result.autoScore || result.score || 0,
      pending_score: result.pendingScore || 0,
      total_score: result.totalScore || 0,
      answers: result.answers || [],
      is_completed: result.isCompleted ?? true,
      selected_reward: result.selectedRewardOptionId || null,
      selected_reward_option_id: result.selectedRewardOptionId || null,
      eligible_reward_option_ids: result.eligibleRewardOptionIds || [],
      grading_status: result.gradingStatus || 'auto_complete',
      submitted_at: result.submittedAt || new Date().toISOString(),
      correct_count: result.correctCount || 0,
      total_count: result.totalCount || 0,
      attempt_number: attemptNumber,
      is_retry_attempt: result.isRetryAttempt || attemptNumber > 1,
      reward_claimed_per_attempt: result.rewardClaimedPerAttempt || { [attemptNumber]: false },
      question_snapshot: result.questionSnapshot || [],
    };

    console.log('[Supabase] submitSupabaseQuizResult payload:', payload);

    const { data, error } = await supabase
      .from('quiz_results')
      .upsert([payload], { onConflict: 'quiz_id,student_id,attempt_number' })
      .select()
      .single();

    if (error) {
      console.error('[Supabase] submitSupabaseQuizResult error:', error);
      throw error;
    }
    console.log('[Supabase] submitSupabaseQuizResult success:', data);
    return { success: true, data: normalizeQuizResult(data) };
  } catch (err: any) {
    console.error('[Supabase] submitSupabaseQuizResult exception:', err);
    return { success: false, error: err.message };
  }
}

export async function getSupabaseQuizResult(quizId: string, studentId: string) {
  try {
    const { data, error } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('student_id', studentId)
      .order('attempt_number', { ascending: false })
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] getSupabaseQuizResult error:', error);
      return null;
    }

    if (!data) {
      console.log('[Supabase] getSupabaseQuizResult: No result found (normal state)');
      return null;
    }

    const result = normalizeQuizResult(data);

    console.log('[Supabase] getSupabaseQuizResult success:', result);
    return result;
  } catch (err: any) {
    console.error('[Supabase] getSupabaseQuizResult exception:', err);
    return null;
  }
}

export async function claimSupabaseQuizReward(
  quizId: string,
  studentId: string,
  rewardOptionId: string,
  attemptNumber?: number
) {
  try {
    let resultQuery = supabase
      .from('quiz_results')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('student_id', studentId);

    if (attemptNumber) {
      resultQuery = resultQuery.eq('attempt_number', attemptNumber);
    } else {
      resultQuery = resultQuery
        .order('attempt_number', { ascending: false })
        .order('submitted_at', { ascending: false })
        .limit(1);
    }

    const { data: resultRow, error: resultError } = await resultQuery.maybeSingle();

    if (resultError) throw resultError;
    if (!resultRow) return { success: false, error: '퀴즈 결과를 찾을 수 없습니다.' };

    const quizResult = normalizeQuizResult(resultRow);
    const key = String(quizResult.attemptNumber || 1);
    const claimedMap: Record<string, boolean> = quizResult.rewardClaimedPerAttempt as any || {};
    const alreadyClaimed = !!quizResult.selectedRewardOptionId || !!claimedMap[key];

    if (alreadyClaimed) {
      return { success: false, error: '이미 이 회차의 보상을 받았습니다.' };
    }

    if (quizResult.gradingStatus === 'pending_review') {
      return { success: false, error: '아직 채점 대기 중이라 보상을 받을 수 없습니다.' };
    }

    const { data: quizRow, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('quiz_id', quizId)
      .single();

    if (quizError) throw quizError;
    if (!quizRow) return { success: false, error: '퀴즈 정보를 찾을 수 없습니다.' };

    const rewardOptions = getRewardOptionsForAttemptFromQuizRow(quizRow, quizResult.attemptNumber || 1);

    if (rewardOptions.length === 0) {
      return { success: false, error: '이 회차에는 받을 수 있는 보상이 없습니다.' };
    }

    const reward = rewardOptions.find(r => r.id === rewardOptionId);

    if (!reward) return { success: false, error: '존재하지 않는 보상입니다.' };

    const eligibleIds = (quizResult.eligibleRewardOptionIds || []).map(id => String(id));
    const isEligible =
      eligibleIds.includes(String(rewardOptionId)) ||
      quizResult.score >= reward.requiredScore;

    if (!isEligible) {
      return { success: false, error: '점수가 부족해서 이 보상을 받을 수 없습니다.' };
    }

    const { data: studentRow, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (studentError) throw studentError;
    if (!studentRow) return { success: false, error: '학생 정보를 찾을 수 없습니다.' };

    const catalogItem = REWARD_FOLDER_ITEMS.find(item => item.id === reward.itemId);
    const spriteUrl = (reward as any).itemSpriteUrl || catalogItem?.imageUrl || reward.itemImageUrl;
    const iconUrl = reward.itemImageUrl || catalogItem?.iconUrl || spriteUrl;

    const item: Item & Record<string, any> = reward.itemType === 'room'
      ? normalizeRoomRewardItem(reward)
      : {
          id: crypto.randomUUID(),
          itemId: reward.itemId,
          catalogItemId: reward.itemId,
          name: reward.itemName,
          type: reward.itemType,
          slot: reward.itemSlot,
          icon: reward.itemIcon || '🎁',
          iconUrl,
          imageUrl: spriteUrl,
          hairLayerMode: (reward as any).hairLayerMode || catalogItem?.hairLayerMode,
          tintMaskUrl: (reward as any).tintMaskUrl || catalogItem?.tintMaskUrl,
          shadowImageUrl: (reward as any).shadowImageUrl || catalogItem?.shadowImageUrl,
          outlineImageUrl: (reward as any).outlineImageUrl || catalogItem?.outlineImageUrl,
          overlayImageUrl: (reward as any).overlayImageUrl || catalogItem?.overlayImageUrl,
          eyeShadowImageUrl: (reward as any).eyeShadowImageUrl || catalogItem?.eyeShadowImageUrl,
          occupiesSlots: (reward as any).occupiesSlots || catalogItem?.occupiesSlots,
          underTintMaskUrl: (reward as any).underTintMaskUrl || catalogItem?.underTintMaskUrl,
          underShadowImageUrl: (reward as any).underShadowImageUrl || catalogItem?.underShadowImageUrl,
          underOutlineImageUrl: (reward as any).underOutlineImageUrl || catalogItem?.underOutlineImageUrl,
          upperTintMaskUrl: (reward as any).upperTintMaskUrl || catalogItem?.upperTintMaskUrl,
          upperShadowImageUrl: (reward as any).upperShadowImageUrl || catalogItem?.upperShadowImageUrl,
          upperOutlineImageUrl: (reward as any).upperOutlineImageUrl || catalogItem?.upperOutlineImageUrl,
          description: reward.itemDescription,
          rarity: 'common',
          acquiredAt: new Date().toISOString(),
        };

    const currentItems = Array.isArray(studentRow.items) ? studentRow.items : [];
    const { error: updateStudentError } = await supabase
      .from('students')
      .update({ items: [...currentItems, item] })
      .eq('id', studentId);

    if (updateStudentError) throw updateStudentError;

    const updatedClaimedMap = {
      ...(quizResult.rewardClaimedPerAttempt || {}),
      [key]: true,
    };

    const { data: updatedResult, error: updateResultError } = await supabase
      .from('quiz_results')
      .update({
        selected_reward: rewardOptionId,
        selected_reward_option_id: rewardOptionId,
        reward_claimed_per_attempt: updatedClaimedMap,
        reward_claimed_at: new Date().toISOString(),
      })
      .eq('id', resultRow.id)
      .select()
      .single();

    if (updateResultError) throw updateResultError;

    return { success: true, item, data: normalizeQuizResult(updatedResult) };
  } catch (err: any) {
    console.error('[Supabase] claimSupabaseQuizReward exception:', err);
    return { success: false, error: err.message };
  }
}

// 4. 실시간 세션 관련
export async function getSupabaseLiveSession(classCode: string, quizId: string) {
  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('class_code', classCode)
      .eq('quiz_id', quizId)
      .single();
    
    if (error) {
      console.error('[Supabase] getSupabaseLiveSession error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase] getSupabaseLiveSession exception:', err);
    return null;
  }
}

export async function updateSupabaseLiveSession(classCode: string, quizId: string, updates: any) {
  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .upsert([{ 
        class_code: classCode,
        quiz_id: quizId,
        ...updates
      }], { onConflict: 'class_code,quiz_id' })
      .select()
      .single();
    
    if (error) {
      console.error('[Supabase] updateSupabaseLiveSession error:', error);
      throw error;
    }
    return data;
  } catch (err) {
    console.error('[Supabase] updateSupabaseLiveSession exception:', err);
    throw err;
  }
}

// 6. 채점 관련 함수
export async function getPendingReviewResults(classCode: string) {
  try {
    const { data, error } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('class_code', classCode)
      .eq('grading_status', 'pending_review')
      .order('submitted_at', { ascending: true });

    if (error) {
      console.error('[Supabase] getPendingReviewResults error:', error);
      return [];
    }

    console.log('[Supabase] getPendingReviewResults success:', data?.length || 0, 'results');
    return (data || []).map(d => normalizeQuizResult(d));
  } catch (err: any) {
    console.error('[Supabase] getPendingReviewResults exception:', err);
    return [];
  }
}

export async function gradeSupabaseEssayAnswer(
  classCode: string,
  resultId: string,
  questionId: string,
  teacherScore: number,
  teacherComment: string = ''
) {
  try {
    // 결과 조회
    const { data: resultRow, error: resultError } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('id', resultId)
      .single();

    if (resultError) throw resultError;
    if (!resultRow) return { success: false, error: '결과를 찾을 수 없습니다.' };

    const result = normalizeQuizResult(resultRow);

    const { data: quizRow, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('quiz_id', result.quizId)
      .single();

    if (quizError) throw quizError;

    const questions = Array.isArray(quizRow?.questions) ? quizRow.questions : [];
    const question = questions.find((q: any) => q.id === questionId);
    const maxPoints = Number(question?.points ?? 0);

    if (teacherScore < 0 || teacherScore > maxPoints) {
      return { success: false, error: `점수는 0~${maxPoints} 사이여야 합니다.` };
    }

    // 답안 업데이트
    const updatedAnswers = result.answers.map(a => {
      if (a.questionId !== questionId) return a;
      return {
        ...a,
        teacherScore,
        teacherComment,
        earnedPoints: teacherScore,
        needsReview: false,
        isAutoGraded: false,
      };
    });

    // 모든 검토 필요 항목이 채점되었는지 확인
    const allReviewed = updatedAnswers.every(a => !a.needsReview);
    const newScore = updatedAnswers.reduce((sum, a) => sum + Number(a.earnedPoints || 0), 0);
    const newPendingScore = updatedAnswers
      .filter(a => a.needsReview)
      .reduce((sum, a) => {
        const q = questions.find((question: any) => question.id === a.questionId);
        return sum + Number(q?.points || 0);
      }, 0);
    const newManualScore = updatedAnswers
      .filter(a => !a.isAutoGraded)
      .reduce((sum, a) => sum + Number(a.earnedPoints || 0), 0);
    const newGradingStatus: StudentQuizResult['gradingStatus'] = allReviewed ? 'fully_graded' : 'pending_review';
    const eligibleRewardOptionIds = allReviewed
      ? getRewardOptionsForAttemptFromQuizRow(quizRow, result.attemptNumber)
          .filter(reward => newScore >= Number(reward.requiredScore ?? 0))
          .map(reward => reward.id)
      : [];

    console.log('[Supabase] gradeSupabaseEssayAnswer:', { resultId, questionId, teacherScore, newGradingStatus });

    const { data: updatedResult, error: updateError } = await supabase
      .from('quiz_results')
      .update({
        answers: updatedAnswers,
        score: newScore,
        pending_score: newPendingScore,
        grading_status: newGradingStatus,
        manual_score: newManualScore,
        eligible_reward_option_ids: eligibleRewardOptionIds,
      })
      .eq('id', resultId)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log('[Supabase] gradeSupabaseEssayAnswer success');
    return { success: true, data: normalizeQuizResult(updatedResult) };
  } catch (err: any) {
    console.error('[Supabase] gradeSupabaseEssayAnswer exception:', err);
    return { success: false, error: err.message };
  }
}

// 5. 비밀번호 비교 함수
export async function comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('[Supabase] Password comparison error:', error);
    return false;
  }
}
