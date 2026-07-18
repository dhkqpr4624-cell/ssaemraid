'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  ArrowRight,
  Trophy,
  Gift,
  AlertCircle,
  Sparkles,
  Check,
  RotateCcw,
} from 'lucide-react';
import { getStudentSession } from '@/lib/class-storage';
import { submitQuizResult, getQuizResult, getQuizzes, claimReward } from '@/lib/db-wrapper';
import { gradeAllAnswers } from '@/lib/auto-grade';
import { getRoomItemById, getRoomItemFrameStyle } from '@/lib/room-items-registry';
import type {
  Quiz,
  StudentSession,
  StudentAnswer,
  QuizRewardOption,
  StudentQuizResult,
  QuizQuestion,
} from '@/lib/types';


function RewardVisual({ reward, size = 48 }: { reward: QuizRewardOption; size?: number }) {
  const catalog = reward.itemType === 'room' ? getRoomItemById(reward.itemId) : undefined;

  if (catalog) {
    return (
      <div
        className="rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        <div style={getRoomItemFrameStyle(catalog.id, catalog.defaultDirection, Math.min(size - 8, 48))} />
      </div>
    );
  }

  if (reward.itemImageUrl) {
    return (
      <div
        className="rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        <img src={reward.itemImageUrl} alt={reward.itemName} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }

  return (
    <div
      className="rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl"
      style={{ width: size, height: size }}
    >
      {reward.itemIcon || '🎁'}
    </div>
  );
}

// 문항 유형 라벨
const typeLabels: Record<string, string> = {
  single: '객관식 (단일정답)',
  multiple: '객관식 (복수정답)',
  short: '단답형',
  essay: '장문형',
};

// 문항 유형 색상
const typeBadgeClass: Record<string, string> = {
  single: 'bg-blue-100 text-blue-700',
  multiple: 'bg-purple-100 text-purple-700',
  short: 'bg-green-100 text-green-700',
  essay: 'bg-orange-100 text-orange-700',
};

// 학생 답안 초기값
function emptyAnswer(questionId: string): Omit<StudentAnswer, 'isAutoGraded' | 'earnedPoints' | 'needsReview'> {
  return { questionId, selectedOptions: [], textAnswer: '' };
}

function isRewardClaimedForAttempt(result: StudentQuizResult | null) {
  if (!result) return false;
  const attemptNumber = result.attemptNumber || 1;
  const claimedMap = (result.rewardClaimedPerAttempt || {}) as any;
  return !!result.selectedRewardOptionId || !!claimedMap[attemptNumber] || !!claimedMap[String(attemptNumber)];
}

function buildInitialAnswers(questions: QuizQuestion[]) {
  const initialAnswers: Record<string, Omit<StudentAnswer, 'isAutoGraded' | 'earnedPoints' | 'needsReview'>> = {};
  questions.forEach(q => {
    initialAnswers[q.id] = emptyAnswer(q.id);
  });
  return initialAnswers;
}

function getRewardOptionsForAttempt(quiz: Quiz, attemptNumber?: number) {
  const isRetryAttempt = (attemptNumber || 1) > 1;

  if (!isRetryAttempt) return quiz.rewardOptions || [];

  if (quiz.retryRewardMode === 'none') return [];

  if (quiz.retryRewardMode === 'different') {
    return quiz.retryRewardOptions || [];
  }

  return quiz.rewardOptions || [];
}

function shuffleQuestions(questions: QuizQuestion[]) {
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getAttemptQuestionStorageKey(quizId: string, studentId: string, attemptNumber: number) {
  return `ssaemquest_attempt_questions_${quizId}_${studentId}_${attemptNumber}`;
}

function prepareAttemptQuestions(quiz: Quiz, studentId: string, attemptNumber: number) {
  if (typeof window !== 'undefined') {
    const key = getAttemptQuestionStorageKey(quiz.id, studentId, attemptNumber);
    const saved = sessionStorage.getItem(key);
    if (saved) {
      try {
        const ids = JSON.parse(saved) as string[];
        const map = new Map(quiz.questions.map(q => [q.id, q]));
        const restored = ids.map(id => map.get(id)).filter((q): q is QuizQuestion => !!q);
        if (restored.length > 0) return restored;
      } catch {
        sessionStorage.removeItem(key);
      }
    }
  }

  let qs = [...quiz.questions];
  if (quiz.randomPickEnabled && quiz.randomPickCount && quiz.randomPickCount > 0) {
    qs = shuffleQuestions(qs).slice(0, Math.min(quiz.randomPickCount, qs.length));
  }
  if (quiz.shuffleQuestionsEnabled) {
    qs = shuffleQuestions(qs);
  }

  if (typeof window !== 'undefined') {
    const key = getAttemptQuestionStorageKey(quiz.id, studentId, attemptNumber);
    sessionStorage.setItem(key, JSON.stringify(qs.map(q => q.id)));
  }
  return qs;
}

function getEligibleRewardsForAttempt(quiz: Quiz, score: number, attemptNumber?: number) {
  return getRewardOptionsForAttempt(quiz, attemptNumber)
    .filter(reward => score >= Number(reward.requiredScore ?? 0));
}

function getEligibleRewardsForResult(quiz: Quiz, result: StudentQuizResult | null) {
  if (!result || result.gradingStatus === 'pending_review') return [];

  const rewardOptions = getRewardOptionsForAttempt(quiz, result.attemptNumber || 1);
  const storedIds = new Set(
    (result.eligibleRewardOptionIds || [])
      .filter(Boolean)
      .map(id => String(id))
  );

  if (storedIds.size > 0) {
    const byStoredIds = rewardOptions.filter(reward => storedIds.has(String(reward.id)));
    if (byStoredIds.length > 0) return byStoredIds;
  }

  return rewardOptions.filter(reward => (result.score ?? 0) >= Number(reward.requiredScore ?? 0));
}

function QuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get('quizId') ?? '';
  const classCode = searchParams.get('code') ?? '';
  const retryRequested = searchParams.get('retry') === '1';

  const [session, setSession] = useState<StudentSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 답안 상태
  const [answers, setAnswers] = useState<
    Record<string, Omit<StudentAnswer, 'isAutoGraded' | 'earnedPoints' | 'needsReview'>>
  >({});

  // 현재 문항 인덱스
  const [currentIndex, setCurrentIndex] = useState(0);

  // 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<StudentQuizResult | null>(null);
  const [lastResult, setLastResult] = useState<StudentQuizResult | null>(null);
  const [currentAttemptNumber, setCurrentAttemptNumber] = useState(1);
  const [eligibleRewards, setEligibleRewards] = useState<QuizRewardOption[]>([]);

  // 보상 선택 상태
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [claimedItem, setClaimedItem] = useState<{ name: string; icon: string } | null>(null);

  useEffect(() => {
    const savedSession = getStudentSession();
    if (!savedSession) {
      router.push('/student');
      return;
    }
    setSession(savedSession);

    if (!quizId || !classCode) {
      router.push('/student/dashboard');
      return;
    }

    const loadQuiz = async () => {
      try {
        console.log('[Student Quiz] Loading quiz - quizId:', quizId, 'classCode:', classCode);
        const allQuizzes = await getQuizzes(classCode);
        const quizData = allQuizzes.find((q: any) => q.id === quizId || q.quiz_id === quizId);

        if (!quizData) {
          console.error('[Student Quiz] 퀴즈를 찾을 수 없음:', quizId);
          router.push('/student/dashboard');
          return;
        }

        setQuiz(quizData);

        const existingResult = await getQuizResult(quizData.id, savedSession.studentId);

        if (existingResult) {
          setLastResult(existingResult);

          if (retryRequested && quizData.allowRetry) {
            setSubmitted(false);
            setQuizResult(null);
            setRewardClaimed(false);
            setEligibleRewards([]);
            const nextAttempt = (existingResult.attemptNumber || 1) + 1;
            setCurrentAttemptNumber(nextAttempt);
            
            // 새 시도용 문항 구성: attempt별로 sessionStorage에 고정
            const qs = prepareAttemptQuestions(quizData, savedSession.studentId, nextAttempt);
            setActiveQuestions(qs);
            setAnswers(buildInitialAnswers(qs));
          } else {
            setQuizResult(existingResult);
            setSubmitted(true);
            setCurrentAttemptNumber(existingResult.attemptNumber || 1);

            // 결과에 저장된 스냅샷이 있으면 해당 순서대로 복구
            if (existingResult.questionSnapshot && existingResult.questionSnapshot.length > 0) {
              const snapshotMap = new Map(quizData.questions.map(q => [q.id, q]));
              const restoredQs = existingResult.questionSnapshot
                .map(id => snapshotMap.get(id))
                .filter((q): q is QuizQuestion => !!q);
              setActiveQuestions(restoredQs);
            } else {
              setActiveQuestions(quizData.questions);
            }

            const alreadyClaimed = isRewardClaimedForAttempt(existingResult);
            setRewardClaimed(alreadyClaimed);

            if (!alreadyClaimed && existingResult.gradingStatus !== 'pending_review') {
              setEligibleRewards(getEligibleRewardsForResult(quizData, existingResult));
            }
          }
        } else {
          setCurrentAttemptNumber(1);
          // 첫 시도 문항 구성: 새로고침해도 같은 attempt에서는 유지
          const qs = prepareAttemptQuestions(quizData, savedSession.studentId, 1);
          setActiveQuestions(qs);
          setAnswers(buildInitialAnswers(qs));
        }

        setIsLoading(false);
      } catch (err) {
        console.error('[Student Quiz] 퀴즈 로드 오류:', err);
        router.push('/student/dashboard');
      }
    };

    loadQuiz();
  }, [quizId, classCode, retryRequested, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4 text-4xl">📝</div>
          <p className="text-muted-foreground">퀴즈를 불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (!quiz || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              오류
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>퀴즈를 불러올 수 없습니다.</p>
            <Link href="/student/dashboard">
              <Button className="w-full">대시보드로 돌아가기</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const currentQuestion = activeQuestions[currentIndex];
  const progress = activeQuestions.length > 0 ? ((currentIndex + 1) / activeQuestions.length) * 100 : 0;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  // 문항 선택지 변경
  const handleOptionToggle = (optionIndex: number) => {
    if (!currentQuestion || !currentAnswer) return;

    if (currentQuestion.type === 'single') {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...currentAnswer,
          selectedOptions: [optionIndex],
        },
      }));
    } else if (currentQuestion.type === 'multiple') {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...currentAnswer,
          selectedOptions: (currentAnswer.selectedOptions || []).includes(optionIndex)
            ? (currentAnswer.selectedOptions || []).filter(i => i !== optionIndex)
            : [...(currentAnswer.selectedOptions || []), optionIndex],
        },
      }));
    }
  };

  // 단답형/장문형 답안 변경
  const handleTextChange = (text: string) => {
    if (!currentQuestion || !currentAnswer) return;

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentAnswer,
        textAnswer: text,
      },
    }));
  };

  // 다음 문항
  const handleNext = () => {
    if (currentIndex < activeQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // 이전 문항
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleStartRetry = () => {
    if (!quiz.allowRetry) return;

    const nextAttempt = (quizResult?.attemptNumber || lastResult?.attemptNumber || 1) + 1;
    setCurrentAttemptNumber(nextAttempt);
    setSubmitted(false);
    setQuizResult(null);
    setRewardClaimed(false);
    setClaimedItem(null);
    setSelectedRewardId(null);
    setEligibleRewards([]);
    
    const qs = prepareAttemptQuestions(quiz, session.studentId, nextAttempt);
    setActiveQuestions(qs);
    setAnswers(buildInitialAnswers(qs));
    setCurrentIndex(0);
    setSubmitError('');
  };

  // 퀴즈 제출
  const handleSubmit = async () => {
    console.log('[Student Quiz] ========== handleSubmit START ==========');
    setIsSubmitting(true);
    setSubmitError('');

    try {
      if (!currentQuestion) {
        setSubmitError('문항을 불러올 수 없습니다.');
        setIsSubmitting(false);
        return;
      }

      if (lastResult && !quiz.allowRetry && !retryRequested) {
        setSubmitError('이미 제출한 퀴즈입니다.');
        setIsSubmitting(false);
        return;
      }

      const studentAnswersForGrading: StudentAnswer[] = Object.entries(answers).map(([questionId, a]) => ({
        questionId,
        selectedOptions: a.selectedOptions || [],
        textAnswer: a.textAnswer || '',
        isAutoGraded: false,
        earnedPoints: 0,
        needsReview: false,
      }));

      // 자동 채점 수행
      const { results: gradedResults, totalScore: earnedTotalScore, correctCount } = gradeAllAnswers(
        studentAnswersForGrading,
        activeQuestions
      );

      const hasPendingReview = gradedResults.some(gr => gr.needsReview);
      const totalPossibleScore = activeQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
      const pendingScore = gradedResults
        .filter(gr => gr.needsReview)
        .reduce((sum, gr) => {
          const question = activeQuestions.find(q => q.id === gr.questionId);
          return sum + (question?.points || 0);
        }, 0);

      const eligible = !hasPendingReview
        ? getEligibleRewardsForAttempt(quiz, earnedTotalScore, currentAttemptNumber)
        : [];

      const finalQuizResult: StudentQuizResult = {
        id: crypto.randomUUID(),
        quizId: quiz.id,
        classId: session.classId || classCode,
        classCode,
        attendanceNumber: session.attendanceNumber,
        studentId: session.studentId,
        score: earnedTotalScore,
        autoScore: earnedTotalScore,
        pendingScore,
        totalScore: totalPossibleScore,
        answers: gradedResults.map(gr => ({
          questionId: gr.questionId,
          selectedOptions: studentAnswersForGrading.find(a => a.questionId === gr.questionId)?.selectedOptions || [],
          textAnswer: studentAnswersForGrading.find(a => a.questionId === gr.questionId)?.textAnswer || '',
          isAutoGraded: !gr.needsReview,
          earnedPoints: gr.earnedPoints,
          needsReview: gr.needsReview,
        })),
        isCompleted: true,
        selectedRewardOptionId: undefined,
        eligibleRewardOptionIds: eligible.map(r => r.id),
        gradingStatus: hasPendingReview ? 'pending_review' : 'auto_complete',
        submittedAt: new Date().toISOString(),
        correctCount,
        totalCount: activeQuestions.length,
        attemptNumber: currentAttemptNumber,
        isRetryAttempt: currentAttemptNumber > 1,
        rewardClaimedPerAttempt: {
          ...(lastResult?.rewardClaimedPerAttempt || {}),
          [currentAttemptNumber]: false,
        },
        questionSnapshot: activeQuestions.map(q => q.id),
      };

      console.log('[Student Quiz] Final quiz result to submit:', finalQuizResult);

      const submitResponse = await submitQuizResult(finalQuizResult);
      console.log('[Student Quiz] submitQuizResult response:', submitResponse);

      if (submitResponse.success) {
        const savedResult = submitResponse.data || finalQuizResult;
        setQuizResult(savedResult);
        setLastResult(savedResult);
        setSubmitted(true);
        setEligibleRewards(eligible);
      } else {
        setSubmitError(submitResponse.error || '퀴즈 제출 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('[Student Quiz] Exception during submit:', error);
      setSubmitError('제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 보상 선택
  const handleClaimReward = async () => {
    if (!selectedRewardId || !quizResult) return;

    setIsClaimingReward(true);
    setSubmitError('');

    try {
      const result = await claimReward(
        quiz.id,
        session.studentId,
        selectedRewardId,
        quizResult.attemptNumber
      );

      if (!result.success) {
        setSubmitError(result.error || '보상 수령 중 오류가 발생했습니다.');
        return;
      }

      setRewardClaimed(true);
      const reward = getRewardOptionsForAttempt(quiz, quizResult.attemptNumber || 1)
        .find(r => r.id === selectedRewardId);
      if (reward) {
        setClaimedItem({ name: reward.itemName, icon: reward.itemIcon || '🎁' });
      }

      setQuizResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          selectedRewardOptionId: selectedRewardId,
          rewardClaimedAt: new Date().toISOString(),
          rewardClaimedPerAttempt: {
            ...(prev.rewardClaimedPerAttempt || {}),
            [prev.attemptNumber || 1]: true,
          },
        };
      });
    } catch (error) {
      console.error(error);
      setSubmitError('보상 수령 중 오류가 발생했습니다.');
    } finally {
      setIsClaimingReward(false);
    }
  };

  // 보상 선택 화면
  if (submitted && eligibleRewards.length > 0 && !rewardClaimed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                축하합니다!
              </CardTitle>
              <CardDescription>
                {quizResult?.score ?? 0}점을 획득했습니다. 보상을 선택해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {eligibleRewards.map((reward, index) => (
                  <div
                    key={reward.id || `reward-${index}`}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedRewardId === String(reward.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedRewardId(String(reward.id))}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedRewardId === String(reward.id)}
                        onCheckedChange={() => setSelectedRewardId(String(reward.id))}
                      />
                      <RewardVisual reward={reward} size={52} />
                      <div>
                        <p className="font-semibold">{reward.itemName}</p>
                        <p className="text-sm text-muted-foreground">{reward.itemDescription}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {submitError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {submitError}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full h-12 text-lg"
                disabled={!selectedRewardId || isClaimingReward}
                onClick={handleClaimReward}
              >
                {isClaimingReward ? '처리 중...' : '보상 받기'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  // 결과 화면
  if (submitted && quizResult) {
    const isPending = quizResult.gradingStatus === 'pending_review';

    return (
      <main className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                {isPending ? (
                  <Sparkles className="w-8 h-8 text-primary" />
                ) : (
                  <Trophy className="w-8 h-8 text-primary" />
                )}
              </div>
              <CardTitle className="text-2xl">
                {isPending ? '제출 완료!' : '퀴즈 완료!'}
              </CardTitle>
              <CardDescription>
                {isPending ? '선생님의 채점을 기다려주세요.' : '수고하셨습니다! 결과를 확인해보세요.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-xl border text-center">
                  <p className="text-sm text-muted-foreground mb-1">점수</p>
                  <p className="text-4xl font-bold text-primary">
                    {quizResult.score}
                    <span className="text-lg text-muted-foreground ml-1">/ {quizResult.totalScore}</span>
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl border text-center">
                  <p className="text-sm text-muted-foreground mb-1">정답 문항</p>
                  <p className="text-4xl font-bold">
                    {quizResult.correctCount ?? 0}
                    <span className="text-lg text-muted-foreground ml-1">/ {quizResult.totalCount ?? activeQuestions.length}</span>
                  </p>
                </div>
              </div>

              {rewardClaimed && claimedItem && (
                <div className="bg-green-50 border border-green-200 p-6 rounded-xl text-center">
                  <div className="text-4xl mb-2">{claimedItem.icon}</div>
                  <p className="text-green-800 font-semibold">{claimedItem.name} 수령 완료!</p>
                  <p className="text-green-600 text-sm mt-1">내 방 꾸미기에서 확인해보세요.</p>
                </div>
              )}

              {quiz.allowRetry && (
                <div className="flex flex-col gap-2">
                  <p className="text-center text-sm text-muted-foreground">
                    더 높은 점수에 도전하고 싶나요? (현재 {quizResult.attemptNumber}회차)
                  </p>
                  <Button variant="outline" className="w-full gap-2" onClick={handleStartRetry}>
                    <RotateCcw className="w-4 h-4" />
                    다시 도전하기
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-3">
              <Link href={`/student/dashboard?code=${classCode}`} className="flex-1">
                <Button variant="secondary" className="w-full">대시보드</Button>
              </Link>
              <Link href={`/student/room?code=${classCode}`} className="flex-1">
                <Button className="w-full">내 방 가기</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  // 문항 풀이 화면
  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* 상단 프로그레스 */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {quiz.title} ({currentIndex + 1}/{activeQuestions.length})
            </span>
            <Badge variant="secondary" className={typeBadgeClass[currentQuestion?.type || 'single']}>
              {typeLabels[currentQuestion?.type || 'single']}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 mt-6">
        <Card className="border-none shadow-md">
          <CardHeader className="pb-8">
            <div className="flex justify-between items-start gap-4">
              <CardTitle className="text-xl md:text-2xl leading-relaxed">
                {currentQuestion?.text}
              </CardTitle>
              <Badge variant="outline" className="shrink-0 font-mono">
                {currentQuestion?.points}점
              </Badge>
            </div>
            {currentQuestion?.hint && (
              <p className="text-sm text-muted-foreground mt-4 flex items-center gap-1.5 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <strong>힌트:</strong> {currentQuestion.hint}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {(currentQuestion?.type === 'single' || currentQuestion?.type === 'multiple') && (
              <div className="grid gap-3">
                {currentQuestion.options?.map((option, idx) => {
                  const isSelected = (currentAnswer?.selectedOptions || []).includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex items-center gap-4 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-muted hover:border-primary/30'
                      }`}
                      onClick={() => handleOptionToggle(idx)}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-primary bg-primary text-white' : 'border-muted'
                      }`}>
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>
                      <span className={isSelected ? 'font-medium text-primary' : ''}>
                        {option}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {currentQuestion?.type === 'short' && (
              <div className="space-y-2">
                <Input
                  placeholder="답안을 입력하세요"
                  className="text-lg h-14"
                  value={currentAnswer?.textAnswer || ''}
                  onChange={(e) => handleTextChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">띄어쓰기와 대소문자를 구분하지 않습니다.</p>
              </div>
            )}

            {currentQuestion?.type === 'essay' && (
              <Textarea
                placeholder="답안을 자유롭게 서술하세요"
                className="min-h-[200px] text-lg leading-relaxed p-4"
                value={currentAnswer?.textAnswer || ''}
                onChange={(e) => handleTextChange(e.target.value)}
              />
            )}
          </CardContent>
        </Card>

        {submitError && (
          <div className="mt-4 p-4 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {submitError}
          </div>
        )}
      </div>

      {/* 하단 네비게이션 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            이전
          </Button>
          
          {currentIndex === activeQuestions.length - 1 ? (
            <Button
              className="flex-[2] h-12 text-lg font-bold"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '제출 중...' : '최종 제출하기'}
            </Button>
          ) : (
            <Button
              className="flex-[2] h-12 text-lg"
              onClick={handleNext}
            >
              다음 문항
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function StudentQuiz() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <QuizContent />
    </Suspense>
  );
}

// 간단한 Input 컴포넌트 (없을 경우 대비)
function Input({ className, ...props }: any) {
  return (
    <input
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
