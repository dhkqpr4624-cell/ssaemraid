'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Trophy,
  Coins,
  Sparkles,
  FileQuestion,
  Package,
  LogOut,
  RefreshCw,
  Gift,
  Check,
  Clock,
  Play,
  Shirt,
  RotateCcw,
} from 'lucide-react';
import {
  getStudentSession,
  clearStudentSession,
} from '@/lib/class-storage';
import { findStudent, findClassByCode, getQuizzes, getQuizResult, getLiveSessionsForClass } from '@/lib/db-wrapper';
import { AvatarRenderer } from '@/components/avatar/AvatarRenderer';
import type { Student, ClassRoom, Quiz, StudentSession, StudentQuizResult } from '@/lib/types';

// 퀴즈 상태 타입
type QuizStatus =
  | 'not_started'
  | 'pending_review'
  | 'reward_available'
  | 'reward_claimed'
  | 'retry_available'
  | 'completed';

function isRewardClaimedForAttempt(result: StudentQuizResult | null) {
  if (!result) return false;
  const attemptNumber = result.attemptNumber || 1;
  const claimedMap = (result.rewardClaimedPerAttempt || {}) as any;
  return !!result.selectedRewardOptionId || !!claimedMap[attemptNumber] || !!claimedMap[String(attemptNumber)];
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

function getQuizStatus(quiz: Quiz, result: StudentQuizResult | null): { status: QuizStatus; result?: StudentQuizResult } {
  if (!result) return { status: 'not_started' };

  const rewardClaimed = isRewardClaimedForAttempt(result);
  const rewardOptions = getRewardOptionsForAttempt(quiz, result.attemptNumber || 1);
  const eligibleIds = (result.eligibleRewardOptionIds || []).filter(Boolean).map(id => String(id));
  const hasRewardToChoose =
    eligibleIds.some(id => rewardOptions.some(reward => String(reward.id) === id)) ||
    rewardOptions.some(reward => (result.score ?? 0) >= Number(reward.requiredScore ?? 0));

  if (result.gradingStatus === 'pending_review') return { status: 'pending_review', result };
  if (hasRewardToChoose && !rewardClaimed) return { status: 'reward_available', result };
  if (quiz.allowRetry && (rewardClaimed || !hasRewardToChoose)) return { status: 'retry_available', result };
  if (rewardClaimed) return { status: 'reward_claimed', result };

  return { status: 'completed', result };
}

const statusConfig: Record<QuizStatus, { label: string; color: string; icon: React.ReactNode }> = {
  not_started: {
    label: '풀기',
    color: 'bg-primary text-primary-foreground',
    icon: <Play className="w-3.5 h-3.5" />,
  },
  pending_review: {
    label: '채점 대기',
    color: 'bg-orange-400 text-white',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  reward_available: {
    label: '보상 선택',
    color: 'bg-yellow-500 text-white',
    icon: <Gift className="w-3.5 h-3.5" />,
  },
  reward_claimed: {
    label: '보상 수령 완료',
    color: 'bg-green-500 text-white',
    icon: <Check className="w-3.5 h-3.5" />,
  },
  retry_available: {
    label: '다시 도전하기',
    color: 'bg-blue-500 text-white',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
  },
  completed: {
    label: '완료',
    color: 'bg-green-500 text-white',
    icon: <Check className="w-3.5 h-3.5" />,
  },
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<StudentSession | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [classroom, setClassroom] = useState<ClassRoom | null>(null);
  const [activeQuizzes, setActiveQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quizResultsByQuizId, setQuizResultsByQuizId] = useState<Record<string, StudentQuizResult | null>>({});
  const [liveSessionsByQuizId, setLiveSessionsByQuizId] = useState<Record<string, any>>({});

  const loadData = async () => {
    const savedSession = getStudentSession();
    if (!savedSession) {
      router.push('/student');
      return;
    }
    setSession(savedSession);

    try {
      const studentRes = await findStudent(savedSession.classCode, savedSession.attendanceNumber);
      const classData = await findClassByCode(savedSession.classCode);

      if (studentRes.success && studentRes.student && classData) {
        setStudent(studentRes.student);
        setClassroom(classData);

        const allQuizzes = await getQuizzes(savedSession.classCode);
        const active = allQuizzes.filter(q => q.isActive);
        setActiveQuizzes(active);

        const resultEntries = await Promise.all(
          active.map(async quiz => {
            const result = await getQuizResult(quiz.id, savedSession.studentId);
            return [quiz.id, result] as const;
          })
        );

        const resultMap = Object.fromEntries(resultEntries);
        setQuizResultsByQuizId(resultMap);

        const liveSessions = await getLiveSessionsForClass(savedSession.classCode);
        setLiveSessionsByQuizId(Object.fromEntries(liveSessions.map((live: any) => [live.quizId, live])));

        resultEntries.forEach(([id, result]) => {
          const quiz = active.find(q => q.id === id);
          if (quiz) {
            console.log('[Student Dashboard] Quiz status:', quiz.title, getQuizStatus(quiz, result).status);
          }
        });
      } else {
        clearStudentSession();
        router.push('/student');
        return;
      }
    } catch (err) {
      console.error('데이터 로딩 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);


  useEffect(() => {
    if (!session?.classCode) return;
    const timer = setInterval(async () => {
      const liveSessions = await getLiveSessionsForClass(session.classCode);
      setLiveSessionsByQuizId(Object.fromEntries(liveSessions.map((live: any) => [live.quizId, live])));
    }, 3000);
    return () => clearInterval(timer);
  }, [session?.classCode]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleLogout = () => {
    clearStudentSession();
    router.push('/student');
  };

  if (isLoading) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4 text-4xl">🎒</div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </main>
    );
  }

  if (!student || !classroom || !session) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">학생 정보를 찾을 수 없습니다.</p>
        <Link href="/student">
          <Button variant="outline">돌아가기</Button>
        </Link>
      </main>
    );
  }

  const level = Math.floor(student.score / 100) + 1;
  const expProgress = student.score % 100;

  const pendingRewardCount = activeQuizzes.filter(q => {
    const result = quizResultsByQuizId[q.id] || null;
    const { status } = getQuizStatus(q, result);
    return status === 'reward_available';
  }).length;

  return (
    <main className="min-h-screen p-4 pb-24 md:p-8 bg-muted/20">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/student"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              나가기
            </Link>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                새로고침
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                로그아웃
              </Button>
            </div>
          </div>

          {/* 프로필 카드 */}
          <Card className="overflow-hidden border-2 border-primary/20 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <AvatarRenderer 
                    avatarState={student.avatarState || { skinColor: '#FFE0BD', equipped: {} }} 
                    inventory={student.items}
                    size="sprite"
                    facing="front"
                    showAnimation={false}
                    useSprite={true}
                    className="border-primary/10 shadow-md bg-white rounded-lg"
                  />
                  <Link href="/student/avatar" className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                    <Shirt className="w-5 h-5" />
                  </Link>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold">{student.nickname}</h1>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none">Lv.{level}</Badge>
                    {pendingRewardCount > 0 && (
                      <Badge className="bg-yellow-500 text-white animate-pulse">
                        보상 {pendingRewardCount}개
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {classroom.name} · {student.attendanceNumber}번
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span>Experience</span>
                      <span>{expProgress}%</span>
                    </div>
                    <Progress value={expProgress} className="h-2 bg-primary/10" />
                  </div>

                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-bold">{student.score}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-bold">{student.coins}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold">{student.items.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-dashed flex gap-3 justify-center">
                <Link href="/student/avatar" className="flex-1">
                  <Button variant="outline" className="w-full gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all">
                    <Sparkles className="w-4 h-4" />
                    내 아바타 꾸미기
                  </Button>
                </Link>
                <Link href="/student/room" className="flex-1">
                  <Button variant="outline" className="w-full gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all">
                    <Package className="w-4 h-4" />
                    내 방 꾸미기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 진행 중인 퀴즈 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-primary" />
              진행 중인 퀴즈
            </h2>
            {activeQuizzes.length > 0 && (
              <Badge variant="secondary" className="font-mono">{activeQuizzes.length}</Badge>
            )}
          </div>

          {activeQuizzes.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {activeQuizzes.map(quiz => {
                const result = quizResultsByQuizId[quiz.id] || null;
                const { status } = getQuizStatus(quiz, result);
                const config = statusConfig[status];
                const href =
                  status === 'retry_available'
                    ? `/student/quiz?quizId=${quiz.id}&code=${session.classCode}&retry=1`
                    : status === 'reward_available'
                      ? `/student/quiz?quizId=${quiz.id}&code=${session.classCode}&reward=1`
                      : `/student/quiz?quizId=${quiz.id}&code=${session.classCode}`;

                return (
                  <Card key={quiz.id} className="hover:shadow-md transition-all border-l-4 border-l-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-xl">
                          📝
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base truncate">{quiz.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {quiz.questions.length}문항 · {quiz.totalScore}점
                            </span>
                            {result && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
                                {result.attemptNumber || 1}회차 · {result.score}점
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          {liveSessionsByQuizId[quiz.id] && liveSessionsByQuizId[quiz.id].status !== 'ended' && (
                            <Link href={`/student/live-quiz?quizId=${quiz.id}&code=${session.classCode}`}>
                              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-9 px-4 shadow-sm">
                                <Play className="w-3.5 h-3.5" />
                                {liveSessionsByQuizId[quiz.id].status === 'waiting' ? '같이 풀기 참여하기' : '같이 풀기 이어하기'}
                              </Button>
                            </Link>
                          )}

                          {status === 'pending_review' ? (
                            <Button
                              size="sm"
                              className={`${config.color} gap-1.5 h-9 px-4 shadow-sm`}
                              disabled
                            >
                              {config.icon}
                              {config.label}
                            </Button>
                          ) : (
                            <Link href={href}>
                              <Button
                                size="sm"
                                className={`${config.color} gap-1.5 h-9 px-4 shadow-sm`}
                              >
                                {config.icon}
                                {config.label}
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">지금은 진행 중인 퀴즈가 없습니다.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
