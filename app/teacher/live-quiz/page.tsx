'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, SkipForward, X, CheckCircle, Users } from 'lucide-react';
import { getQuizzes, updateLiveSession, getLiveSession, getStudentsByClassCode, getLiveParticipants, getLiveAnswers, clearLiveParticipants, clearLiveAnswers } from '@/lib/db-wrapper';
import { getCurrentQuestion, selectRandomQuestions, shuffleQuestions } from '@/lib/live-quiz';
import { getQuizQuestionCountLabel } from '@/lib/quiz-display';
import { LiveQuizSession, Quiz, Student, QuizQuestion } from '@/lib/types';

function studentNo(student: Student) {
  return String(student.attendanceNumber);
}

function studentName(students: Student[], attendanceNumber: string) {
  const found = students.find(s => String(s.attendanceNumber) === String(attendanceNumber));
  return found ? `${found.attendanceNumber}번 ${found.nickname}` : `${attendanceNumber}번`;
}

function isAnswerCorrect(question: QuizQuestion, answer: any) {
  if (!question || !answer) return false;
  if (question.type === 'single') {
    return Number(answer.selectedOptions?.[0]) === Number(question.correctAnswers?.[0]);
  }
  if (question.type === 'multiple') {
    const selected = [...(answer.selectedOptions || [])].map(Number).sort((a, b) => a - b);
    const correct = [...(question.correctAnswers || [])].map(Number).sort((a, b) => a - b);
    return selected.length === correct.length && selected.every((value, index) => value === correct[index]);
  }
  if (question.type === 'short') {
    const value = String(answer.textAnswer || '').trim().toLowerCase().replace(/\s+/g, '');
    return (question.shortAnswers || []).some(item => String(item).trim().toLowerCase().replace(/\s+/g, '') === value);
  }
  return false;
}

function answerLabel(question: QuizQuestion | null) {
  if (!question) return '';
  if (question.type === 'short') return (question.shortAnswers || []).join(', ');
  return (question.correctAnswers || []).map(index => question.options?.[index] || `${index + 1}번`).join(', ');
}

