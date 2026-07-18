'use client';

import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BOSS_CATALOG, DEFAULT_BOSS_ID, type BossCatalogEntry } from '@/lib/boss-catalog';
import { getBossBattleSession } from '@/lib/boss-battle';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Users,
  Gift,
  FileQuestion,
  Calendar,
  History,
  Copy,
  Check,
  Pencil,
  TrendingUp,
  Plus,
  Sparkles,
  ClipboardCheck,
  Download,
  Upload,
  Trash2,
  BarChart2,
  AlertTriangle,
  Search,
  Image as ImageIcon,
  QrCode,
  Swords,
} from 'lucide-react';
import {
  findClassByCode,
  updateStudentStats,
  getQuizzes,
  getStudentsByClassCode,
  deleteQuiz,
  saveQuiz,
  deleteClass,
  addStudentToClass,
  deleteStudentFromClass,
  getLiveSessionsForClass,
} from '@/lib/db-wrapper';
import {
  updateClassLastAccess,
  getActivityLogs,
  getPendingReviewResults,
} from '@/lib/class-storage';
import {
  downloadQuizJSON,
  exportQuizToJSON,
  importQuizFromJSON,
  generateQuizPreview,
} from '@/lib/quiz-export';
import { BUILTIN_QUIZ_TEMPLATES, cloneBuiltInQuizData } from '@/lib/builtin-quizzes';
import { uploadSharedQuiz } from '@/lib/shared-quizzes';
import { getQuizQuestionCountLabel } from '@/lib/quiz-display';
import type {
  ClassRoom,
  Student,
  Quiz,
  StudentQuizResult,
  ActivityLog,
} from '@/lib/types';


