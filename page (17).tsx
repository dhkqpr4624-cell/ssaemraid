'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ArrowLeft, LogIn, Clock, Users, ChevronRight } from 'lucide-react';
import { saveStudentSession } from '@/lib/class-storage';
import { findStudent, findClassByCode } from '@/lib/db-wrapper';
import type { ClassRoom } from '@/lib/types';



type RecentStudentClass = Pick<ClassRoom, 'id' | 'name' | 'code' | 'studentCount' | 'lastAccessedAt'> & {
  attendanceNumber: number;
  nickname?: string;
};

const RECENT_STUDENT_CLASSES_KEY = 'recentStudentClasses';

function loadRecentStudentClasses(): RecentStudentClass[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_STUDENT_CLASSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentStudentClass(classroom: ClassRoom, attendanceNumber: number, nickname?: string) {
  if (typeof window === 'undefined') return;
  const next: RecentStudentClass = {
    id: classroom.id,
    name: classroom.name,
    code: classroom.code,
    studentCount: classroom.studentCount,
    lastAccessedAt: new Date().toISOString(),
    attendanceNumber,
    nickname,
  };
  const rest = loadRecentStudentClasses().filter(
    item => !(item.code === classroom.code && item.attendanceNumber === attendanceNumber)
  );
  localStorage.setItem(RECENT_STUDENT_CLASSES_KEY, JSON.stringify([next, ...rest].slice(0, 5)));
}

function formatRecentDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/**
 * 학생 입장 페이지
 * - 클래스 코드 입력
 * - 출석번호 입력
 * - 입장 버튼
 */
export default function StudentPage() {
  const router = useRouter();
  const [classCode, setClassCode] = useState('');
  const [attendanceNumber, setAttendanceNumber] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentClasses, setRecentClasses] = useState<RecentStudentClass[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setRecentClasses(loadRecentStudentClasses());
  }, []);



  const handleRecentEnter = (recent: RecentStudentClass) => {
    setClassCode(recent.code);
    setAttendanceNumber(String(recent.attendanceNumber));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 입력 검증
    if (!classCode.trim()) {
      setError('클래스 코드를 입력해주세요.');
      setIsLoading(false);
      return;
    }

    const number = parseInt(attendanceNumber);
    if (isNaN(number) || number < 1) {
      setError('올바른 출석번호를 입력해주세요. (1 이상)');
      setIsLoading(false);
      return;
    }

    try {
      const code = classCode.toUpperCase();
      
      // 1. 클래스 확인
      const classroom = await findClassByCode(code);
      if (!classroom) {
        setError('클래스를 찾을 수 없습니다.');
        setIsLoading(false);
        return;
      }

      // 2. 학생 확인
      const result = await findStudent(code, number);
      
      if (result.success && result.student) {
        // 세션 데이터 생성
        const session = {
          classCode: code,
          classId: classroom.id,
          className: classroom.name,
          attendanceNumber: number,
          studentId: result.student.id,
          nickname: result.student.nickname,
        };
        
        // 세션 저장
        saveStudentSession(session);
        saveRecentStudentClass(classroom, number, result.student.nickname);
        
        // 대시보드로 이동
        router.push('/student/dashboard');
      } else {
        setError(result.error || '클래스 코드 또는 출석번호가 올바르지 않습니다.');
      }
    } catch (err) {
      console.error(err);
      setError('입장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <Link 
            href="/" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            처음으로
          </Link>
          
          <div className="mb-4 flex justify-center">
            <img src="/assets/logo.png" alt="쌤퀘스트 로고" className="h-16 w-auto object-contain" />
          </div>
          
          <h1 className="text-3xl font-bold">학생 입장</h1>
          <p className="text-muted-foreground mt-1">
            선생님이 알려준 코드로 들어가세요
          </p>
        </div>

        {/* 최근 입장 클래스 */}
        {isClient && recentClasses.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              최근 입장 클래스
              <span className="text-xs font-normal text-muted-foreground">(클릭하면 입력됩니다)</span>
            </h2>
            <div className="grid gap-3">
              {recentClasses.map((recent) => (
                <Card
                  key={`${recent.code}-${recent.attendanceNumber}`}
                  className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => handleRecentEnter(recent)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{recent.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span className="font-mono">{recent.code}</span>
                        <span>{recent.attendanceNumber}번</span>
                        {recent.nickname && <span>{recent.nickname}</span>}
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {recent.studentCount}명
                        </span>
                        <span>{formatRecentDate(recent.lastAccessedAt)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* 입장 폼 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              클래스 입장
            </CardTitle>
            <CardDescription>
              클래스 코드와 출석번호를 입력하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="classCode">클래스 코드</FieldLabel>
                  <Input
                    id="classCode"
                    placeholder="예: AB12CD"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="uppercase tracking-widest text-center text-2xl h-14"
                    required
                  />
                </Field>
                
                <Field>
                  <FieldLabel htmlFor="attendanceNumber">출석번호</FieldLabel>
                  <Input
                    id="attendanceNumber"
                    type="number"
                    placeholder="예: 1"
                    min={1}
                    max={50}
                    value={attendanceNumber}
                    onChange={(e) => setAttendanceNumber(e.target.value)}
                    className="text-center text-2xl h-14"
                    required
                  />
                </Field>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}

                <Button type="submit" size="lg" className="w-full h-14 text-lg" disabled={isLoading}>
                  {isLoading ? '확인 중...' : '입장하기'}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        {/* 도움말 */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          코드를 모르겠다면 선생님께 물어보세요!
        </p>
      </div>
    </main>
  );
}
