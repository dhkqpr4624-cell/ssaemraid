'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ClipboardCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getQuizResults, getQuizzes, getStudentsByClassCode } from '@/lib/db-wrapper';
import type { Quiz, Student, StudentQuizResult } from '@/lib/types';

function statusLabel(status?: string) {
  if (status === 'pending_review') return '채점 대기';
  if (status === 'fully_graded' || status === 'graded') return '채점 완료';
  return '자동 채점 완료';
}

function rewardLabel(result: StudentQuizResult) {
  const attempt = result.attemptNumber || 1;
  const claimedMap = result.rewardClaimedPerAttempt || {};
  return result.selectedRewardOptionId || claimedMap[attempt] || claimedMap[String(attempt) as any]
    ? '수령 완료'
    : '미수령';
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const classCode = searchParams.get('code') ?? '';
  const quizId = searchParams.get('quizId') ?? '';
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<StudentQuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLatestOnly, setShowLatestOnly] = useState(false);

  const load = async () => {
    if (!classCode || !quizId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [quizList, resultList, studentList] = await Promise.all([
        getQuizzes(classCode),
        getQuizResults(quizId),
        getStudentsByClassCode(classCode),
      ]);
      setQuiz(quizList.find(q => q.id === quizId || q.quiz_id === quizId) || null);
      setResults(resultList);
      setStudents(studentList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classCode, quizId]);

  const studentMap = useMemo(() => {
    const map = new Map<number, Student>();
    students.forEach(s => map.set(s.attendanceNumber, s));
    return map;
  }, [students]);

  const visibleResults = useMemo(() => {
    if (!showLatestOnly) return results;
    const latest = new Map<number, StudentQuizResult>();
    results.forEach(r => {
      const prev = latest.get(r.attendanceNumber);
      if (!prev || (r.attemptNumber || 1) > (prev.attemptNumber || 1)) {
        latest.set(r.attendanceNumber, r);
      }
    });
    return Array.from(latest.values()).sort((a, b) => a.attendanceNumber - b.attendanceNumber);
  }, [results, showLatestOnly]);

  if (loading) {
    return <main className="min-h-screen p-8 text-center text-muted-foreground">결과를 불러오는 중...</main>;
  }

  return (
    <main className="min-h-screen p-4 md:p-8 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Link href={`/teacher/dashboard?code=${classCode}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> 대시보드로 돌아가기
            </Link>
            <h1 className="text-2xl font-bold">퀴즈 결과</h1>
            <p className="text-sm text-muted-foreground">{quiz?.title || quizId}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowLatestOnly(v => !v)}>
              {showLatestOnly ? '전체 attempt 보기' : '학생별 최신 attempt만 보기'}
            </Button>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
            </Button>
            <Link href={`/teacher/quiz/grade?code=${classCode}`}>
              <Button>
                <ClipboardCheck className="w-4 h-4 mr-1" /> 채점 화면
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>제출 결과</CardTitle>
            <CardDescription>재도전이 있는 경우 attempt 회차별로 표시됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {visibleResults.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">아직 제출 결과가 없습니다.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>학생</TableHead>
                    <TableHead>회차</TableHead>
                    <TableHead>총점</TableHead>
                    <TableHead>자동 점수</TableHead>
                    <TableHead>채점 대기 점수</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>보상</TableHead>
                    <TableHead>제출 시간</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleResults.map(result => {
                    const student = studentMap.get(result.attendanceNumber);
                    return (
                      <TableRow key={result.id}>
                        <TableCell>{result.attendanceNumber}번 {student?.nickname || ''}</TableCell>
                        <TableCell>{result.attemptNumber || 1}회차</TableCell>
                        <TableCell className="font-mono">{result.score} / {result.totalScore || quiz?.totalScore || '-'}</TableCell>
                        <TableCell className="font-mono">{result.autoScore ?? 0}</TableCell>
                        <TableCell className="font-mono">{result.pendingScore ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant={result.gradingStatus === 'pending_review' ? 'outline' : 'secondary'}>
                            {statusLabel(result.gradingStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell>{rewardLabel(result)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {result.submittedAt ? new Date(result.submittedAt).toLocaleString('ko-KR') : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function QuizResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