function normalizeCurriculum(data: any) {
  const src = data?.metadata?.curriculum || data?.curriculum || {};
  return {
    grade: src.grade || data?.grade || '5',
    semester: src.semester || data?.semester || '1',
    subject: src.subject || data?.subject || 'social',
    unit: src.unit || data?.unit || '2',
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

function TeacherDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classCode = searchParams.get('code');

  const [classroom, setClassroom] = useState<ClassRoom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [pendingResults, setPendingResults] = useState<StudentQuizResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveSessionsByQuizId, setLiveSessionsByQuizId] = useState<Record<string, any>>({});
  const [copied, setCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isBossSelectorOpen, setIsBossSelectorOpen] = useState(false);
  const [bossSearch, setBossSearch] = useState('');
  const [bossGrade, setBossGrade] = useState('all');
  const [bossSemester, setBossSemester] = useState('all');
  const [bossUnit, setBossUnit] = useState('all');
  const [selectedBossId, setSelectedBossId] = useState(DEFAULT_BOSS_ID);
  const [activeBossSession, setActiveBossSession] = useState<any>(null);

  // 수정 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [deltaPoints, setDeltaPoints] = useState('');
  const [deltaCoins, setDeltaCoins] = useState('');
  const [reason, setReason] = useState('');
  const [editError, setEditError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 삭제 확인 모달
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

  // 클래스/학생 관리 상태
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [newStudentNumber, setNewStudentNumber] = useState('');
  const [studentManageError, setStudentManageError] = useState('');
  const [isClassDeleting, setIsClassDeleting] = useState(false);

  // Import 모달
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSource, setImportSource] = useState<'builtin' | 'file' | null>(null);
  const [importFilterGrade, setImportFilterGrade] = useState('all');
  const [importFilterSemester, setImportFilterSemester] = useState('all');
  const [importFilterSubject, setImportFilterSubject] = useState('all');
  const [importFilterUnit, setImportFilterUnit] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 공유 퀴즈 업로드 모달 상태
  const [isSharedUploadOpen, setIsSharedUploadOpen] = useState(false);
  const [sharedQuizToUpload, setSharedQuizToUpload] = useState<Quiz | null>(null);
  const [sharedAuthorName, setSharedAuthorName] = useState('');
  const [sharedUploadPassword, setSharedUploadPassword] = useState('');
  const [sharedThumbnailUrl, setSharedThumbnailUrl] = useState('');

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

  const loadData = useCallback(async () => {
    const normalizedClassCode = String(classCode || '').trim().toUpperCase();
    if (!normalizedClassCode) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setClassroom(null);
    setStudents([]);
    setQuizzes([]);
    setActivityLogs([]);
    setPendingResults([]);
    setLiveSessionsByQuizId({});
    setActiveBossSession(null);

    try {
      const classData = await findClassByCode(normalizedClassCode);
      if (classData) {
        setClassroom(classData);
        updateClassLastAccess(normalizedClassCode);

        const [studentData, quizData, liveSessions, bossSession] = await Promise.all([
          getStudentsByClassCode(normalizedClassCode),
          getQuizzes(normalizedClassCode),
          getLiveSessionsForClass(normalizedClassCode),
          getBossBattleSession(normalizedClassCode)
        ]);
        
        const logData = getActivityLogs(classData.id);
        const pending = getPendingReviewResults(normalizedClassCode);

        setStudents(studentData);
        setActivityLogs(logData.slice(0, 10));
        setQuizzes(
          [...quizData].sort((a: any, b: any) =>
            new Date(b.createdAt || b.created_at || 0).getTime() -
            new Date(a.createdAt || a.created_at || 0).getTime(),
          ),
        );
        setLiveSessionsByQuizId(Object.fromEntries(liveSessions.map((live: any) => [live.quizId, live])));
        setActiveBossSession(bossSession?.status === "reward_ready" ? null : bossSession);
        setPendingResults(pending);
      }
    } catch (err) {
      console.error('데이터 로딩 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [classCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!classCode) return;
    const timer = setInterval(async () => {
      const liveSessions = await getLiveSessionsForClass(classCode);
      setLiveSessionsByQuizId(Object.fromEntries(liveSessions.map((live: any) => [live.quizId, live])));
    }, 3000);
    return () => clearInterval(timer);
  }, [classCode]);

  const copyCode = async () => {
    if (classroom) {
      await navigator.clipboard.writeText(classroom.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStudentJoinUrl = () => {
    if (!classroom || typeof window === 'undefined') return '';
    const url = new URL('/student', window.location.origin);
    url.searchParams.set('classCode', classroom.code);
    return url.toString();
  };

  const getQrImageUrl = () => {
    const joinUrl = getStudentJoinUrl();
    return joinUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(joinUrl)}`
      : '';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openEditModal = (student: Student) => {
    if ((student as any).isVirtual) return;
    setSelectedStudent(student);
    setDeltaPoints('');
    setDeltaCoins('');
    setReason('');
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedStudent || !classCode) return;

    setEditError('');
    setIsSubmitting(true);

    const pointsValue = deltaPoints ? parseInt(deltaPoints) : 0;
    const coinsValue = deltaCoins ? parseInt(deltaCoins) : 0;

    if (isNaN(pointsValue) || isNaN(coinsValue)) {
      setEditError('올바른 숫자를 입력해주세요.');
      setIsSubmitting(false);
      return;
    }
    if (pointsValue === 0 && coinsValue === 0) {
      setEditError('변경값을 입력해주세요.');
      setIsSubmitting(false);
      return;
    }
    if (!reason.trim()) {
      setEditError('변경 사유를 입력해주세요.');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await updateStudentStats(
        classCode,
        selectedStudent.attendanceNumber,
        pointsValue,
        coinsValue,
        reason.trim()
      );

      if (result.success) {
        await loadData();
        setIsEditModalOpen(false);
      } else {
        setEditError((result as any).error || '수정 중 오류가 발생했습니다.');
      }
    } catch {
      setEditError('수정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!quizToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await deleteQuiz(quizToDelete.id);
      if (res.success) {
        await loadData();
        setIsDeleteModalOpen(false);
      } else {
        alert(res.error || '삭제 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };


  const openSharedUploadDialog = (quiz: Quiz) => {
    setSharedQuizToUpload(quiz);
    setSharedAuthorName('');
    setSharedUploadPassword('');
    setSharedThumbnailUrl('');
    setIsSharedUploadOpen(true);
  };

  const handleSharedThumbnailFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('썸네일은 이미지 파일만 사용할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSharedThumbnailUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleUploadQuizToShared = async () => {
    if (!sharedQuizToUpload) return;
    setIsSubmitting(true);
    try {
      await uploadSharedQuiz({
        quizData: {
          ...exportQuizToJSON(sharedQuizToUpload),
          metadata: {
            ...(exportQuizToJSON(sharedQuizToUpload) as any).metadata,
            thumbnailUrl: sharedThumbnailUrl || undefined,
          },
        } as any,
        authorName: sharedAuthorName,
        uploadPassword: sharedUploadPassword,
        thumbnailUrl: sharedThumbnailUrl,
      });
      setIsSharedUploadOpen(false);
      setSharedQuizToUpload(null);
      setSharedAuthorName('');
      setSharedUploadPassword('');
      setSharedThumbnailUrl('');
      alert('퀴즈 탐색 화면에 공유 등록했습니다.');
    } catch (err: any) {
      alert(err.message || '공유 퀴즈 업로드에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!classCode) return;
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    setIsClassDeleting(true);
    try {
      const res = await deleteClass(classCode);
      if (res.success) {
        router.push('/teacher');
      } else {
        alert(res.error || '클래스 삭제 중 오류가 발생했습니다.');
      }
    } catch {
      alert('클래스 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsClassDeleting(false);
    }
  };

  const openAddStudentModal = () => {
    const used = new Set(students.filter((s: any) => !s.isVirtual).map(s => s.attendanceNumber));
    let nextNumber = 1;
    while (used.has(nextNumber)) nextNumber += 1;
    setNewStudentNumber(String(nextNumber));
    setStudentManageError('');
    setIsAddStudentModalOpen(true);
  };

  const handleAddStudent = async () => {
    if (!classCode) return;
    const numberValue = parseInt(newStudentNumber);
    if (isNaN(numberValue) || numberValue < 1 || numberValue > 99) {
      setStudentManageError('학생 번호는 1~99 사이의 숫자로 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setStudentManageError('');
    try {
      const res = await addStudentToClass(classCode, numberValue);
      if (res.success) {
        await loadData();
        setIsAddStudentModalOpen(false);
      } else {
        setStudentManageError(res.error || '학생 추가 중 오류가 발생했습니다.');
      }
    } catch {
      setStudentManageError('학생 추가 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!classCode) return;
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    setIsSubmitting(true);
    try {
      const res = await deleteStudentFromClass(classCode, student.attendanceNumber);
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || '학생 삭제 중 오류가 발생했습니다.');
      }
    } catch {
      alert('학생 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const data = await importQuizFromJSON(file);
      setImportData(data);
      setImportSource('file');
      setImportPreview(generateQuizPreview(data));
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      e.target.value = '';
    }
  };


  const handleBuiltInQuizSelect = (templateId: string) => {
    const template = BUILTIN_QUIZ_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    const data = cloneBuiltInQuizData(template);
    setImportData(data);
    setImportSource('builtin');
    setImportPreview(generateQuizPreview(data));
    setImportError(null);
  };

  const handleImportSubmit = async () => {
    if (!importData || !classCode) return;
    setIsSubmitting(true);
    try {
      const quizPayload = {
        title: importSource === 'builtin' ? importData.metadata.title : `(가져옴) ${importData.metadata.title}`,
        description: importData.metadata.description,
        questions: importData.questions,
        rewardOptions: importData.rewardOptions,
        classCode: classCode,
        isActive: importData.settings.isActive ?? true,
        allowRetry: importData.settings.allowRetry,
        retryQuestionMode: importData.settings.retryQuestionMode,
        retryRewardMode: importData.settings.retryRewardMode,
        retryRewardOptions: importData.retryRewardOptions || [],
        randomPickEnabled: importData.settings.randomPickEnabled,
        randomPickCount: importData.settings.randomPickCount,
        shuffleQuestionsEnabled: importData.settings.shuffleQuestionsEnabled,
        curriculum: normalizeCurriculum(importData),
        grade: normalizeCurriculum(importData).grade,
        semester: normalizeCurriculum(importData).semester,
        subject: normalizeCurriculum(importData).subject,
        unit: normalizeCurriculum(importData).unit,
      };
      
      const res = await saveQuiz(quizPayload, false);
      if (res.success) {
        await loadData();
        setIsImportModalOpen(false);
        setImportData(null);
        setImportPreview(null);
        setImportSource(null);
      } else {
        setImportError(res.error || '저장 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Import save error:', err);
      setImportError('가져오기 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </main>
    );
  }

  if (!classroom) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">클래스를 찾을 수 없습니다.</p>
        <Link href="/teacher">
          <Button variant="outline">돌아가기</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <Link
            href="/teacher"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            교사 홈
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src="/assets/logo.png" alt="쌤퀘스트 로고" className="h-12 w-auto object-contain" />
              <div>
                <h1 className="text-3xl font-bold">{classroom.name}</h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <Badge variant="secondary" className="font-mono tracking-wider text-base px-3 py-1">
                    {classroom.code}
                  </Badge>
                  <button
                    onClick={copyCode}
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {copied ? (
                      <><Check className="w-3 h-3" /> 복사됨</>
                    ) : (
                      <><Copy className="w-3 h-3" /> 코드 복사</>
                    )}
                  </button>
                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    type="button"
                    title="학생 입장 QR 코드 보기"
                  >
                    <QrCode className="w-3 h-3" />
                    QR 코드
                  </button>
                  <span className="text-sm text-muted-foreground">학생 {classroom.studentCount}명</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link href={`/teacher/quiz/create?code=${classCode}`}>
                <Button variant="outline">
                  <FileQuestion className="w-4 h-4 mr-2" />
                  퀴즈 만들기
                </Button>
              </Link>
              <Link href={`/teacher/quiz/explore?code=${classCode}`}>
                <Button variant="outline">
                  <Search className="w-4 h-4 mr-2" />
                  퀴즈 탐색
                </Button>
              </Link>
              {pendingResults.length > 0 && (
                <Link href={`/teacher/quiz/grade?code=${classCode}`}>
                  <Button variant="default" className="relative">
                    <ClipboardCheck className="w-4 h-4 mr-2" />
                    채점 대기
                    <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {pendingResults.length}
                    </span>
                  </Button>
                </Link>
              )}
              <Link href={`/teacher/item-editor?code=${classCode}`}>
                <Button variant="outline">
                  <Sparkles className="w-4 h-4 mr-2" />
                  아이템/가구 만들기
                </Button>
              </Link>
              <Button
                variant="destructive"
                onClick={handleDeleteClass}
                disabled={isClassDeleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isClassDeleting ? '삭제 중...' : '클래스 삭제'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* 학생 목록 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>학생 목록</CardTitle>
                  <CardDescription>총 {classroom.studentCount}명의 학생 현황입니다</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={openAddStudentModal}>
                    <Plus className="w-4 h-4 mr-1" />
                    학생 추가
                  </Button>
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">번호</TableHead>
                      <TableHead>닉네임</TableHead>
                      <TableHead>아이템</TableHead>
                      <TableHead className="text-right">점수</TableHead>
                      <TableHead className="w-[120px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => {
                      const isVirtual = (student as any).isVirtual;
                      return (
                        <TableRow key={student.id} className={isVirtual ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{student.attendanceNumber}번</TableCell>
                          <TableCell>{student.nickname}</TableCell>
                          <TableCell>{`${student.items?.length || 0}개`}</TableCell>
                          <TableCell className="text-right font-mono">{student.score.toLocaleString()}점</TableCell>
                          <TableCell>
                            {!isVirtual && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditModal(student)}
                                  title="수정"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteStudent(student)}
                                  title="학생 삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={isBossSelectorOpen} onOpenChange={setIsBossSelectorOpen}>
              <DialogContent style={{ width: 'calc(100vw - 32px)', maxWidth: '1680px', height: 'min(920px, calc(100dvh - 32px))' }} className="flex flex-col overflow-hidden border-2 border-amber-500 bg-slate-950 p-0 text-white sm:!max-w-none">
                <DialogHeader className="border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4">
                  <DialogTitle className="flex items-center gap-2 text-2xl font-black text-amber-300"><Swords className="h-6 w-6"/>보스 선택</DialogTitle>
                  <DialogDescription className="text-slate-300">3~6학년 사회 단원을 검색한 뒤 진행할 보스를 선택하세요.</DialogDescription>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(520px,38%)_minmax(720px,62%)] lg:overflow-hidden">
                  <aside className="flex min-h-[520px] flex-none flex-col border-b border-slate-700 bg-slate-900/95 p-4 lg:min-h-0 lg:flex-auto lg:border-b-0 lg:border-r">
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                      <Input value={bossSearch} onChange={(e)=>setBossSearch(e.target.value)} placeholder="보스명·단원 검색" className="border-slate-600 bg-slate-950 pl-9 text-white"/>
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <select value={bossGrade} onChange={e=>setBossGrade(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-2 py-2 text-xs"><option value="all">전체 학년</option>{[3,4,5,6].map(v=><option key={v} value={v}>{v}학년</option>)}</select>
                      <select value={bossSemester} onChange={e=>setBossSemester(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-2 py-2 text-xs"><option value="all">전체 학기</option><option value="1">1학기</option><option value="2">2학기</option></select>
                      <select value={bossUnit} onChange={e=>setBossUnit(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-2 py-2 text-xs"><option value="all">전체 단원</option><option value="1">1단원</option><option value="2">2단원</option><option value="3">3단원</option></select>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
                      {BOSS_CATALOG.filter((boss)=>{
                        const term=bossSearch.trim().toLowerCase();
                        const text=`${boss.name} ${boss.subtitle} ${boss.accent}`.toLowerCase();
                        return (!term||text.includes(term))&&(bossGrade==='all'||String(boss.grade)===bossGrade)&&(bossSemester==='all'||String(boss.semester)===bossSemester)&&(bossUnit==='all'||String(boss.unit)===bossUnit);
                      }).map((boss)=><button key={boss.id} type="button" disabled={!boss.enabled} onClick={()=>boss.enabled&&setSelectedBossId(boss.id)} className={`w-full rounded-lg border p-3 text-left transition ${boss.enabled?(selectedBossId===boss.id?'border-cyan-300 bg-cyan-950/80 ring-2 ring-cyan-400/30':'border-slate-600 bg-slate-800 hover:border-slate-400'):'cursor-not-allowed border-slate-800 bg-slate-900/60 opacity-55'}`}>
                        <div className="flex items-center justify-between gap-2"><span className="font-bold">{boss.grade}학년 {boss.semester}학기 {boss.unit}단원</span><Badge variant={boss.enabled?'default':'secondary'}>{boss.enabled?'이용 가능':'준비 중'}</Badge></div>
                        <div className={`mt-1 text-sm ${boss.enabled?'text-amber-300':'text-slate-500'}`}>{boss.name}</div>
                      </button>)}
                    </div>
                  </aside>
                  {(()=>{const boss:BossCatalogEntry=BOSS_CATALOG.find(b=>b.id===selectedBossId)||BOSS_CATALOG.find(b=>b.enabled)!;return <section className="relative flex min-h-[650px] min-w-0 flex-none flex-col overflow-hidden bg-[radial-gradient(circle_at_center,_#164e63_0%,_#020617_68%)] p-4 sm:p-5 lg:min-h-0 lg:flex-auto">
                    <div className="absolute inset-0 opacity-20" style={{backgroundImage:"url('/boss-battle/waiting-room.png')",backgroundSize:'cover',backgroundPosition:'center'}}/>
                    <div className="relative z-10 flex min-h-0 flex-1 flex-col rounded-xl border border-cyan-300/40 bg-slate-950/70 p-4 shadow-2xl backdrop-blur-sm sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><Badge className="mb-2 bg-cyan-700">{boss.accent}</Badge><h2 className="break-keep text-3xl font-black leading-tight text-cyan-100 sm:text-4xl">{boss.name}</h2><p className="mt-2 text-lg text-slate-200">{boss.subtitle}</p></div><div className="rounded-lg border border-slate-500 bg-slate-900/80 px-4 py-3 text-right"><div className="text-xs text-slate-400">MAX PARTY</div><div className="text-2xl font-black text-amber-300">{boss.maxPlayers}명</div></div></div>
                      <div className="my-5 grid min-h-[230px] flex-1 place-items-center rounded-xl border border-slate-600 bg-black/35"><div className="text-center"><div className="mx-auto grid h-44 w-44 place-items-center rounded-full border-4 border-cyan-300/40 bg-slate-950/75 shadow-[0_0_60px_rgba(34,211,238,.25)]"><Swords className="h-24 w-24 text-cyan-200"/></div><div className="mt-4 text-sm text-slate-400">보스 전투 이미지 및 애니메이션은 다음 단계에서 적용됩니다.</div></div></div>
                      <div className="rounded-lg border border-amber-500/40 bg-amber-950/35 p-4 text-sm leading-6 text-amber-50">{boss.description}</div>
                      <div className="sticky bottom-0 z-20 mt-4 flex justify-end bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-3"><Button size="lg" disabled={!boss.enabled} onClick={()=>router.push(`/teacher/boss-battle?code=${classCode}&bossId=${activeBossSession?.bossId || boss.id}`)} className="w-full bg-lime-500 text-lg font-black text-slate-950 hover:bg-lime-400 sm:w-auto sm:min-w-52"><Swords className="mr-2 h-5 w-5"/>{activeBossSession ? '보스전 이어서 참여하기' : '선택하고 입장'}</Button></div>
                    </div>
                  </section>})()}
                </div>
              </DialogContent>
            </Dialog>

          {/* 퀴즈 목록 */}
            <Card>
              <CardHeader>
                <CardTitle>내 퀴즈</CardTitle>
                <CardDescription>학생들에게 제공할 퀴즈 목록입니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quizzes.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg border-dashed">
                      <p className="text-muted-foreground mb-4">만든 퀴즈가 없습니다.</p>
                      <Link href={`/teacher/quiz/create?code=${classCode}`}>
                        <Button variant="outline" size="sm">
                          첫 퀴즈 만들기
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    quizzes.map((quiz) => {
                      const liveSession = liveSessionsByQuizId[quiz.id];
                      const isLiveInProgress = liveSession && liveSession.status !== 'waiting' && liveSession.status !== 'ended';
                      return (
                      <div
                        key={quiz.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            quiz.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            <FileQuestion className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">{quiz.title}</p>
                            <p className="text-xs text-muted-foreground">
                              문제 {getQuizQuestionCountLabel(quiz)} · {quiz.isActive ? '진행 중' : '비활성'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link href={`/teacher/live-quiz?code=${classCode}&quizId=${quiz.id}`}>
                            <Button size="sm" variant="outline" className="h-8 px-2">
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                              {isLiveInProgress ? '실시간 이어하기' : '실시간'}
                            </Button>
                          </Link>
                          <Link href={`/teacher/quiz/results?code=${classCode}&quizId=${quiz.id}`}>
                            <Button size="sm" variant="outline" className="h-8 px-2" title="결과 보기">
                              <BarChart2 className="w-3.5 h-3.5 mr-1" />
                              결과
                            </Button>
                          </Link>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => downloadQuizJSON(quiz)} title="내보내기">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openSharedUploadDialog(quiz)} title="퀴즈 탐색에 업로드" disabled={isSubmitting}>
                            <Upload className="w-3.5 h-3.5" />
                          </Button>
                          <Link href={`/teacher/quiz/create?code=${classCode}&quizId=${quiz.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="수정">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => { setQuizToDelete(quiz); setIsDeleteModalOpen(true); }}
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 활동 로그 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="w-5 h-5" />
                  최근 활동
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {activityLogs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      최근 활동이 없습니다.
                    </div>
                  ) : (
                    activityLogs.map((log) => (
                      <div key={log.id} className="p-4 flex gap-3">
                        <div className="mt-1">
                          <TrendingUp className="w-4 h-4 text-chart-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold">{log.studentNickname}</span>
                            {' '}{log.reason}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(log.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-amber-400/60 bg-gradient-to-r from-slate-950 to-amber-950 text-white">
              <CardContent className="space-y-4 p-5">
                <div>
                  <div className="flex items-center gap-2 text-xl font-black text-amber-200"><Swords className="h-6 w-6"/>협동 보스전</div>
                  <p className="mt-1 text-sm leading-6 text-amber-50/80">단원 마무리·학기 마무리 활동으로 학급 전체가 함께 보스에 도전합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => activeBossSession ? router.push(`/teacher/boss-battle?code=${classCode}&bossId=${activeBossSession.bossId}`) : setIsBossSelectorOpen(true)}
                  className="relative h-[64px] w-full bg-center bg-[length:100%_100%] px-6 text-lg font-black text-amber-950 transition-transform hover:scale-[1.01] active:scale-95"
                  style={{backgroundImage:"url('/boss-battle/button-panel.png')"}}
                >
                  {activeBossSession ? '보스전 이어서 참여하기' : '보스전 시작하기'}
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>


      {/* 학생 추가 모달 */}
      <Dialog open={isAddStudentModalOpen} onOpenChange={setIsAddStudentModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>학생 추가</DialogTitle>
            <DialogDescription>
              전입 학생에게 부여할 번호를 입력합니다. 기존 번호와 중복될 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field>
              <FieldLabel>학생 번호</FieldLabel>
              <Input
                type="number"
                min={1}
                max={99}
                value={newStudentNumber}
                onChange={(e) => setNewStudentNumber(e.target.value)}
              />
            </Field>
            {studentManageError && (
              <p className="text-sm text-destructive font-medium">{studentManageError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStudentModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddStudent} disabled={isSubmitting}>
              {isSubmitting ? '추가 중...' : '학생 추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 점수/코인 수정 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>학생 정보 수정</DialogTitle>
            <DialogDescription>
              {selectedStudent?.nickname} 학생의 점수와 코인을 변경합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>점수 변경</FieldLabel>
                <Input
                  type="number"
                  placeholder="+10 또는 -5"
                  value={deltaPoints}
                  onChange={(e) => setDeltaPoints(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  현재: {selectedStudent?.score}점
                </p>
              </Field>
              <Field>
                <FieldLabel>코인 변경</FieldLabel>
                <Input
                  type="number"
                  placeholder="+100 또는 -50"
                  value={deltaCoins}
                  onChange={(e) => setDeltaCoins(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  현재: {selectedStudent?.coins}코인
                </p>
              </Field>
            </div>
            <Field>
              <FieldLabel>변경 사유</FieldLabel>
              <Textarea
                placeholder="예: 퀴즈 우승 보상, 수업 참여 태도 우수 등"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </Field>
            {editError && (
              <p className="text-sm text-destructive font-medium">{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleEditSubmit} disabled={isSubmitting}>
              {isSubmitting ? '처리 중...' : '저장하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSharedUploadOpen} onOpenChange={setIsSharedUploadOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>공유 퀴즈 업로드</DialogTitle>
            <DialogDescription>선택한 내 퀴즈를 퀴즈 탐색 화면에 공유합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 min-h-0">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{sharedQuizToUpload?.title || '선택된 퀴즈 없음'}</p>
              <p className="text-xs text-muted-foreground mt-1">{sharedQuizToUpload?.questions?.length || 0}문제 · {getCurriculumLabel((sharedQuizToUpload as any)?.curriculum)}</p>
            </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSharedUploadOpen(false)}>취소</Button>
            <Button onClick={handleUploadQuizToShared} disabled={!sharedQuizToUpload || isSubmitting}>{isSubmitting ? '업로드 중...' : '공유 등록'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 모달 */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              퀴즈 삭제 확인
            </DialogTitle>
            <DialogDescription>
              정말로 "{quizToDelete?.title}" 퀴즈를 삭제하시겠습니까?
              삭제 시 모든 학생 결과와 실시간 세션 데이터가 함께 삭제되며 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteQuiz} disabled={isSubmitting}>
              {isSubmitting ? '삭제 중...' : '삭제하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 학생 입장 QR 코드 모달 */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[420px]">
          <DialogHeader>
            <DialogTitle>학생 입장 QR 코드</DialogTitle>
            <DialogDescription>
              학생이 이 QR 코드를 찍으면 클래스 코드가 자동으로 입력된 학생 입장 화면으로 이동합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4 text-center">
            <div className="mx-auto inline-flex rounded-lg border bg-white p-4 shadow-sm">
              {getQrImageUrl() ? (
                <img
                  src={getQrImageUrl()}
                  alt={`${classroom.code} 학생 입장 QR 코드`}
                  className="h-72 w-72 max-w-full object-contain"
                />
              ) : (
                <div className="flex h-72 w-72 items-center justify-center text-sm text-muted-foreground">
                  QR 코드를 만들 수 없습니다.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">클래스 코드</p>
              <p className="font-mono text-2xl font-bold tracking-wider">{classroom.code}</p>
              <div className="rounded-md bg-muted p-2 text-xs break-all text-muted-foreground">
                {getStudentJoinUrl()}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={async () => {
                const joinUrl = getStudentJoinUrl();
                if (joinUrl) {
                  await navigator.clipboard.writeText(joinUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              링크 복사
            </Button>
            <Button onClick={() => setIsQrModalOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import 모달 */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>퀴즈 가져오기</DialogTitle>
            <DialogDescription>
              기본 탑재 퀴즈를 선택하거나 JSON 파일을 선택하여 퀴즈를 가져옵니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 overflow-y-auto pr-2 flex-1 min-h-0">

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-xs font-medium">기본 탑재 퀴즈 카테고리</p>
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
              <p className="text-xs font-medium">기본 탑재 퀴즈</p>
              <Select onValueChange={handleBuiltInQuizSelect}>
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

            <div className="relative text-center text-xs text-muted-foreground">
              <span className="bg-background px-2">또는</span>
            </div>

            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">JSON 파일을 클릭하거나 드래그하세요</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleFileChange}
              />
            </div>
            
            {importError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {importError}
              </div>
            )}
            
            {importPreview && (
              <div className="bg-muted p-4 rounded-md max-h-64 overflow-auto max-w-full">
                <pre className="text-xs whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {importPreview}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-3 shrink-0">
            <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setImportData(null); setImportPreview(null); setImportSource(null); }}>
              취소
            </Button>
            <Button onClick={handleImportSubmit} disabled={!importData || isSubmitting}>
              {isSubmitting ? '가져오는 중...' : '퀴즈 생성하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function TeacherDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <TeacherDashboardContent />
    </Suspense>
  );
}
