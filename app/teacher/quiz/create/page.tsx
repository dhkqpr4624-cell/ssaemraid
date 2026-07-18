'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Plus,
  Save,
  AlertCircle,
  Trophy,
  FileQuestion,
  Sparkles,
  Upload,
  Search,
  Image as ImageIcon,
} from 'lucide-react';
import { saveQuiz } from '@/lib/db-wrapper';
import { uploadSharedQuiz } from '@/lib/shared-quizzes';
import { importQuizFromJSON, generateQuizPreview } from '@/lib/quiz-export';
import { BUILTIN_QUIZ_TEMPLATES, cloneBuiltInQuizData } from '@/lib/builtin-quizzes';
import type { ItemType, RetryQuestionMode, RetryRewardMode } from '@/lib/types';
import {
  QuestionItemEditor as QuestionEditor,
  RewardItemEditor,
  QuestionDraft,
  RewardDraft,
  defaultQuestion,
  defaultReward,
} from '@/components/quiz/QuestionEditor';

const QUESTION_CLIPBOARD_KEY = 'ssaemquest_quiz_question_clipboard';
const REWARD_CLIPBOARD_KEY = 'ssaemquest_quiz_reward_clipboard';

function makeClientId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function ensureRewardDraftIds(reward: RewardDraft): RewardDraft {
  const id = reward.id || reward.itemId || makeClientId('reward');
  return {
    ...reward,
    id,
    itemId: reward.itemId || id,
  };
}


const subjectOptions = [
  { value: 'math', label: '수학' },
  { value: 'science', label: '과학' },
  { value: 'social', label: '사회' },
  { value: 'practical', label: '실과' },
];

const gradeOptions = ['3', '4', '5', '6'];
const semesterOptions = ['1', '2'];
const getSubjectLabel = (value: string) => subjectOptions.find(opt => opt.value === value)?.label || value;
const getCurriculumLabel = (cur?: { grade?: string; semester?: string; subject?: string; unit?: string }) => {
  if (!cur) return '교육과정 미분류';
  return `${cur.grade || '-'}학년 ${cur.semester || '-'}학기 ${getSubjectLabel(cur.subject || '')} ${cur.unit || '-'}단원`;
};


function normalizeCurriculum(data: any) {
  const src = data?.metadata?.curriculum || data?.curriculum || {};
  return {
    grade: src.grade || data?.grade || '5',
    semester: src.semester || data?.semester || '1',
    subject: src.subject || data?.subject || 'social',
    unit: src.unit || data?.unit || '2',
  };
}

function questionDraftsFromImport(data: any): QuestionDraft[] {
  if (!Array.isArray(data?.questions) || data.questions.length === 0) return [defaultQuestion()];
  return data.questions.map((q: any) => ({
    type: q.type || 'single',
    text: q.text ?? '',
    points: q.points ?? 10,
    options: q.options ?? [],
    correctAnswers: q.correctAnswers ?? [],
    shortAnswers: q.shortAnswers ?? [''],
    hint: q.hint ?? '',
  }));
}

function rewardDraftsFromImport(rewardList: any[]): RewardDraft[] {
  if (!Array.isArray(rewardList) || rewardList.length === 0) return [ensureRewardDraftIds(defaultReward())];
  return rewardList.map((r: any) => ensureRewardDraftIds({
    ...r,
    itemName: r.itemName ?? '',
    itemIcon: r.itemIcon ?? '🎁',
    itemDescription: r.itemDescription ?? '',
    requiredScore: r.requiredScore ?? 0,
  }));
}

