'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock } from 'lucide-react';
import { getStudentSession } from '@/lib/class-storage';
import { getQuizzes, getLiveSession, updateLiveSession, submitQuizResult, findStudent, getQuizResult, upsertLiveParticipantHeartbeat, upsertLiveAnswer, getLiveAnswers } from '@/lib/db-wrapper';
import { LiveQuizSession, Quiz, Student, QuizQuestion, StudentAnswer, StudentQuizResult } from '@/lib/types';

function normalizeText(text: string) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '');
}

function gradeAnswer(question: QuizQuestion, answer: any): StudentAnswer {
  const result: StudentAnswer = {
    questionId: question.id,
    selectedOptions: answer?.selectedOptions || [],
    textAnswer: answer?.textAnswer || '',
    isAutoGraded: question.type !== 'essay',
    earnedPoints: 0,
    needsReview: question.type === 'essay',
  };

  if (question.type === 'single') {
    if (Number(result.selectedOptions?.[0]) === Number(question.correctAnswers?.[0])) result.earnedPoints = question.points;
  } else if (question.type === 'multiple') {
    const selected = [...(result.selectedOptions || [])].map(Number).sort((a, b) => a - b);
    const correct = [...(question.correctAnswers || [])].map(Number).sort((a, b) => a - b);
    if (selected.length === correct.length && selected.every((value, index) => value === correct[index])) result.earnedPoints = question.points;
  } else if (question.type === 'short') {
    if ((question.shortAnswers || []).some(item => normalizeText(item) === normalizeText(result.textAnswer || ''))) result.earnedPoints = question.points;
  }

  return result;
}

function getCurrentQuestion(sess: LiveQuizSession | null, quiz: Quiz | null) {
  if (!sess || !quiz) return null;
  const questionId = sess.selectedQuestionIds?.[sess.currentQuestionIndex];
  return quiz.questions.find(q => q.id === questionId) || null;
}

