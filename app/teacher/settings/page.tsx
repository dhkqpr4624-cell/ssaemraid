'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Download, Upload, RotateCcw, AlertTriangle, ArrowLeft } from 'lucide-react';
import { findClassByCode, getRecentClasses } from '@/lib/class-storage';
import { toast } from 'sonner';

function TeacherSettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');

  const [classData, setClassData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) {
      router.push('/teacher');
      return;
    }

    const cls = findClassByCode(code || '');
    if (cls) {
      setClassData(cls);
    }
    setLoading(false);
  }, [code, router]);

  const handleCopyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('클래스코드가 복사되었습니다');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBackupData = () => {
    const allData = {
      classes: getRecentClasses(),
      timestamp: new Date().toISOString(),
      version: '1.0',
    };
    
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `samquest-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('데이터 백업이 완료되었습니다');
  };

  const handleRestoreData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.classes && Array.isArray(data.classes)) {
          data.classes.forEach((cls: any) => {
            localStorage.setItem(`class_${cls.code}`, JSON.stringify(cls));
          });
          toast.success('데이터가 복원되었습니다');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          toast.error('유효하지 않은 백업 파일입니다');
        }
      } catch (error) {
        toast.error('파일을 읽을 수 없습니다');
      }
    };
    reader.readAsText(file);
  };

  const handleResetTestData = () => {
    if (confirm('테스트 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('class_') || key.startsWith('student_session')) {
          localStorage.removeItem(key);
        }
      });
      toast.success('테스트 데이터가 초기화되었습니다');
      setTimeout(() => router.push('/teacher'), 1000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>클래스를 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/teacher/dashboard?code=${code}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">설정</h1>
            <p className="text-muted-foreground">{classData.name} 클래스</p>
          </div>
        </div>

        {/* 프로토타입 안내 */}
        <Alert className="mb-8 border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>현재 프로토타입 버전입니다.</strong> 이 브라우저의 localStorage에 모든 데이터가 저장됩니다. 
            다른 기기에서 접속하면 데이터가 보이지 않습니다. 실제 운영을 위해서는 서버 DB 연결이 필요합니다.
          </AlertDescription>
        </Alert>

        {/* 클래스 정보 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>클래스 정보</CardTitle>
            <CardDescription>클래스 기본 정보 및 코드</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">클래스명</label>
              <p className="text-lg font-semibold">{classData.name}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">학생 수</label>
              <p className="text-lg font-semibold">{classData.studentCount}명</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">클래스코드</label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-2 bg-gray-100 rounded-lg font-mono text-lg font-bold">
                  {code}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyCode}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                학생들에게 이 코드를 공유하세요. 학생들은 이 코드와 출석번호로 입장합니다.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">교사 비밀번호</label>
              <div className="px-4 py-2 bg-gray-100 rounded-lg font-mono">
                {classData.teacherPassword || '(설정되지 않음)'}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                이 비밀번호는 클래스 생성 시 설정되었습니다. 변경하려면 클래스를 다시 만들어야 합니다.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">생성 날짜</label>
              <p className="text-sm">
                {new Date(classData.createdAt).toLocaleString('ko-KR')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 데이터 관리 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>데이터 관리</CardTitle>
            <CardDescription>로컬 데이터 백업 및 복원</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">백업</h4>
              <p className="text-sm text-muted-foreground mb-3">
                현재 모든 클래스, 퀴즈, 학생 데이터를 JSON 파일로 다운로드합니다.
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleBackupData}
              >
                <Download className="w-4 h-4" />
                데이터 백업
              </Button>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">복원</h4>
              <p className="text-sm text-muted-foreground mb-3">
                이전에 백업한 JSON 파일을 업로드하여 데이터를 복원합니다.
              </p>
              <label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreData}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="gap-2 cursor-pointer"
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4" />
                    데이터 복원
                  </span>
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 위험 영역 */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">위험 영역</CardTitle>
            <CardDescription>주의해서 사용하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <h4 className="font-medium text-red-600 mb-2">테스트 데이터 초기화</h4>
              <p className="text-sm text-muted-foreground mb-4">
                모든 클래스, 퀴즈, 학생 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={handleResetTestData}
              >
                <RotateCcw className="w-4 h-4" />
                모든 데이터 초기화
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 정보 */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-600">개인정보 보호</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-900">
            <p>✓ 학생 이름, 이메일, 전화번호를 수집하지 않습니다</p>
            <p>✓ 학생은 클래스코드와 출석번호로만 입장합니다</p>
            <p>✓ 모든 데이터는 이 브라우저의 localStorage에만 저장됩니다</p>
            <p>✓ 다른 사람이 이 컴퓨터를 사용하면 데이터가 보입니다</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function TeacherSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <TeacherSettingsContent />
    </Suspense>
  );
}