function toRewardPayload(reward: RewardDraft) {
  const r = ensureRewardDraftIds(reward);
  return {
    id: r.id!,
    itemId: r.itemId!,
    itemName: (r.itemName ?? '').trim(),
    itemIcon: (r.itemIcon ?? '').trim() || '🎁',
    itemImageUrl: r.itemImageUrl,
    itemSpriteUrl: (r as any).itemSpriteUrl,
    itemType: r.itemType,
    itemSlot: r.itemSlot,
    itemDescription: (r.itemDescription ?? '').trim(),
    requiredScore: r.requiredScore,

    // 제작 도구에서 만든 room item의 핵심 metadata를 퀴즈 저장 payload에 반드시 포함합니다.
    // 이 값들이 빠지면 보상 수령 후 학생 items에는 1칸 fallback 정보만 남아
    // 320x160/320x320 가구가 방에서 작게 표시됩니다.
    roomSize: (r as any).roomSize,
    spriteConfig: (r as any).spriteConfig,
    directionImages: (r as any).directionImages,
    availableDirections: (r as any).availableDirections,
    defaultDirection: (r as any).defaultDirection,
    footprint: (r as any).footprint,

    // 제작 도구에서 만든 3레이어 머리카락 보상 metadata를 보존합니다.
    hairLayerMode: (r as any).hairLayerMode,
    tintMaskUrl: (r as any).tintMaskUrl,
    shadowImageUrl: (r as any).shadowImageUrl,
    outlineImageUrl: (r as any).outlineImageUrl,
    overlayImageUrl: (r as any).overlayImageUrl,
    eyeShadowImageUrl: (r as any).eyeShadowImageUrl,
    rightArmPose: (r as any).rightArmPose,
    rightArmImageUrl: (r as any).rightArmImageUrl,
    leftArmPose: (r as any).leftArmPose,
    leftArmImageUrl: (r as any).leftArmImageUrl,
    topBodyImageUrl: (r as any).topBodyImageUrl,
    topLeftArmDefaultImageUrl: (r as any).topLeftArmDefaultImageUrl,
    topRightArmDefaultImageUrl: (r as any).topRightArmDefaultImageUrl,
    topRightArmOneHandedImageUrl: (r as any).topRightArmOneHandedImageUrl,
    topLeftArmTwoHandedImageUrl: (r as any).topLeftArmTwoHandedImageUrl,
    topRightArmTwoHandedImageUrl: (r as any).topRightArmTwoHandedImageUrl,
    underTintMaskUrl: (r as any).underTintMaskUrl,
    underShadowImageUrl: (r as any).underShadowImageUrl,
    underOutlineImageUrl: (r as any).underOutlineImageUrl,
    upperTintMaskUrl: (r as any).upperTintMaskUrl,
    upperShadowImageUrl: (r as any).upperShadowImageUrl,
    upperOutlineImageUrl: (r as any).upperOutlineImageUrl,
    occupiesSlots: (r as any).occupiesSlots,

    curriculum: (r as any).curriculum,
    grade: (r as any).grade,
    semester: (r as any).semester,
    subject: (r as any).subject,
    unit: (r as any).unit,
  };
}

function CreateQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classCode = searchParams.get('code') ?? '';
  const quizId = searchParams.get('quizId') ?? '';
  const isEditMode = !!quizId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<QuestionDraft[]>([defaultQuestion()]);
  const [rewards, setRewards] = useState<RewardDraft[]>([ensureRewardDraftIds(defaultReward())]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFilterGrade, setImportFilterGrade] = useState('all');
  const [importFilterSemester, setImportFilterSemester] = useState('all');
  const [importFilterSubject, setImportFilterSubject] = useState('all');
  const [importFilterUnit, setImportFilterUnit] = useState('all');

  const [curriculumGrade, setCurriculumGrade] = useState('5');
  const [curriculumSemester, setCurriculumSemester] = useState('1');
  const [curriculumSubject, setCurriculumSubject] = useState('social');
  const [curriculumUnit, setCurriculumUnit] = useState('2');

  // 재도전 옵션
  const [allowRetry, setAllowRetry] = useState(false);
  const [retryQuestionMode, setRetryQuestionMode] = useState<RetryQuestionMode>('same');
  const [retryRewardMode, setRetryRewardMode] = useState<RetryRewardMode>('same');
  const [retryRewards, setRetryRewards] = useState<RewardDraft[]>([]);
  const [maxRetryAttempts, setMaxRetryAttempts] = useState('1');
  const [copyNotice, setCopyNotice] = useState('');
  const [isSharedUploadOpen, setIsSharedUploadOpen] = useState(false);
  const [sharedAuthorName, setSharedAuthorName] = useState('');
  const [sharedUploadPassword, setSharedUploadPassword] = useState('');
  const [sharedThumbnailUrl, setSharedThumbnailUrl] = useState('');
  
  // 랜덤 출제 옵션
  const [randomPickEnabled, setRandomPickEnabled] = useState(false);
  const [randomPickCount, setRandomPickCount] = useState(5);
  const [shuffleQuestionsEnabled, setShuffleQuestionsEnabled] = useState(false);

  const totalScore = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  // 기존 퀴즈 데이터 로드 (수정 모드)
  useEffect(() => {
    if (!isEditMode || !quizId) return;
    
    const loadQuiz = async () => {
      try {
        const { getQuizzes } = await import('@/lib/db-wrapper');
        const allQuizzes = await getQuizzes(classCode);
        const quiz = allQuizzes.find((q: any) => q.id === quizId);
        
        if (quiz) {
          setTitle(quiz.title || '');
          setDescription(quiz.description || '');
          setIsActive(quiz.isActive !== false);
          setQuestions(quiz.questions?.map((q: any) => ({
            ...q,
            text: q.text ?? '',
            options: q.options ?? [],
            correctAnswers: q.correctAnswers ?? [],
            shortAnswers: q.shortAnswers ?? [],
            hint: q.hint ?? '',
            points: q.points ?? 0,
          })) || [defaultQuestion()]);
          setRewards(quiz.rewardOptions?.map((r: any) => ensureRewardDraftIds({
            ...r,
            itemName: r.itemName ?? '',
            itemIcon: r.itemIcon ?? '🎁',
            itemDescription: r.itemDescription ?? '',
            requiredScore: r.requiredScore ?? 0,
          })) || [ensureRewardDraftIds(defaultReward())]);
          setAllowRetry(quiz.allowRetry || quiz.retryOptions?.enabled || false);
          setRetryQuestionMode(quiz.retryQuestionMode || quiz.retryOptions?.questionMode || 'same');
          setRetryRewardMode(quiz.retryRewardMode || quiz.retryOptions?.rewardMode || 'same');
          setMaxRetryAttempts(String(Math.max(1, Number(quiz.maxRetryAttempts || quiz.retryOptions?.maxAttempts || 1))));
          setRetryRewards(quiz.retryRewardOptions?.map((r: any) => ensureRewardDraftIds({
            ...r,
            itemName: r.itemName ?? '',
            itemIcon: r.itemIcon ?? '🎁',
            itemDescription: r.itemDescription ?? '',
            requiredScore: r.requiredScore ?? 0,
          })) || []);
          setRandomPickEnabled(quiz.randomPickEnabled || false);
          setRandomPickCount(quiz.randomPickCount || 5);
          setShuffleQuestionsEnabled(quiz.shuffleQuestionsEnabled || false);
          const cur = normalizeCurriculum(quiz);
          setCurriculumGrade(cur.grade);
          setCurriculumSemester(cur.semester);
          setCurriculumSubject(cur.subject);
          setCurriculumUnit(cur.unit);
        }
      } catch (err) {
        console.error('퀴즈 로드 오류:', err);
        setError('퀴즈를 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadQuiz();
  }, [isEditMode, quizId, classCode]);

  useEffect(() => {
    if (typeof window === 'undefined' || isEditMode) return;
    const raw = localStorage.getItem('ssaemquest_pending_shared_quiz_import');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      applyImportedQuiz(data);
      localStorage.removeItem('ssaemquest_pending_shared_quiz_import');
    } catch (err) {
      console.error('공유 퀴즈 적용 오류:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);


  const availableSubjects = subjectOptions.filter(opt => opt.value !== 'practical' || curriculumGrade === '5' || curriculumGrade === '6');
  const importAvailableSubjects = subjectOptions.filter(opt => opt.value !== 'practical' || importFilterGrade === 'all' || importFilterGrade === '5' || importFilterGrade === '6');
  const importUnitOptions = Array.from(new Set(BUILTIN_QUIZ_TEMPLATES
    .filter(template => importFilterGrade === 'all' || template.curriculum.grade === importFilterGrade)
    .filter(template => importFilterSemester === 'all' || template.curriculum.semester === importFilterSemester)
    .filter(template => importFilterSubject === 'all' || template.curriculum.subject === importFilterSubject)
    .map(template => template.curriculum.unit)
  )).sort((a, b) => Number(a) - Number(b));
  const filteredBuiltInQuizTemplates = BUILTIN_QUIZ_TEMPLATES
    .filter(template => importFilterGrade === 'all' || template.curriculum.grade === importFilterGrade)
    .filter(template => importFilterSemester === 'all' || template.curriculum.semester === importFilterSemester)
    .filter(template => importFilterSubject === 'all' || template.curriculum.subject === importFilterSubject)
    .filter(template => importFilterUnit === 'all' || template.curriculum.unit === importFilterUnit);

  const applyImportedQuiz = (data: any) => {
    const cur = normalizeCurriculum(data);
    setTitle(data.metadata?.title || '');
    setDescription(data.metadata?.description || '');
    setQuestions(questionDraftsFromImport(data));
    setRewards(rewardDraftsFromImport(data.rewardOptions));
    setAllowRetry(data.settings?.allowRetry || false);
    setRetryQuestionMode(data.settings?.retryQuestionMode || 'same');
    setRetryRewardMode(data.settings?.retryRewardMode || 'same');
    setMaxRetryAttempts(String(Math.max(1, Number(data.settings?.maxRetryAttempts || data.settings?.retryOptions?.maxAttempts || 1))));
    setRetryRewards(rewardDraftsFromImport(data.retryRewardOptions || []).filter((r: any) => r.itemName));
    setRandomPickEnabled(data.settings?.randomPickEnabled || false);
    setRandomPickCount(data.settings?.randomPickCount || 5);
    setShuffleQuestionsEnabled(data.settings?.shuffleQuestionsEnabled || false);
    setCurriculumGrade(cur.grade);
    setCurriculumSemester(cur.semester);
    setCurriculumSubject(cur.subject);
    setCurriculumUnit(cur.unit);
    setIsImportModalOpen(false);
    setImportData(null);
    setImportPreview(null);
    setImportError(null);
  };

  const handleBuiltInSelect = (templateId: string) => {
    const template = BUILTIN_QUIZ_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    const data = cloneBuiltInQuizData(template);
    setImportData(data);
    setImportPreview(generateQuizPreview(data));
    setImportError(null);
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const data = await importQuizFromJSON(file);
      setImportData(data);
      setImportPreview(generateQuizPreview(data));
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      e.target.value = '';
    }
  };

  // 문항 추가
  const addQuestion = () => {
    setQuestions(prev => [...prev, defaultQuestion()]);
  };

  // 문항 수정
  const updateQuestion = (index: number, updated: QuestionDraft) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? updated : q)));
  };

  // 문항 삭제
  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const showCopyNotice = (message: string) => {
    setCopyNotice(message);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setCopyNotice(''), 1600);
    }
  };

  const copyQuestion = (index: number) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(QUESTION_CLIPBOARD_KEY, JSON.stringify(questions[index]));
    showCopyNotice('문항을 복사했습니다.');
  };

  const pasteQuestionAfter = (index: number) => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(QUESTION_CLIPBOARD_KEY);
    if (!raw) {
      alert('복사된 문항이 없습니다.');
      return;
    }
    try {
      const copied = JSON.parse(raw) as QuestionDraft;
      const newQuestion: QuestionDraft = {
        ...copied,
        options: [...(copied.options || [])],
        correctAnswers: [...(copied.correctAnswers || [])],
        shortAnswers: [...(copied.shortAnswers || [])],
      };
      setQuestions(prev => {
        const next = [...prev];
        next.splice(index + 1, 0, newQuestion);
        return next;
      });
    } catch {
      alert('복사된 문항 정보를 읽을 수 없습니다. 다시 복사해주세요.');
    }
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions(prev => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  // 보상 추가
  const addReward = () => {
    if (rewards.length >= 5) return;
    setRewards(prev => [...prev, ensureRewardDraftIds(defaultReward())]);
  };

  // 보상 수정
  const updateReward = (index: number, updated: RewardDraft) => {
    setRewards(prev => prev.map((r, i) => (i === index ? updated : r)));
  };

  // 보상 삭제
  const removeReward = (index: number) => {
    if (rewards.length <= 1) return;
    setRewards(prev => prev.filter((_, i) => i !== index));
  };

  const copyReward = (reward: RewardDraft) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(REWARD_CLIPBOARD_KEY, JSON.stringify(reward));
    showCopyNotice('보상 아이템 설정을 복사했습니다.');
  };

  const readRewardClipboard = (): RewardDraft | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(REWARD_CLIPBOARD_KEY);
    if (!raw) {
      alert('복사된 보상 아이템 설정이 없습니다.');
      return null;
    }
    try {
      return ensureRewardDraftIds(JSON.parse(raw));
    } catch {
      alert('복사된 보상 아이템 설정을 읽을 수 없습니다. 다시 복사해주세요.');
      return null;
    }
  };

  const pasteRewardTo = (index: number, target: 'main' | 'retry' = 'main') => {
    const copied = readRewardClipboard();
    if (!copied) return;
    const clone = ensureRewardDraftIds({ ...copied, id: makeClientId('reward'), itemId: copied.itemId || copied.id });
    if (target === 'retry') {
      setRetryRewards(prev => prev.map((r, i) => i === index ? clone : r));
    } else {
      setRewards(prev => prev.map((r, i) => i === index ? clone : r));
    }
  };

  // 유효성 검사
  const validate = (): string | null => {
    if (!(title ?? '').trim()) return '퀴즈 제목을 입력해주세요.';
    if (questions.length === 0) return '문항을 1개 이상 추가해주세요.';

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!(q.text ?? '').trim()) return `${i + 1}번 문항의 내용을 입력해주세요.`;
      if (!q.points || q.points < 1) return `${i + 1}번 문항의 배점은 1점 이상이어야 합니다.`;

      if (q.type === 'single') {
        if (q.options.some((o: string) => !(o ?? '').trim())) return `${i + 1}번 문항의 모든 보기를 입력해주세요.`;
        if (q.correctAnswers.length !== 1) return `${i + 1}번 문항의 정답을 선택해주세요.`;
      }
      if (q.type === 'multiple') {
        if (q.options.some((o: string) => !(o ?? '').trim())) return `${i + 1}번 문항의 모든 보기를 입력해주세요.`;
        if (q.correctAnswers.length < 2) return `${i + 1}번 복수정답 문항은 정답을 2개 이상 선택해주세요.`;
      }
      if (q.type === 'short') {
        if (q.shortAnswers.every((a: string) => !(a ?? '').trim())) return `${i + 1}번 단답형 문항의 정답 키워드를 입력해주세요.`;
      }
    }

    if (rewards.length === 0) return '보상 옵션을 1개 이상 추가해주세요.';
    for (let i = 0; i < rewards.length; i++) {
      const r = rewards[i];
      if (!(r.itemName ?? '').trim()) return `${i + 1}번 보상의 이름을 입력해주세요.`;
      if (r.requiredScore > totalScore) {
        return `${i + 1}번 보상의 필요 점수(${r.requiredScore})가 총점(${totalScore})보다 큽니다.`;
      }
    }

    if (allowRetry && (!maxRetryAttempts || Number(maxRetryAttempts) < 1)) return '최대 재도전 횟수는 1회 이상이어야 합니다.';

    // 재도전 보상 검증
    if (allowRetry && retryRewardMode === 'different') {
      if (retryRewards.length === 0) return '재도전 보상을 1개 이상 추가해주세요.';
      for (let i = 0; i < retryRewards.length; i++) {
        const r = retryRewards[i];
        if (!r.itemName.trim()) return `${i + 1}번 재도전 보상의 이름을 입력해주세요.`;
        if (r.requiredScore > totalScore) {
          return `${i + 1}번 재도전 보상의 필요 점수(${r.requiredScore})가 총점(${totalScore})보다 큽니다.`;
        }
      }
    }

    return null;
  };


  const buildCurrentQuizExportData = () => ({
    metadata: {
      title: (title ?? '').trim(),
      description: (description ?? '').trim(),
      totalScore,
      totalQuestions: questions.length,
      createdAt: new Date().toISOString(),
      exportedAt: new Date().toISOString(),
      curriculum: {
        grade: curriculumGrade,
        semester: curriculumSemester,
        subject: curriculumSubject,
        unit: curriculumUnit,
      },
    },
    curriculum: {
      grade: curriculumGrade,
      semester: curriculumSemester,
      subject: curriculumSubject,
      unit: curriculumUnit,
    },
    settings: {
      allowRetry,
      retryQuestionMode,
      retryRewardMode,
      maxRetryAttempts: Math.max(1, Number(maxRetryAttempts) || 1),
      quizMode: 'normal',
      randomPickEnabled,
      randomPickCount,
      shuffleQuestionsEnabled,
    },
    questions: questions.map(q => ({
      type: q.type,
      text: (q.text ?? '').trim(),
      points: q.points,
      options: q.type === 'single' || q.type === 'multiple' ? q.options : undefined,
      correctAnswers: q.type === 'single' || q.type === 'multiple' ? q.correctAnswers : undefined,
      shortAnswers: q.type === 'short' ? q.shortAnswers.filter(a => a.trim()) : undefined,
      hint: (q.hint ?? '').trim() || undefined,
    })),
    rewardOptions: rewards.map(toRewardPayload),
    retryRewardOptions: retryRewardMode === 'different' ? retryRewards.map(toRewardPayload) : [],
    version: '1.0',
  });

  const openSharedUploadDialog = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setIsSharedUploadOpen(true);
  };

  const handleSharedThumbnailFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('썸네일은 이미지 파일만 사용할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSharedThumbnailUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleUploadCurrentQuizToShared = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await uploadSharedQuiz({
        quizData: {
          ...(buildCurrentQuizExportData() as any),
          metadata: {
            ...((buildCurrentQuizExportData() as any).metadata || {}),
            thumbnailUrl: sharedThumbnailUrl || undefined,
          },
        } as any,
        authorName: sharedAuthorName,
        uploadPassword: sharedUploadPassword,
        thumbnailUrl: sharedThumbnailUrl,
      });
      setIsSharedUploadOpen(false);
      setSharedAuthorName('');
      setSharedUploadPassword('');
      setSharedThumbnailUrl('');
      showCopyNotice('퀴즈 탐색 화면에 공유 등록했습니다.');
    } catch (err: any) {
      setError(err.message || '공유 퀴즈 업로드에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    console.log('[Teacher Quiz] ========== handleSubmit START ==========');
    console.log('[Teacher Quiz] isEditMode:', isEditMode, 'quizId:', quizId, 'classCode:', classCode);
    console.log('[Teacher Quiz] Current state - title:', title, 'questions:', questions.length);
    
    const validationError = validate();
    if (validationError) {
      console.error('[Teacher Quiz] Validation failed:', validationError);
      setError(validationError);
      return;
    }

    console.log('[Teacher Quiz] Validation passed');
    setError('');
    setIsSubmitting(true);

    try {
      const quizData = {
        id: quizId || undefined,
        quiz_id: quizId || undefined,
        classCode: classCode || '',
        title: (title ?? '').trim(),
        description: (description ?? '').trim(),
        isActive,
        isReviewEnabled: false,
        reviewMode: 'same',
        questions: questions.map(q => ({
          type: q.type,
          text: (q.text ?? '').trim(),
          points: q.points,
          options: q.type === 'single' || q.type === 'multiple' ? q.options : undefined,
          correctAnswers: q.type === 'single' || q.type === 'multiple' ? q.correctAnswers : undefined,
          shortAnswers: q.type === 'short' ? q.shortAnswers.filter(a => a.trim()) : undefined,
          hint: (q.hint ?? '').trim() || undefined,
        })),
        rewardOptions: rewards.map(toRewardPayload),
        allowRetry,
        retryQuestionMode,
        retryRewardMode,
        retryRewardOptions: retryRewardMode === 'different' ? retryRewards.map(toRewardPayload) : undefined,
        maxRetryAttempts: Math.max(1, Number(maxRetryAttempts) || 1),
        randomPickEnabled,
        randomPickCount,
        shuffleQuestionsEnabled,
        curriculum: {
          grade: curriculumGrade,
          semester: curriculumSemester,
          subject: curriculumSubject,
          unit: curriculumUnit,
        },
        grade: curriculumGrade,
        semester: curriculumSemester,
        subject: curriculumSubject,
        unit: curriculumUnit,
      };

      console.log('[Teacher Quiz] Prepared quizData:', quizData);
      console.log('[Teacher Quiz] Calling saveQuiz with isEditMode:', isEditMode);
      
      const result = await saveQuiz(quizData, isEditMode);
      
      console.log('[Teacher Quiz] saveQuiz result:', result);
      
      if (result.success) {
        console.log('[Teacher Quiz] Success! Redirecting to dashboard');
        router.push(`/teacher/dashboard?code=${classCode}`);
      } else {
        const errorMsg = isEditMode ? '퀴즈 수정 중 오류가 발생했습니다.' : '퀴즈 생성 중 오류가 발생했습니다.';
        console.error('[Teacher Quiz] Save failed:', result.error);
        setError(result.error || errorMsg);
      }
    } catch (err) {
      console.error('[Teacher Quiz] Exception during save:', err);
      setError('퀴즈 생성 중 오류가 발생했습니다.');
    } finally {
      console.log('[Teacher Quiz] ========== handleSubmit END ==========');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 pb-24 bg-muted/20">
      {copyNotice && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {copyNotice}
        </div>
      )}
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/teacher/dashboard?code=${classCode}`}
              className="w-10 h-10 rounded-full bg-background border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">퀴즈 만들기</h1>
              <p className="text-sm text-muted-foreground">
                클래스 코드: <span className="font-mono font-semibold">{classCode}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/teacher/quiz/explore?code=${classCode}&from=create`}>
              <Button variant="outline" className="gap-2">
                <Search className="w-4 h-4" />
                퀴즈 탐색
              </Button>
            </Link>
            <Button variant="outline" onClick={openSharedUploadDialog} disabled={isSubmitting} className="gap-2">
              <Upload className="w-4 h-4" />
              퀴즈 업로드하기
            </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 px-6">
            <Save className="w-4 h-4" />
            {isSubmitting ? '저장 중...' : '퀴즈 저장'}
          </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            {/* 기본 정보 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileQuestion className="w-4 h-4 text-primary" />
                  기본 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">퀴즈 제목 *</Label>
                  <Input
                    placeholder="예: 1단원 핵심 개념 퀴즈"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">설명 (선택)</Label>
                  <Textarea
                    placeholder="퀴즈에 대한 설명을 입력하세요..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="isActive" className="text-sm cursor-pointer">공개 여부</Label>
                      <p className="text-[10px] text-muted-foreground">학생에게 바로 공개합니다.</p>
                    </div>
                    <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="allowRetry" className="text-sm cursor-pointer">재도전</Label>
                      <p className="text-[10px] text-muted-foreground">보상 수령 후 다시 도전할 수 있게 합니다.</p>
                    </div>
                    <Switch id="allowRetry" checked={allowRetry} onCheckedChange={setAllowRetry} />
                  </div>
                </div>
              </CardContent>
            </Card>


            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">교육과정 분류</CardTitle>
                <CardDescription className="text-xs">기본 탑재 퀴즈와 직접 만든 퀴즈를 같은 기준으로 정리합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">학년</Label>
                    <Select value={curriculumGrade} onValueChange={(v) => { setCurriculumGrade(v); if ((v === '3' || v === '4') && curriculumSubject === 'practical') setCurriculumSubject('social'); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3학년</SelectItem>
                        <SelectItem value="4">4학년</SelectItem>
                        <SelectItem value="5">5학년</SelectItem>
                        <SelectItem value="6">6학년</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">학기</Label>
                    <Select value={curriculumSemester} onValueChange={setCurriculumSemester}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1학기</SelectItem>
                        <SelectItem value="2">2학기</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">과목</Label>
                  <Select value={curriculumSubject} onValueChange={setCurriculumSubject}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableSubjects.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">단원</Label>
                  <Input className="h-8 text-xs" value={curriculumUnit} onChange={e => setCurriculumUnit(e.target.value)} placeholder="예: 2" />
                </div>
              </CardContent>
            </Card>

            {allowRetry && (
              <Card className="bg-blue-50/50 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">재도전 설정</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">최대 재도전 횟수</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={maxRetryAttempts}
                      onChange={e => {
                        const value = e.target.value;
                        if (value === '') {
                          setMaxRetryAttempts('');
                          return;
                        }
                        const parsed = Number(value);
                        if (Number.isNaN(parsed)) return;
                        setMaxRetryAttempts(String(Math.min(20, Math.max(1, parsed))));
                      }}
                      onBlur={() => {
                        if (!maxRetryAttempts || Number(maxRetryAttempts) < 1) {
                          setMaxRetryAttempts('1');
                        }
                      }}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">첫 풀이를 제외하고 학생이 다시 도전할 수 있는 횟수입니다.</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">문제 구성 방식</Label>
                    <Select value={retryQuestionMode} onValueChange={(v: any) => setRetryQuestionMode(v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same">동일한 문제</SelectItem>
                        <SelectItem value="modified">일부 문제 수정 (TODO)</SelectItem>
                        <SelectItem value="random">문제은행에서 랜덤 (TODO)</SelectItem>
                        <SelectItem value="extended">기존 + 추가 문제 (TODO)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">보상 방식</Label>
                    <Select value={retryRewardMode} onValueChange={(v: any) => setRetryRewardMode(v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same">기존 보상 동일</SelectItem>
                        <SelectItem value="different">별도 보상 세트</SelectItem>
                        <SelectItem value="none">보상 없음 (연습용)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-amber-50/50 border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">랜덤 출제 설정</CardTitle>
                <CardDescription className="text-xs">학생이 퀴즈를 시작할 때 출제 문항을 고정합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="randomPickEnabled" className="text-sm cursor-pointer">랜덤 출제</Label>
                    <p className="text-[10px] text-muted-foreground">전체 문항 중 일부만 뽑습니다.</p>
                  </div>
                  <Switch id="randomPickEnabled" checked={randomPickEnabled} onCheckedChange={setRandomPickEnabled} />
                </div>

                {randomPickEnabled && (
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">출제 문항 수</Label>
                    <Input
                      type="number"
                      min={1}
                      max={questions.length}
                      value={randomPickCount}
                      onChange={e => setRandomPickCount(Math.max(1, Number(e.target.value) || 1))}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">현재 전체 문항: {questions.length}개</p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="shuffleQuestionsEnabled" className="text-sm cursor-pointer">문제 순서 섞기</Label>
                    <p className="text-[10px] text-muted-foreground">출제된 문항의 순서를 무작위로 섞습니다.</p>
                  </div>
                  <Switch
                    id="shuffleQuestionsEnabled"
                    checked={shuffleQuestionsEnabled}
                    onCheckedChange={setShuffleQuestionsEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  팁
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground space-y-2">
                <p><b>아바타 파츠</b> 유형을 선택하고 <b>슬롯</b>을 지정하면 학생들이 아바타 꾸미기에서 직접 장착할 수 있습니다.</p>
                <p><b>재도전</b>을 활성화하면 보상 수령 후 학생이 다시 도전할 수 있습니다.</p>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-8">
            {/* 문항 목록 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg">문항 설정</h2>
                  <Badge variant="secondary">{questions.length}</Badge>
                  <span className="text-sm text-muted-foreground font-medium">총 {totalScore}점</span>
                </div>
              </div>

              <div className="space-y-4">
                {questions.map((q, i) => (
                  <QuestionEditor
                    key={i}
                    index={i}
                    question={q}
                    onChange={updated => updateQuestion(i, updated)}
                    onRemove={() => removeQuestion(i)}
                    canRemove={questions.length > 1}
                    onCopy={() => copyQuestion(i)}
                    onPasteAfter={() => pasteQuestionAfter(i)}
                    onMoveUp={() => moveQuestion(i, -1)}
                    onMoveDown={() => moveQuestion(i, 1)}
                    canMoveUp={i > 0}
                    canMoveDown={i < questions.length - 1}
                  />
                ))}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={addQuestion} className="h-8">
                  <Plus className="w-4 h-4 mr-1" /> 문항 추가
                </Button>
              </div>
            </div>

            {/* 보상 목록 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg">보상 옵션</h2>
                  <Badge variant="secondary">{rewards.length}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {rewards.map((r, i) => (
                  <RewardItemEditor
                    key={i}
                    index={i}
                    reward={r}
                    onChange={updated => updateReward(i, updated)}
                    onRemove={() => removeReward(i)}
                    onCopy={() => copyReward(r)}
                    onPaste={() => pasteRewardTo(i, 'main')}
                  />
                ))}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={addReward} className="h-8">
                  <Plus className="w-4 h-4 mr-1" /> 보상 추가
                </Button>
              </div>
            </div>

            {/* 재도전 보상 목록 */}
            {allowRetry && retryRewardMode === 'different' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-lg">재도전 보상 옵션</h2>
                    <Badge variant="secondary">{retryRewards.length}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {retryRewards.map((r, i) => (
                    <RewardItemEditor
                      key={i}
                      index={i}
                      reward={r}
                      onChange={updated => setRetryRewards(prev => prev.map((x, j) => j === i ? updated : x))}
                      onRemove={() => setRetryRewards(prev => prev.filter((_, j) => j !== i))}
                      onCopy={() => copyReward(r)}
                      onPaste={() => pasteRewardTo(i, 'retry')}
                    />
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setRetryRewards(prev => [...prev, ensureRewardDraftIds(defaultReward())])} className="h-8">
                    <Plus className="w-4 h-4 mr-1" /> 보상 추가
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-6 flex justify-center">
              <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="px-16 h-12 text-lg shadow-lg">
                <Save className="w-5 h-5 mr-2" />
                {isSubmitting ? '저장 중...' : '퀴즈 생성 완료'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isSharedUploadOpen} onOpenChange={setIsSharedUploadOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>공유 퀴즈 업로드</DialogTitle>
            <DialogDescription>현재 만들고 있는 퀴즈를 퀴즈 탐색 화면에 공유합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">작성자 이름(선택)</Label>
                <Input value={sharedAuthorName} onChange={e => setSharedAuthorName(e.target.value)} placeholder="예: 5학년 교사" />
              </div>
              <div>
                <Label className="text-xs">수정/삭제용 비밀번호(선택)</Label>
                <Input type="password" value={sharedUploadPassword} onChange={e => setSharedUploadPassword(e.target.value)} placeholder="추후 수정 기능용" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> 대표 사진/썸네일(선택)</Label>
              <Input type="file" accept="image/*" onChange={handleSharedThumbnailFile} />
              {sharedThumbnailUrl && <img src={sharedThumbnailUrl} alt="썸네일 미리보기" className="h-24 w-24 rounded-md border object-cover" />}
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{title || '제목 없는 퀴즈'}</p>
              <p className="text-xs text-muted-foreground mt-1">{questions.length}문제 · {curriculumGrade}학년 {curriculumSemester}학기 {getSubjectLabel(curriculumSubject)} {curriculumUnit}단원</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSharedUploadOpen(false)}>취소</Button>
            <Button onClick={handleUploadCurrentQuizToShared} disabled={isSubmitting}>{isSubmitting ? '업로드 중...' : '공유 등록'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>퀴즈 가져오기</DialogTitle>
            <DialogDescription>기본 탑재 퀴즈를 선택하거나 JSON 파일을 불러와 현재 퀴즈 만들기 화면에 적용합니다.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 overflow-y-auto pr-2 flex-1 min-h-0">
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <Label className="text-xs font-medium">기본 탑재 퀴즈 카테고리</Label>
                <p className="text-[10px] text-muted-foreground mt-1">학년·학기·과목·단원으로 기본 퀴즈를 먼저 좁혀서 찾을 수 있습니다.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={importFilterGrade} onValueChange={(v) => { setImportFilterGrade(v); if ((v === '3' || v === '4') && importFilterSubject === 'practical') setImportFilterSubject('all'); setImportFilterUnit('all'); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="학년" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 학년</SelectItem>
                    {gradeOptions.map(grade => <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={importFilterSemester} onValueChange={(v) => { setImportFilterSemester(v); setImportFilterUnit('all'); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="학기" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 학기</SelectItem>
                    {semesterOptions.map(semester => <SelectItem key={semester} value={semester}>{semester}학기</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={importFilterSubject} onValueChange={(v) => { setImportFilterSubject(v); setImportFilterUnit('all'); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="과목" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 과목</SelectItem>
                    {importAvailableSubjects.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={importFilterUnit} onValueChange={setImportFilterUnit}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="단원" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 단원</SelectItem>
                    {importUnitOptions.map(unit => <SelectItem key={unit} value={unit}>{unit}단원</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">기본 탑재 퀴즈</Label>
              <Select onValueChange={handleBuiltInSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={filteredBuiltInQuizTemplates.length > 0 ? "기본 탑재 퀴즈 선택" : "조건에 맞는 기본 퀴즈가 없습니다"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredBuiltInQuizTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>{template.title} · {getCurriculumLabel(template.curriculum)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">외부 JSON 파일</Label>
              <Input type="file" accept=".json" onChange={handleImportFileChange} />
            </div>
            {importError && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">{importError}</div>}
            {importPreview && (
              <div className="bg-muted p-4 rounded-md max-h-64 overflow-auto max-w-full">
                <pre className="text-xs whitespace-pre-wrap break-words font-sans leading-relaxed">{importPreview}</pre>
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-3 shrink-0">
            <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setImportData(null); setImportPreview(null); setImportError(null); }}>취소</Button>
            <Button onClick={() => importData && applyImportedQuiz(importData)} disabled={!importData}>현재 화면에 적용</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function QuizCreatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <CreateQuizContent />
    </Suspense>
  );
}
