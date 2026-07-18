'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ArrowLeft, Sparkles, Copy, Check, ArrowRight, Users } from 'lucide-react';
import { createClass } from '@/lib/db-wrapper';
import type { ClassRoom, Student } from '@/lib/types';

/**
 * 클래스 생성 페이지
 * - 클래스 이름, 학생 수, 교사용 비밀번호 입력
 * - 생성 후 클래스 코드 표시
 * - localStorage에 저장 (TODO: DB로 교체)
 */
export default function CreateClassPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [createdClass, setCreatedClass] = useState<ClassRoom | null>(null);
  const [createdStudents, setCreatedStudents] = useState<Student[]>([]);
  const [copied, setCopied] = useState(false);

  // Form state
  const [className, setClassName] = useState('');
  const [studentCount, setStudentCount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 클라이언트 사이드 검증
    if (!className.trim()) {
      setError('클래스 이름을 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }

    const count = parseInt(studentCount);
    if (isNaN(count) || count < 1) {
      setError('학생 수는 1명 이상이어야 합니다.');
      return;
    }

    if (count > 50) {
      setError('학생 수는 50명 이하여야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      // Supabase 또는 localStorage에 클래스 생성
      const result = await createClass(className, count, password);
      
      if (!result.success || !result.classroom) {
        setError(result.error || '클래스 생성 실패');
        setIsLoading(false);
        return;
      }
      
      // 학생 자동 생성 (1번부터 count번까지)
      const students: Student[] = Array.from({ length: count }, (_, i) => ({
        id: `student-${i + 1}`,
        classId: result.classroom!.code,
        attendanceNumber: i + 1,
        nickname: `학생${i + 1}`,
        score: 0,
        coins: 0,
        items: [],
        avatarState: {},
        roomState: {},
      }));
      
      setCreatedClass(result.classroom);
      setCreatedStudents(students);
      
      // 최근 클래스에 저장
      if (typeof window !== 'undefined') {
        const recentClasses = JSON.parse(localStorage.getItem('recentTeacherClasses') || '[]');
        const newClass = {
          id: result.classroom.id,
          name: result.classroom.name,
          code: result.classroom.code,
          studentCount: result.classroom.studentCount,
          lastAccessedAt: new Date().toISOString()
        };
        
        const filtered = recentClasses.filter((c: any) => c.code !== result.classroom.code);
        const updated = [newClass, ...filtered].slice(0, 5);
        localStorage.setItem('recentTeacherClasses', JSON.stringify(updated));
      }
      
      setStep('success');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('클래스 생성 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = async () => {
    if (createdClass) {
      await navigator.clipboard.writeText(createdClass.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goToDashboard = () => {
    if (createdClass) {
      router.push(`/teacher/dashboard?code=${createdClass.code}`);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <Link 
            href="/teacher" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            돌아가기
          </Link>
          <h1 className="text-3xl font-bold">새 클래스 만들기</h1>
          <p className="text-muted-foreground mt-1">
            수업에 사용할 새 클래스를 만들어보세요
          </p>
        </div>

        {step === 'form' ? (
          /* 클래스 생성 폼 */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                클래스 정보
              </CardTitle>
              <CardDescription>
                클래스 기본 정보를 입력해주세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="className">클래스 이름</FieldLabel>
                    <Input
                      id="className"
                      placeholder="예: 3학년 2반 수학"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="studentCount">학생 수</FieldLabel>
                    <Input
                      id="studentCount"
                      type="number"
                      placeholder="예: 25"
                      min={1}
                      max={50}
                      value={studentCount}
                      onChange={(e) => setStudentCount(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      출석번호 1번부터 자동으로 학생이 생성됩니다 (1~50명)
                    </p>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="password">교사용 비밀번호</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      placeholder="4자 이상"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={4}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      클래스 관리에 사용됩니다
                    </p>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="confirmPassword">비밀번호 확인</FieldLabel>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="비밀번호 다시 입력"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </Field>

                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? '생성 중...' : '클래스 만들기'}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* 클래스 생성 완료 */
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              
              <h2 className="text-2xl font-bold mb-2">클래스가 생성되었습니다!</h2>
              <p className="text-muted-foreground mb-6">
                아래 코드를 학생들에게 알려주세요
              </p>

              {/* 클래스 코드 표시 */}
              <div className="bg-muted rounded-xl p-6 mb-6">
                <p className="text-sm text-muted-foreground mb-2">클래스 코드</p>
                <p className="text-5xl font-mono font-bold tracking-[0.4em] text-primary">
                  {createdClass?.code}
                </p>
              </div>

              {/* 코드 복사 버튼 */}
              <Button
                variant="outline"
                onClick={copyCode}
                className="mb-6"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    복사됨!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    코드 복사하기
                  </>
                )}
              </Button>

              <div className="border-t pt-6">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                  <span className="font-semibold text-foreground">{createdClass?.name}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    학생 {createdStudents.length}명 생성됨
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground mb-4">
                  출석번호 1번 ~ {createdStudents.length}번 학생이 자동 생성되었습니다
                </p>
                
                <Button onClick={goToDashboard} className="w-full">
                  교사 대시보드로 이동
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