export default function LiveQuizPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');
  const quizId = searchParams.get('quizId');

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [selectedAnswerOption, setSelectedAnswerOption] = useState<number | null>(null);
  const [showCorrectStudents, setShowCorrectStudents] = useState(false);
  const [showWrongStudents, setShowWrongStudents] = useState(false);
  const expiringQuestionKeyRef = useRef<string | null>(null);

  const loadSession = async () => {
    if (!code || !quizId) return;
    const latest = await getLiveSession(code, quizId);
    if (latest) {
      let merged: any = latest;
      try {
        const participants = await getLiveParticipants(code, quizId);
        const questionIndex = Number((latest as any).currentQuestionIndex ?? 0);
        const answers = await getLiveAnswers(code, quizId, questionIndex);
        const studentAnswers = { ...((latest as any).studentAnswers || {}) };
        studentAnswers[String(questionIndex)] = { ...(studentAnswers[String(questionIndex)] || {}), ...(answers || {}) };
        merged = {
          ...(latest as any),
          participatingStudents: participants.length > 0 ? participants : ((latest as any).participatingStudents || []),
          submittedStudents: Object.keys(studentAnswers[String(questionIndex)] || {}),
          studentAnswers,
        };
      } catch (err) {
        console.warn('실시간 참여자/답안 병합 실패:', err);
      }
      setSession(merged as any);
      setTimeLimit(Number((merged as any).timeLimitSeconds || 60));
    }
  };

  useEffect(() => {
    if (!code || !quizId) return;

    const loadInitialData = async () => {
      try {
        const quizzes = await getQuizzes(code);
        const quizData = quizzes.find(q => q.id === quizId || q.quiz_id === quizId);
        const studentsData = await getStudentsByClassCode(code);
        setQuiz(quizData || null);
        setStudents(studentsData);

        if (quizData) {
          const existing = await getLiveSession(code, quizData.id);
          if (existing && existing.status !== 'ended') {
            const wasStaleWaiting = existing.status === 'waiting' && (!(existing as any).teacherLiveHeartbeat || Date.now() - new Date((existing as any).teacherLiveHeartbeat).getTime() > 15000);
            if (wasStaleWaiting) { await clearLiveParticipants(code, quizData.id); await clearLiveAnswers(code, quizData.id); }
            const opened = await updateLiveSession(code, quizData.id, {
              isTeacherLiveOpen: true,
              teacherLiveHeartbeat: new Date().toISOString(),
              ...(wasStaleWaiting ? {
                participatingStudents: [],
                submittedStudents: [],
                participantHeartbeats: {},
                studentAnswers: {},
              } : {}),
            });
            setSession((opened || existing) as any);
            setTimeLimit(Number((opened as any)?.timeLimitSeconds || (existing as any).timeLimitSeconds || 60));
          } else {
            await clearLiveParticipants(code, quizData.id);
            await clearLiveAnswers(code, quizData.id);
            const prepared = await updateLiveSession(code, quizData.id, {
              status: 'waiting',
              currentQuestionIndex: 0,
              selectedQuestionIds: quizData.questions.map(q => q.id),
              participatingStudents: [],
              submittedStudents: [],
              studentAnswers: {},
              timeLimitSeconds: 60,
              isTeacherLiveOpen: true,
              teacherLiveHeartbeat: new Date().toISOString(),
              startedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              endReason: null,
              endedManually: false,
              endedAt: null,
            });
            setSession(prepared as any);
          }
        }
      } catch (err) {
        console.error('데이터 로딩 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [code, quizId]);

  useEffect(() => {
    if (!code || !quizId) return;
    const timer = setInterval(loadSession, 1000);
    return () => clearInterval(timer);
  }, [code, quizId]);


  useEffect(() => {
    if (!code || !quiz?.id || session?.status === 'ended') return;
    const sendHeartbeat = () => {
      updateLiveSession(code, quiz.id, {
        isTeacherLiveOpen: true,
        teacherLiveHeartbeat: new Date().toISOString(),
      }).catch(err => console.error('함께 풀기 heartbeat 실패:', err));
    };
    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 10000);
    return () => clearInterval(timer);
  }, [code, quiz?.id, session?.status]);

  useEffect(() => {
    if (!session || session.status !== 'question_active') return;
    const tick = () => {
      const start = session.questionStartedAt ? new Date(session.questionStartedAt).getTime() : Date.now();
      const remaining = Math.max(0, Number(session.timeLimitSeconds || timeLimit || 60) - Math.floor((Date.now() - start) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) handleTimeExpired(session.currentQuestionIndex, session.questionStartedAt || '');
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.status, session?.currentQuestionIndex, session?.questionStartedAt, session?.timeLimitSeconds]);

  useEffect(() => {
    setShowCorrectStudents(false);
    setShowWrongStudents(false);
  }, [session?.currentQuestionIndex]);

  useEffect(() => {
    if (!session || !code || !quiz) return;
    if (session.status !== 'question_active') return;
    const total = session.participatingStudents.length;
    const questionKey = String(session.currentQuestionIndex ?? 0);
    const answersForCurrentQuestion = ((session as any).studentAnswers || {})[questionKey] || {};
    const submittedForCurrentQuestion = (session.submittedStudents || [])
      .map(String)
      .filter(no => !!answersForCurrentQuestion[no]);
    if (total > 0 && submittedForCurrentQuestion.length >= total) {
      updateLiveSession(code, quiz.id, { status: 'showing_answer' }).then(updated => setSession(updated as any));
    }
  }, [session?.submittedStudents?.length, session?.participatingStudents?.length, session?.status]);

  const currentQuestion = session && quiz ? getCurrentQuestion(session, quiz.questions) : null;
  const answersForQuestion = (session as any)?.studentAnswers?.[String(session?.currentQuestionIndex ?? 0)] || {};
  const correctStudents = useMemo(() => {
    if (!currentQuestion) return [];
    return Object.entries(answersForQuestion)
      .filter(([, answer]) => isAnswerCorrect(currentQuestion, answer))
      .map(([attendanceNumber]) => attendanceNumber);
  }, [answersForQuestion, currentQuestion]);
  const wrongStudents = useMemo(() => {
    const participants = session?.participatingStudents || [];
    return participants.filter(no => !correctStudents.includes(no));
  }, [session?.participatingStudents, correctStudents]);

  const handleStartLiveQuiz = async () => {
    if (!quiz || !code || !session) return;
    const latestParticipants = await getLiveParticipants(code, quiz.id);
    await clearLiveAnswers(code, quiz.id);

    // 실시간 함께 풀기에서는 시작 버튼을 누르는 순간 교사용 세션에
    // 랜덤 출제/랜덤 순서를 한 번만 확정해서 저장합니다.
    // 이후 모든 학생은 같은 selectedQuestionIds를 읽기 때문에 같은 문제를 같은 순서로 풉니다.
    let selectedQuestions = [...quiz.questions];
    if (quiz.randomPickEnabled && Number(quiz.randomPickCount || 0) > 0) {
      selectedQuestions = selectRandomQuestions(
        selectedQuestions,
        Math.min(Number(quiz.randomPickCount || 0), selectedQuestions.length),
      );
    }
    if (quiz.shuffleQuestionsEnabled) {
      selectedQuestions = shuffleQuestions(selectedQuestions);
    }

    const updated = await updateLiveSession(code, quiz.id, {
      status: 'question_active',
      currentQuestionIndex: 0,
      selectedQuestionIds: selectedQuestions.map(q => q.id),
      participatingStudents: latestParticipants.length > 0 ? latestParticipants : (session.participatingStudents || []),
      submittedStudents: [],
      studentAnswers: {},
      timeLimitSeconds: Math.max(5, Number(timeLimit || 60)),
      questionStartedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      endReason: null,
      endedManually: false,
      endedAt: null,
    });
    setSession(updated as any);
  };

  const handleTimeExpired = async (expectedQuestionIndex?: number, expectedQuestionStartedAt?: string) => {
    if (!session || !code || !quiz || session.status !== 'question_active') return;

    const questionIndex = expectedQuestionIndex ?? session.currentQuestionIndex;
    const startedAt = expectedQuestionStartedAt ?? session.questionStartedAt ?? '';
    const expireKey = `${questionIndex}_${startedAt}`;
    if (expiringQuestionKeyRef.current === expireKey) return;
    expiringQuestionKeyRef.current = expireKey;

    try {
      // 이전 문제의 타이머가 다음 문제 시작 직후 뒤늦게 실행되는 경우를 막기 위해,
      // DB의 최신 세션이 여전히 같은 문제/같은 시작 시간인지 확인한 뒤에만 결과 화면으로 넘깁니다.
      const latest = await getLiveSession(code, quiz.id);
      const latestStartedAt = (latest as any)?.questionStartedAt || '';
      const latestTimeLimit = Number((latest as any)?.timeLimitSeconds || timeLimit || 60);
      if (!latest || latest.status !== 'question_active') return;
      if (Number(latest.currentQuestionIndex) !== Number(questionIndex)) return;
      if (String(latestStartedAt) !== String(startedAt)) return;

      const start = latestStartedAt ? new Date(latestStartedAt).getTime() : Date.now();
      const remaining = Math.max(0, latestTimeLimit - Math.floor((Date.now() - start) / 1000));
      if (remaining > 0) return;

      const updated = await updateLiveSession(code, quiz.id, { status: 'showing_answer' });
      if (updated) setSession(updated as any);
    } finally {
      setTimeout(() => {
        if (expiringQuestionKeyRef.current === expireKey) expiringQuestionKeyRef.current = null;
      }, 1000);
    }
  };

  const handleShowAnswer = async () => {
    if (!session || !code || !quiz || session.status !== 'question_active') return;
    const updated = await updateLiveSession(code, quiz.id, { status: 'showing_answer' });
    if (updated) setSession(updated as any);
  };

  const handleNextQuestion = async () => {
    setSelectedAnswerOption(null);
    if (!session || !code || !quiz) return;
    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex >= session.selectedQuestionIds.length) {
      const updated = await updateLiveSession(code, quiz.id, { status: 'ended', isTeacherLiveOpen: false, endReason: 'completed', endedManually: false, endedAt: new Date().toISOString() });
      setSession(updated as any);
      return;
    }

    const nextStartedAt = new Date().toISOString();
    setTimeRemaining(Number(session.timeLimitSeconds || timeLimit || 60));
    expiringQuestionKeyRef.current = null;
    const updated = await updateLiveSession(code, quiz.id, {
      status: 'question_active',
      currentQuestionIndex: nextIndex,
      submittedStudents: [],
      questionStartedAt: nextStartedAt,
    });
    setSession(updated as any);
  };

  const handleEndQuiz = async () => {
    if (!session || !code || !quiz) return;
    const updated = await updateLiveSession(code, quiz.id, { status: 'ended', isTeacherLiveOpen: false, endReason: 'manual', endedManually: true, endedAt: new Date().toISOString() });
    setSession(updated as any);
  };

  const handleEndQuizWithConfirm = async () => {
    if (window.confirm('정말 끝내겠습니까?')) {
      await handleEndQuiz();
    }
  };

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;
  if (!quiz) return <div className="p-8 text-center">퀴즈를 찾을 수 없습니다.</div>;

  const participantCount = session?.participatingStudents?.length || 0;
  const submittedCount = session?.status === 'question_active'
    ? (session?.submittedStudents || []).map(String).filter(no => !!answersForQuestion[no]).length
    : (session?.submittedStudents?.length || 0);
  const canShowAnswer = session?.status === 'question_active' && (timeRemaining <= 0 || (participantCount > 0 && submittedCount >= participantCount));
  const activeParticipants = session?.participatingStudents || [];
  const choiceStats = currentQuestion?.options?.map((option, index) => {
    const selectedStudents = Object.entries(answersForQuestion)
      .filter(([, answer]: any) => (answer?.selectedOptions || []).map(Number).includes(index))
      .map(([attendanceNumber]) => attendanceNumber)
      .filter(no => activeParticipants.includes(String(no)));
    return { index, option, selectedStudents };
  }) || [];
  const selectedOptionDetail = selectedAnswerOption !== null ? choiceStats.find(item => item.index === selectedAnswerOption) : null;
  const renderStudentSummaryBox = (type: 'correct' | 'wrong', studentNumbers: string[]) => {
    const isCorrectBox = type === 'correct';
    const expanded = isCorrectBox ? showCorrectStudents : showWrongStudents;
    const setExpanded = isCorrectBox ? setShowCorrectStudents : setShowWrongStudents;
    return (
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className={`w-full rounded-lg p-4 text-left transition-all hover:ring-2 hover:ring-offset-1 ${isCorrectBox ? 'bg-blue-50 hover:ring-blue-200' : 'bg-red-50 hover:ring-red-200'}`}
      >
        <p className="font-bold">{isCorrectBox ? '정답자' : '오답자/미제출'} {studentNumbers.length}명</p>
        <p className="mt-1 text-xs text-gray-500">자세히 보려면 클릭</p>
        {expanded && (
          <div className="mt-3 flex flex-wrap gap-2">
            {studentNumbers.length > 0 ? (
              studentNumbers.map(no => (
                <Badge key={no} variant={isCorrectBox ? 'default' : 'destructive'}>{studentName(students, no)}</Badge>
              ))
            ) : (
              <span className="text-sm text-gray-500">해당 학생이 없습니다.</span>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <img src="/assets/logo.png" alt="쌤퀘스트 로고" className="h-10 w-auto" />
          <div>
            <h1 className="text-3xl font-bold">🎮 함께 풀기 모드</h1>
            <p className="text-gray-600">{quiz.title}</p>
          </div>
        </div>

        {(!session || session.status === 'waiting') && (
          <Card>
            <CardHeader>
              <CardTitle>함께 풀기 준비</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-semibold mb-2">📋 퀴즈 정보</p>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• 제목: {quiz.title}</li>
                  <li>• 문제 수: {getQuizQuestionCountLabel(quiz)}</li>
                  <li>• 현재 참여 학생: {participantCount}명</li>
                </ul>
              </div>

              <div className="max-w-xs space-y-2">
                <Label htmlFor="time-limit">문제 당 제한 시간(초)</Label>
                <Input id="time-limit" type="number" min={5} value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value || 60))} />
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <p className="font-semibold mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> 참여 학생 목록 <Badge>{participantCount}</Badge></p>
                {participantCount > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {session?.participatingStudents.map(no => <Badge key={no} variant="secondary">{studentName(students, no)}</Badge>)}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">학생 대시보드의 ‘같이 풀기 참여하기’ 버튼으로 학생들이 입장하면 여기에 표시됩니다.</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button onClick={handleEndQuizWithConfirm} variant="outline" className="text-red-600">
                  <X className="w-4 h-4 mr-2" /> 퀴즈 끝내기
                </Button>
                <Button onClick={handleStartLiveQuiz} className="flex-1" size="lg" disabled={participantCount === 0}>
                  <Play className="w-4 h-4 mr-2" /> 함께 풀기 시작
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {session && session.status === 'question_active' && currentQuestion && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>문제 {session.currentQuestionIndex + 1}/{session.selectedQuestionIds.length}</span>
                  <Badge className={timeRemaining <= 10 ? 'bg-red-500' : 'bg-blue-500'}>{timeRemaining}초</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xl font-bold">{currentQuestion.text}</div>
                {currentQuestion.options?.map((option, index) => (
                  <div key={index} className="p-3 rounded-lg bg-gray-50 border">{index + 1}. {option}</div>
                ))}
                <div className="bg-yellow-50 p-4 rounded-lg font-semibold">제출 현황: {submittedCount}/{participantCount}명</div>
                <div className="flex gap-3">
                  <Button onClick={handleEndQuizWithConfirm} variant="outline" className="text-red-600">
                    <X className="w-4 h-4 mr-2" /> 퀴즈 끝내기
                  </Button>
                  <Button onClick={handleShowAnswer} variant="outline" className="flex-1" disabled={!canShowAnswer}>
                    <CheckCircle className="w-4 h-4 mr-2" /> 정답 보기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {session && session.status === 'showing_answer' && currentQuestion && (
          <Card>
            <CardHeader>
              <CardTitle>정답 보기</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                <p className="font-bold text-green-800">정답: {answerLabel(currentQuestion)}</p>
              </div>

              {currentQuestion.options && currentQuestion.type !== 'short' ? (
                <div className="grid lg:grid-cols-[1fr_320px] gap-4">
                  <div className="space-y-3">
                    <p className="font-bold">문제</p>
                    <div className="p-4 rounded-lg bg-white border text-lg font-semibold">{currentQuestion.text}</div>
                    {choiceStats.map(({ index, option, selectedStudents }) => {
                      const isCorrect = (currentQuestion.correctAnswers || []).map(Number).includes(index);
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedAnswerOption(index)}
                          className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                            isCorrect
                              ? 'bg-green-50 border-green-300 hover:bg-green-100'
                              : selectedStudents.length > 0
                                ? 'bg-red-50 border-red-200 hover:bg-red-100'
                                : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                          } ${selectedAnswerOption === index ? 'ring-2 ring-blue-300' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="font-semibold">{index + 1}. {option}</div>
                            <Badge variant={isCorrect ? 'default' : 'secondary'}>{selectedStudents.length}명 선택</Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border bg-white p-4 min-h-[220px]">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold">선택 학생</p>
                      {selectedOptionDetail && (
                        <button onClick={() => setSelectedAnswerOption(null)} className="text-sm text-gray-500 hover:text-gray-900">✕</button>
                      )}
                    </div>
                    {selectedOptionDetail ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">{selectedOptionDetail.index + 1}번 문항을 선택한 학생</p>
                        {selectedOptionDetail.selectedStudents.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedOptionDetail.selectedStudents.map(no => <Badge key={no}>{studentName(students, no)}</Badge>)}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">이 문항을 선택한 학생이 없습니다.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">왼쪽 문항을 누르면 선택한 학생 목록이 표시됩니다.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {renderStudentSummaryBox('correct', correctStudents)}
                  {renderStudentSummaryBox('wrong', wrongStudents)}
                </div>
              )}

              {currentQuestion.options && currentQuestion.type !== 'short' && (
                <div className="grid md:grid-cols-2 gap-4">
                  {renderStudentSummaryBox('correct', correctStudents)}
                  {renderStudentSummaryBox('wrong', wrongStudents)}
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <Button onClick={handleEndQuizWithConfirm} variant="ghost" className="text-red-600"><X className="w-4 h-4 mr-2" />퀴즈 끝내기</Button>
                <Button onClick={handleNextQuestion}><SkipForward className="w-4 h-4 mr-2" />{session.currentQuestionIndex >= session.selectedQuestionIds.length - 1 ? '퀴즈 결과' : '다음 문제로'}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {session?.status === 'ended' && (
          <Card className="bg-green-50 border-2 border-green-200">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-2xl font-bold text-green-800">🎉 퀴즈 결과</p>
              <p>참여 학생 {participantCount}명 · 모든 문제가 종료되었습니다.</p>
              <Button onClick={() => router.push(`/teacher/dashboard?code=${code}`)}>대시보드로 돌아가기</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