export default function StudentLiveQuizPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');
  const quizId = searchParams.get('quizId');

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number[] | string>('');
  const [submitted, setSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rewardSubmitted, setRewardSubmitted] = useState(false);
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState<any>(null);

  const attendanceNumber = student ? String(student.attendanceNumber) : '';
  const currentQuestion = useMemo(() => getCurrentQuestion(session, quiz), [session, quiz]);

  const loadSession = async () => {
    if (!code || !quizId) return;
    const latest = await getLiveSession(code, quiz?.id || quizId);
    if (latest) setSession(latest as any);
  };

  useEffect(() => {
    if (!code || !quizId) return;

    const loadData = async () => {
      try {
        const quizzes = await getQuizzes(code);
        const quizData = quizzes.find(q => q.id === quizId || q.quiz_id === quizId);
        const savedStudentSession = getStudentSession();
        const attendanceNumber = savedStudentSession?.classCode === code ? Number(savedStudentSession.attendanceNumber) : NaN;
        const studentResult = Number.isFinite(attendanceNumber) ? await findStudent(code, attendanceNumber) : null;
        const studentData = studentResult?.success && studentResult.student ? studentResult.student : null;
        const initialSession = await getLiveSession(code, quizData?.id || quizId);

        setQuiz(quizData || null);
        setStudent(studentData);
        if (initialSession && (initialSession as any).isTeacherLiveOpen === true && studentData && quizData) {
          const no = String(studentData.attendanceNumber);
          await upsertLiveParticipantHeartbeat(code, quizData.id, no);
          setSession(initialSession as any);
        }
      } catch (err) {
        console.error('데이터 로딩 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [code, quizId]);

  useEffect(() => {
    if (!code || !quizId) return;
    const timer = setInterval(loadSession, 1000);
    return () => clearInterval(timer);
  }, [code, quizId]);


  useEffect(() => {
    if (!code || !quiz?.id || !student || !session || session.status === 'ended') return;
    const no = String(student.attendanceNumber);
    const sendHeartbeat = async () => {
      try {
        await upsertLiveParticipantHeartbeat(code, quiz.id, no);
      } catch (err) {
        console.error('학생 참여 heartbeat 실패:', err);
      }
    };
    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 10000);
    return () => clearInterval(timer);
  }, [code, quiz?.id, student?.attendanceNumber, session?.status]);

  useEffect(() => {
    setSelectedAnswer('');
    setLastSubmittedAnswer(null);
    const answers = (session as any)?.studentAnswers?.[String(session?.currentQuestionIndex ?? 0)] || {};
    setSubmitted(!!(attendanceNumber && answers[attendanceNumber]));
  }, [session?.currentQuestionIndex, attendanceNumber]);

  useEffect(() => {
    if (!session || session.status !== 'question_active') return;
    const tick = () => {
      const start = session.questionStartedAt ? new Date(session.questionStartedAt).getTime() : Date.now();
      const remaining = Math.max(0, Number(session.timeLimitSeconds || 60) - Math.floor((Date.now() - start) / 1000));
      setTimeRemaining(remaining);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.status, session?.currentQuestionIndex, session?.questionStartedAt, session?.timeLimitSeconds]);


  useEffect(() => {
    if (!lastSubmittedAnswer || !submitted || !session || session.status !== 'question_active' || !quiz || !code || !student) return;
    if (Number(lastSubmittedAnswer.questionIndex) !== Number(session.currentQuestionIndex)) return;
    const no = String(student.attendanceNumber);
    const questionIndex = String(lastSubmittedAnswer.questionIndex);
    const answersForQuestion = ((session as any).studentAnswers || {})[questionIndex] || {};
    const isPersisted = !!answersForQuestion[no] && (session.submittedStudents || []).map(String).includes(no);
    if (isPersisted) return;

    let cancelled = false;
    const repairSubmission = async () => {
      try {
        const latest = await getLiveSession(code, quiz.id);
        const base: any = latest || session;
        if (base.status !== 'question_active' || Number(base.currentQuestionIndex) !== Number(lastSubmittedAnswer.questionIndex)) return;
        await upsertLiveAnswer(code, quiz.id, Number(questionIndex), no, lastSubmittedAnswer.answer);
        const studentAnswers = { ...((base as any).studentAnswers || {}) };
        studentAnswers[questionIndex] = { ...(studentAnswers[questionIndex] || {}), [no]: lastSubmittedAnswer.answer };
        const updated = { ...base, studentAnswers, submittedStudents: Array.from(new Set([...(base.submittedStudents || []).map(String), no])) };
        if (!cancelled && updated) setSession(updated as any);
      } catch (err) {
        console.error('실시간 정답 제출 보정 실패:', err);
      }
    };
    repairSubmission();
    return () => { cancelled = true; };
  }, [session, submitted, lastSubmittedAnswer, quiz?.id, code, student?.attendanceNumber]);

  useEffect(() => {
    const submitFinalResult = async () => {
      if (!session || !quiz || !student || !code || rewardSubmitted || session.status !== 'ended') return;
      const endReason = (session as any).endReason;
      const isManualEnd = endReason ? endReason === 'manual' : (session as any).endedManually === true;
      if (isManualEnd) {
        setRewardSubmitted(true);
        return;
      }
      const studentAnswersByQuestion = { ...((session as any).studentAnswers || {}) };
      for (let i = 0; i < (session.selectedQuestionIds || []).length; i += 1) {
        try {
          const answersForQuestion = await getLiveAnswers(code, quiz.id, i);
          studentAnswersByQuestion[String(i)] = { ...(studentAnswersByQuestion[String(i)] || {}), ...(answersForQuestion || {}) };
        } catch {}
      }
      const activeQuestions = session.selectedQuestionIds.map(id => quiz.questions.find(q => q.id === id)).filter(Boolean) as QuizQuestion[];
      const gradedAnswers = activeQuestions.map((question, index) => gradeAnswer(question, studentAnswersByQuestion[String(index)]?.[String(student.attendanceNumber)] || {}));
      const score = gradedAnswers.reduce((sum, answer) => sum + Number(answer.earnedPoints || 0), 0);
      const hasPendingReview = gradedAnswers.some(answer => answer.needsReview);
      const totalScore = activeQuestions.reduce((sum, q) => sum + Number(q.points || 0), 0);
      const eligibleRewardOptionIds = hasPendingReview ? [] : (quiz.rewardOptions || [])
        .filter(reward => score >= Number(reward.requiredScore || 0))
        .map(reward => reward.id);

      const previousResult = await getQuizResult(quiz.id, student.id);
      const attemptNumber = Number(previousResult?.attemptNumber || 0) + 1;

      const result: StudentQuizResult = {
        id: crypto.randomUUID(),
        quizId: quiz.id,
        classId: student.classId || code,
        classCode: code,
        attendanceNumber: student.attendanceNumber,
        studentId: student.id,
        score,
        autoScore: score,
        pendingScore: hasPendingReview ? totalScore - score : 0,
        totalScore,
        answers: gradedAnswers,
        eligibleRewardOptionIds,
        selectedRewardOptionId: undefined,
        submittedAt: new Date().toISOString(),
        gradingStatus: hasPendingReview ? 'pending_review' : 'auto_complete',
        isCompleted: true,
        correctCount: gradedAnswers.filter(answer => answer.earnedPoints > 0).length,
        totalCount: activeQuestions.length,
        attemptNumber,
        isRetryAttempt: attemptNumber > 1,
        rewardClaimedPerAttempt: { ...((previousResult as any)?.rewardClaimedPerAttempt || {}), [attemptNumber]: false },
        questionSnapshot: activeQuestions.map(q => q.id),
      };

      const response = await submitQuizResult(result);
      setRewardSubmitted(true);
      if (response.success) {
        router.push(`/student/quiz?quizId=${quiz.id}&code=${code}&reward=1`);
      }
    };

    submitFinalResult();
  }, [session?.status, quiz, student, rewardSubmitted]);

  const handleSubmit = async () => {
    if (!session || !student || !currentQuestion || !quiz || !code || submitted) return;
    const no = String(student.attendanceNumber);
    const answer = currentQuestion.type === 'short'
      ? { textAnswer: String(selectedAnswer || '') }
      : { selectedOptions: Array.isArray(selectedAnswer) ? selectedAnswer : [Number(selectedAnswer)] };

    const submittingQuestionIndex = session.currentQuestionIndex;
    setSubmitted(true);
    setLastSubmittedAnswer({ questionIndex: submittingQuestionIndex, answer });

    const saveAnswer = async () => {
      const latest = await getLiveSession(code, quiz.id);
      const base: any = latest || session;
      if (base.status !== 'question_active' || Number(base.currentQuestionIndex) !== Number(submittingQuestionIndex)) {
        return base;
      }
      const questionIndex = String(submittingQuestionIndex);
      await upsertLiveAnswer(code, quiz.id, submittingQuestionIndex, no, answer);
      const studentAnswers = { ...((base as any).studentAnswers || {}) };
      studentAnswers[questionIndex] = { ...(studentAnswers[questionIndex] || {}), [no]: answer };
      const submittedStudents = Array.from(new Set([...(base.submittedStudents || []).map(String), no]));
      return { ...base, studentAnswers, submittedStudents };
    };

    try {
      let updated = await saveAnswer();
      const questionIndex = String((updated as any)?.currentQuestionIndex ?? session.currentQuestionIndex);
      const persisted = !!((updated as any)?.studentAnswers?.[questionIndex]?.[no])
        && ((updated as any)?.submittedStudents || []).map(String).includes(no);
      if (!persisted) {
        updated = await saveAnswer();
      }
      if (updated) setSession(updated as any);
    } catch (err) {
      console.error('실시간 정답 제출 실패:', err);
      setSubmitted(false);
      alert('정답 제출 중 오류가 발생했습니다. 다시 제출해 주세요.');
    }
  };

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;
  if (!quiz || !student) return <div className="p-8 text-center">데이터를 찾을 수 없습니다.</div>;

  if (!session || session.status === 'waiting') {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-purple-50 to-pink-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-purple-500" />
            <p className="text-xl font-semibold mb-2">잠시 대기해주세요</p>
            <p className="text-gray-600">선생님이 함께 풀기를 시작하면 자동으로 문제가 표시됩니다.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (session.status === 'ended') {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-purple-50 to-pink-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <p className="text-xl font-semibold mb-2">퀴즈가 종료되었습니다!</p>
            <p className="text-gray-600 mb-4">{((session as any).endReason ? (session as any).endReason === 'manual' : (session as any).endedManually === true) ? '선생님이 중간에 퀴즈를 종료하여 보상은 지급되지 않습니다.' : '보상이 있는 경우 곧 보상 화면으로 이동합니다.'}</p>
            <Button onClick={() => router.push('/student/dashboard')}>대시보드로 가기</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!currentQuestion) return <div className="p-8 text-center">문제를 찾을 수 없습니다.</div>;

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-purple-50 to-pink-50">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/assets/logo.png" alt="쌤퀘스트 로고" className="h-8 w-auto" />
            <div>
              <h1 className="text-xl font-bold">{quiz.title}</h1>
              <p className="text-sm text-gray-600">문제 {session.currentQuestionIndex + 1}/{session.selectedQuestionIds.length}</p>
            </div>
          </div>
          <div className={`text-3xl font-bold ${timeRemaining < 10 ? 'text-red-600' : 'text-purple-600'}`}>{timeRemaining}초</div>
        </div>

        <Card className="mb-6 overflow-hidden">
          <CardHeader className="bg-white border-b">
            <CardTitle className="flex items-center justify-between">
              <span className="text-lg">{currentQuestion.text}</span>
              <Badge variant="secondary">{currentQuestion.points}점</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {currentQuestion.options && currentQuestion.type !== 'short' && (
              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    disabled={submitted || session.status !== 'question_active'}
                    onClick={() => {
                      if (currentQuestion.type === 'multiple') {
                        const arr = Array.isArray(selectedAnswer) ? selectedAnswer : [];
                        setSelectedAnswer(arr.includes(idx) ? arr.filter(i => i !== idx) : [...arr, idx]);
                      } else {
                        setSelectedAnswer([idx]);
                      }
                    }}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${Array.isArray(selectedAnswer) && selectedAnswer.includes(idx) ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full bg-white border flex items-center justify-center font-bold text-sm">{idx + 1}</span><span className="font-medium">{option}</span></div>
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'short' && (
              <input
                type="text"
                disabled={submitted || session.status !== 'question_active'}
                value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
                onChange={e => setSelectedAnswer(e.target.value)}
                placeholder="답을 입력하세요..."
                className="w-full p-4 border-2 border-gray-100 rounded-xl focus:border-purple-500 focus:outline-none bg-gray-50/50"
              />
            )}
          </CardContent>
        </Card>

        {submitted ? (
          <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-100 text-center">
            <p className="font-bold text-blue-700">제출 완료! 선생님의 다음 지시를 기다려주세요.</p>
          </div>
        ) : session.status === 'question_active' ? (
          <Button
            onClick={handleSubmit}
            disabled={selectedAnswer === '' || (Array.isArray(selectedAnswer) && selectedAnswer.length === 0)}
            className="w-full h-14 text-lg rounded-xl shadow-lg shadow-purple-200"
            size="lg"
          >
            정답 제출
          </Button>
        ) : (
          <div className="p-4 rounded-xl bg-green-50 border-2 border-green-100 text-center">
            <p className="font-bold text-green-700">정답 확인 중입니다. 잠시 기다려주세요.</p>
          </div>
        )}
      </div>
    </main>
  );
}
