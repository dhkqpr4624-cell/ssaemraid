'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  Users,
  FileQuestion,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
} from 'lucide-react';
import {
  getPendingReviewResults,
  gradeEssayAnswer,
  getQuizzes,
  getStudentsByClassCode,
} from '@/lib/db-wrapper';
import type { StudentQuizResult, Quiz, Student } from '@/lib/types';

interface GradeEntry {
  result: StudentQuizResult;
  quiz: Quiz | null;
  student: Student | null;
  essayAnswers: {
    questionId: string;
    questionText: string;
    maxPoints: number;
    studentAnswer: string;
    currentScore: number;
    inputScore: string;
    isSaved: boolean;
  }[];
}

function GradeContent() {
  const searchParams = useSearchParams();
  const classCode = searchParams.get('code') ?? '';

  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [savedCount, setSavedCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!classCode) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    const [pending, students, quizzes] = await Promise.all([
      getPendingReviewResults(classCode),
      getStudentsByClassCode(classCode),
      getQuizzes(classCode),
    ]);

    const built: GradeEntry[] = pending.map(result => {
      const quiz = quizzes.find(q => q.id === result.quizId || q.quiz_id === result.quizId) ?? null;
      const student =
        students.find(s => s.id === result.studentId) ??
        students.find(s => s.attendanceNumber === result.attendanceNumber) ??
        null;

      const answerList = Array.isArray(result.answers) ? result.answers : [];
      const essayAnswers = answerList
        .filter(a => a.needsReview)
        .map(a => {
          const question = quiz?.questions.find(q => q.id === a.questionId);
          return {
            questionId: a.questionId,
            questionText: question?.text ?? `문항 ID: ${a.questionId}`,
            maxPoints: question?.points ?? 0,
            studentAnswer: a.textAnswer ?? '',
            currentScore: a.earnedPoints ?? 0,
            inputScore: String(a.earnedPoints ?? 0),
            isSaved: false,
          };
        });

      return { result, quiz, student, essayAnswers };
    }).filter(entry => entry.essayAnswers.length > 0);

    setEntries(built);
    // 첫 번째 항목 자동 펼치기
    if (built.length > 0) {
      setExpandedIds(new Set([built[0].result.id]));
    }
    setIsLoading(false);
  }, [classCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateScore = (resultId: string, questionId: string, value: string) => {
    setEntries(prev =>
      prev.map(entry => {
        if (entry.result.id !== resultId) return entry;
        return {
          ...entry,
          essayAnswers: entry.essayAnswers.map(ea =>
            ea.questionId === questionId ? { ...ea, inputScore: value, isSaved: false } : ea
          ),
        };
      })
    );
  };

  const saveGrade = async (resultId: string, questionId: string) => {
    const entry = entries.find(e => e.result.id === resultId);
    if (!entry) return;

    const ea = entry.essayAnswers.find(a => a.questionId === questionId);
    if (!ea) return;

    const score = parseInt(ea.inputScore);
    if (isNaN(score) || score < 0 || score > ea.maxPoints) {
      setSaveErrors(prev => ({
        ...prev,
        [`${resultId}-${questionId}`]: `0~${ea.maxPoints} 사이의 점수를 입력하세요.`,
      }));
      return;
    }

    setSavingId(`${resultId}-${questionId}`);
    setSaveErrors(prev => {
      const next = { ...prev };
      delete next[`${resultId}-${questionId}`];
      return next;
    });

    try {
      const result = await gradeEssayAnswer(classCode, resultId, questionId, score);
      if (result.success) {
        setEntries(prev =>
          prev.map(entry => {
            if (entry.result.id !== resultId) return entry;
            const updatedEssayAnswers = entry.essayAnswers.map(a =>
              a.questionId === questionId
                ? { ...a, currentScore: score, isSaved: true }
                : a
            );
            // 모든 장문형이 채점되었으면 목록에서 제거
            const allSaved = updatedEssayAnswers.every(a => a.isSaved);
            if (allSaved) {
              setSavedCount(c => c + 1);
              return null as unknown as GradeEntry;
            }
            return { ...entry, essayAnswers: updatedEssayAnswers };
          }).filter(Boolean)
        );
      } else {
        setSaveErrors(prev => ({
          ...prev,
          [`${resultId}-${questionId}`]: result.error || '저장 실패',
        }));
      }
    } catch {
      setSaveErrors(prev => ({
        ...prev,
        [`${resultId}-${questionId}`]: '저장 중 오류가 발생했습니다.',
      }));
    } finally {
      setSavingId(null);
    }
  };

  const saveAllForEntry = async (resultId: string) => {
    const entry = entries.find(e => e.result.id === resultId);
    if (!entry) return;

    for (const ea of entry.essayAnswers) {
      if (!ea.isSaved) {
        await saveGrade(resultId, ea.questionId);
      }
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <Link
            href={`/teacher/dashboard?code=${classCode}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            대시보드로 돌아가기
          </Link>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">장문형 채점</h1>
                <p className="text-sm text-muted-foreground">
                  클래스: <span className="font-mono font-semibold">{classCode}</span>
                </p>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              새로고침
            </Button>
          </div>
        </div>

        {/* 완료 알림 */}
        {savedCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 mb-4">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">{savedCount}명의 채점이 완료되어 점수가 반영되었습니다.</p>
          </div>
        )}

        {/* 채점 목록 */}
        {entries.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-70" />
              <p className="font-medium text-lg mb-1">채점 대기 중인 답안이 없습니다</p>
              <p className="text-sm text-muted-foreground mb-4">
                모든 장문형 답안이 채점되었거나 아직 제출된 답안이 없습니다.
              </p>
              <Link href={`/teacher/dashboard?code=${classCode}`}>
                <Button variant="outline">대시보드로 돌아가기</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {entries.map(entry => {
              const isExpanded = expandedIds.has(entry.result.id);
              const unsavedCount = entry.essayAnswers.filter(a => !a.isSaved).length;

              return (
                <Card key={entry.result.id} className="overflow-hidden">
                  {/* 항목 헤더 */}
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => toggleExpand(entry.result.id)}
                  >
                    <CardHeader className="pb-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {entry.student?.attendanceNumber ?? '?'}
                          </div>
                          <div>
                            <p className="font-semibold">
                              {entry.student?.nickname ?? '(알 수 없음)'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.quiz?.title ?? '(퀴즈 없음)'} ·{' '}
                              현재 {entry.result.score}점 / {entry.quiz?.totalScore ?? '?'}점
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {unsavedCount > 0 && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              {unsavedCount}개 미채점
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {/* 장문형 답안 목록 */}
                  {isExpanded && (
                    <CardContent className="pt-0 space-y-4">
                      {entry.essayAnswers.map(ea => {
                        const errorKey = `${entry.result.id}-${ea.questionId}`;
                        const isSaving = savingId === errorKey;

                        return (
                          <div key={ea.questionId} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                    장문형
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    최대 {ea.maxPoints}점
                                  </span>
                                </div>
                                <p className="text-sm font-medium">{ea.questionText}</p>
                              </div>
                              {ea.isSaved && (
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                              )}
                            </div>

                            {/* 학생 답안 */}
                            <div className="bg-muted/50 rounded-md p-3">
                              <p className="text-xs text-muted-foreground mb-1">학생 답안</p>
                              <p className="text-sm whitespace-pre-wrap">
                                {ea.studentAnswer || '(답안 없음)'}
                              </p>
                            </div>

                            {/* 점수 입력 */}
                            <div className="flex items-end gap-3">
                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground mb-1 block">
                                  부여 점수 (0 ~ {ea.maxPoints})
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={ea.maxPoints}
                                  value={ea.inputScore}
                                  onChange={e =>
                                    updateScore(entry.result.id, ea.questionId, e.target.value)
                                  }
                                  className="h-9 text-sm"
                                  disabled={ea.isSaved}
                                />
                              </div>
                              <Button
                                size="sm"
                                onClick={() => saveGrade(entry.result.id, ea.questionId)}
                                disabled={isSaving || ea.isSaved}
                                className={ea.isSaved ? 'bg-green-500 hover:bg-green-500' : ''}
                              >
                                {ea.isSaved ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    채점 완료
                                  </>
                                ) : isSaving ? (
                                  '저장 중...'
                                ) : (
                                  <>
                                    <Save className="w-3.5 h-3.5 mr-1" />
                                    채점 저장
                                  </>
                                )}
                              </Button>
                            </div>

                            {saveErrors[errorKey] && (
                              <div className="flex items-center gap-2 text-destructive text-xs">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                {saveErrors[errorKey]}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* 전체 저장 버튼 */}
                      {entry.essayAnswers.some(a => !a.isSaved) && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => saveAllForEntry(entry.result.id)}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          이 학생 전체 채점 저장
                        </Button>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function GradePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">로딩 중...</p>
        </main>
      }
    >
      <GradeContent />
    </Suspense>
  );
}
