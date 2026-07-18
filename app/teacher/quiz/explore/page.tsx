"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Eye,
  FileQuestion,
  Flag,
  Image as ImageIcon,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  importQuizFromJSON,
  generateQuizPreview,
  exportQuizToJSON,
} from "@/lib/quiz-export";
import { getQuizzes, saveQuiz } from "@/lib/db-wrapper";
import {
  deleteSharedQuizAsAdmin,
  deleteSharedQuizWithPassword,
  hideSharedQuizAsAdmin,
  getSharedQuizById,
  incrementSharedQuizDownload,
  isSharedQuizAdminPassword,
  isSharedQuizAvailable,
  listSharedQuizzes,
  reportSharedQuiz,
  SHARED_QUIZ_ADMIN_SESSION_KEY,
  SHARED_QUIZ_ADMIN_PASSWORD_SESSION_KEY,
  unhideSharedQuizAsAdmin,
  updateSharedQuizWithPassword,
  uploadSharedQuiz,
  verifySharedQuizPassword,
  getOwnedSharedQuizIds,
  rememberSharedQuizAsOwned,
  type SharedQuiz,
} from "@/lib/shared-quizzes";
import type { Quiz } from "@/lib/types";
import { getQuizQuestionCountLabel } from "@/lib/quiz-display";
import {
  RewardItemEditor,
  defaultReward,
  type RewardDraft,
} from "@/components/quiz/QuestionEditor";

const subjectOptions = [
  { value: "social", label: "사회" },
  { value: "science", label: "과학" },
  { value: "math", label: "수학" },
  { value: "practical", label: "실과" },
];
const gradeOptions = ["3", "4", "5", "6"];
const semesterOptions = ["1", "2"];
function getSubjectLabel(value: string) {
  return subjectOptions.find((opt) => opt.value === value)?.label || value;
}

function getCurriculumLabel(quiz: SharedQuiz) {
  return `${quiz.grade}학년 ${quiz.semester}학기 ${getSubjectLabel(quiz.subject)} ${quiz.unit}단원`;
}

function getSharedQuizRandomQuestionLabel(quiz: SharedQuiz) {
  const totalCount = Number(quiz.question_count || 0);
  const data: any = quiz.quiz_data || {};
  const settings = data.settings || {};
  const randomPickEnabled = Boolean(
    quiz.random_pick_enabled ?? settings.randomPickEnabled,
  );
  const randomPickCount = Number(
    quiz.random_pick_count ?? settings.randomPickCount ?? 0,
  );

  const label = getQuizQuestionCountLabel({
    questions: Array.from({ length: totalCount }),
    randomPickEnabled,
    randomPickCount,
  } as Pick<Quiz, "questions" | "randomPickEnabled" | "randomPickCount">);

  return label.startsWith("(랜덤)") ? label : "";
}

function normalizeQuestion(question: any, index: number) {
  return {
    id: question?.id || `shared-question-${Date.now()}-${index}`,
    quizId: question?.quizId || question?.quiz_id || "shared-quiz",
    order: Number(question?.order || index + 1),
    type: question?.type || "single",
    text: question?.text || "",
    points: Number(question?.points || 10),
    options: Array.isArray(question?.options)
      ? question.options
      : ["", "", "", ""],
    correctAnswers: Array.isArray(question?.correctAnswers)
      ? question.correctAnswers
      : [],
    shortAnswers: Array.isArray(question?.shortAnswers)
      ? question.shortAnswers
      : [],
    hint: question?.hint || "",
  };
}

function makeClientId(prefix: string) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function ensureRewardDraftIds(reward: any): RewardDraft {
  const id = reward?.id || reward?.itemId || makeClientId("reward");
  return {
    ...reward,
    id,
    itemId: reward?.itemId || id,
    itemName: reward?.itemName ?? "",
    itemIcon: reward?.itemIcon ?? "🎁",
    itemDescription: reward?.itemDescription ?? "",
    requiredScore: Number(reward?.requiredScore ?? 0),
    itemType: reward?.itemType || "badge",
  } as RewardDraft;
}

function rewardDraftsFromShared(rewardList: any[]): RewardDraft[] {
  if (!Array.isArray(rewardList) || rewardList.length === 0)
    return [ensureRewardDraftIds(defaultReward())];
  return rewardList.map(ensureRewardDraftIds);
}

function toRewardPayload(reward: RewardDraft) {
  const r: any = ensureRewardDraftIds(reward);
  return {
    id: r.id,
    itemId: r.itemId,
    itemName: (r.itemName ?? "").trim(),
    itemIcon: (r.itemIcon ?? "").trim() || "🎁",
    itemImageUrl: r.itemImageUrl,
    itemSpriteUrl: r.itemSpriteUrl,
    itemType: r.itemType,
    itemSlot: r.itemSlot,
    itemDescription: (r.itemDescription ?? "").trim(),
    requiredScore: Number(r.requiredScore || 0),
    roomSize: r.roomSize,
    spriteConfig: r.spriteConfig,
    directionImages: r.directionImages,
    availableDirections: r.availableDirections,
    defaultDirection: r.defaultDirection,
    footprint: r.footprint,
    hairLayerMode: r.hairLayerMode,
    tintMaskUrl: r.tintMaskUrl,
    shadowImageUrl: r.shadowImageUrl,
    outlineImageUrl: r.outlineImageUrl,
    overlayImageUrl: r.overlayImageUrl,
    eyeShadowImageUrl: r.eyeShadowImageUrl,
    rightArmPose: r.rightArmPose,
    rightArmImageUrl: r.rightArmImageUrl,
    leftArmPose: r.leftArmPose,
    leftArmImageUrl: r.leftArmImageUrl,
    topBodyImageUrl: r.topBodyImageUrl,
    topLeftArmDefaultImageUrl: r.topLeftArmDefaultImageUrl,
    topRightArmDefaultImageUrl: r.topRightArmDefaultImageUrl,
    topRightArmOneHandedImageUrl: r.topRightArmOneHandedImageUrl,
    topLeftArmTwoHandedImageUrl: r.topLeftArmTwoHandedImageUrl,
    topRightArmTwoHandedImageUrl: r.topRightArmTwoHandedImageUrl,
    underTintMaskUrl: r.underTintMaskUrl,
    underShadowImageUrl: r.underShadowImageUrl,
    underOutlineImageUrl: r.underOutlineImageUrl,
    upperTintMaskUrl: r.upperTintMaskUrl,
    upperShadowImageUrl: r.upperShadowImageUrl,
    upperOutlineImageUrl: r.upperOutlineImageUrl,
    occupiesSlots: r.occupiesSlots,
    curriculum: r.curriculum,
    grade: r.grade,
    semester: r.semester,
    subject: r.subject,
    unit: r.unit,
  };
}

function buildQuizPayloadFromShared(shared: SharedQuiz, classCode: string) {
  const data: any = shared.quiz_data || {};
  const settings = data.settings || {};
  return {
    classCode,
    title: data.metadata?.title || shared.title,
    description: data.metadata?.description || shared.description || "",
    isActive: true,
    isReviewEnabled: false,
    reviewMode: "same",
    questions: data.questions || [],
    rewardOptions: data.rewardOptions || [],
    allowRetry: settings.allowRetry || false,
    retryQuestionMode:
      settings.retryQuestionMode ||
      settings.retryOptions?.questionMode ||
      "same",
    retryRewardMode:
      settings.retryRewardMode || settings.retryOptions?.rewardMode || "same",
    retryRewardOptions:
      data.retryRewardOptions || settings.retryRewardOptions || [],
    maxRetryAttempts:
      settings.maxRetryAttempts || settings.retryOptions?.maxAttempts || 1,
    randomPickEnabled: settings.randomPickEnabled || false,
    randomPickCount: settings.randomPickCount || 0,
    shuffleQuestionsEnabled: settings.shuffleQuestionsEnabled || false,
    quizMode: settings.quizMode || "normal",
    curriculum: data.metadata?.curriculum ||
      data.curriculum || {
        grade: shared.grade,
        semester: shared.semester,
        subject: shared.subject,
        unit: shared.unit,
      },
    grade: shared.grade,
    semester: shared.semester,
    subject: shared.subject,
    unit: shared.unit,
  };
}

function QuizExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classCode = searchParams.get("code") || "";

  const [grade, setGrade] = useState("all");
  const [semester, setSemester] = useState("all");
  const [subject, setSubject] = useState("all");
  const [unit, setUnit] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [quizzes, setQuizzes] = useState<SharedQuiz[]>([]);
  const [totalSharedQuizCount, setTotalSharedQuizCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 24;
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selectedQuiz, setSelectedQuiz] = useState<SharedQuiz | null>(null);
  const [preview, setPreview] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadData, setUploadData] = useState<any>(null);
  const [uploadPreview, setUploadPreview] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [uploadPassword, setUploadPassword] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [myQuizzes, setMyQuizzes] = useState<Quiz[]>([]);
  const [selectedMyQuizId, setSelectedMyQuizId] = useState("none");

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [ownedSharedQuizIds, setOwnedSharedQuizIds] = useState<string[]>([]);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editQuiz, setEditQuiz] = useState<SharedQuiz | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAuthorName, setEditAuthorName] = useState("");
  const [editGrade, setEditGrade] = useState("5");
  const [editSemester, setEditSemester] = useState("1");
  const [editSubject, setEditSubject] = useState("social");
  const [editUnit, setEditUnit] = useState("1");
  const [editThumbnailUrl, setEditThumbnailUrl] = useState("");
  const [isEditAuthorized, setIsEditAuthorized] = useState(false);
  const [editQuestions, setEditQuestions] = useState<any[]>([]);
  const [editRewards, setEditRewards] = useState<RewardDraft[]>([
    ensureRewardDraftIds(defaultReward()),
  ]);
  const [editRetryRewards, setEditRetryRewards] = useState<RewardDraft[]>([
    ensureRewardDraftIds(defaultReward()),
  ]);
  const [editAllowRetry, setEditAllowRetry] = useState(false);
  const [editRetryQuestionMode, setEditRetryQuestionMode] = useState("same");
  const [editRetryRewardMode, setEditRetryRewardMode] = useState("same");
  const [editMaxRetryAttempts, setEditMaxRetryAttempts] = useState(1);
  const [editRandomPickEnabled, setEditRandomPickEnabled] = useState(false);
  const [editRandomPickCount, setEditRandomPickCount] = useState(0);
  const [editShuffleQuestionsEnabled, setEditShuffleQuestionsEnabled] =
    useState(false);
  const [editQuizMode, setEditQuizMode] = useState("normal");

  const availableSubjects = subjectOptions.filter(
    (opt) =>
      opt.value !== "practical" ||
      grade === "all" ||
      grade === "5" ||
      grade === "6",
  );
  const canSelectUnit = grade !== "all" && semester !== "all" && subject !== "all";
  const availableUnits = useMemo(() => {
    // 단원은 학년/학기/과목을 먼저 선택한 뒤 고릅니다.
    return ["1", "2", "3"];
  }, []);

  const rememberOwnedSharedQuiz = (id: string) => {
    setOwnedSharedQuizIds(rememberSharedQuizAsOwned(id));
  };

  const canManageSharedQuiz = (quiz: SharedQuiz) => {
    return isAdmin || Boolean(quiz.is_owner) || ownedSharedQuizIds.includes(quiz.id);
  };

  const ensureSharedQuizDetail = async (quiz: SharedQuiz) => {
    if (quiz.quiz_data) return quiz;
    return await getSharedQuizById(quiz.id);
  };

  const loadSharedQuizzes = async (
    includeHidden = isAdmin,
    page = currentPage,
  ) => {
    setIsLoading(true);
    setError("");
    try {
      const result = await listSharedQuizzes({
        grade,
        semester,
        subject,
        unit,
        keyword,
        includeHidden,
        page,
        pageSize,
      });
      setQuizzes(result.items);
      setTotalSharedQuizCount(result.total);
      setCurrentPage(result.page);

      // 이전 버전에서 대시보드 업로드 등으로 localStorage에 ID가 기록되지 않은 경우에도,
      // 현재 브라우저 owner_token과 일치하는 공유 퀴즈는 내 퀴즈로 다시 인식합니다.
      if (!includeHidden && result.items.length > 0) {
        const currentOwned = new Set(getOwnedSharedQuizIds());
        const recoveredIds = (
          await Promise.all(
            result.items.map(async (quiz) => {
              if (currentOwned.has(quiz.id)) return null;
              try {
                await verifySharedQuizPassword(quiz.id, "");
                return quiz.id;
              } catch {
                return null;
              }
            }),
          )
        ).filter(Boolean) as string[];

        if (recoveredIds.length > 0) {
          let nextOwned = getOwnedSharedQuizIds();
          recoveredIds.forEach((id) => {
            nextOwned = rememberSharedQuizAsOwned(id);
          });
          setOwnedSharedQuizIds(nextOwned);
        }
      }

      if (!isSharedQuizAvailable()) {
        setMessage(
          "Supabase 환경 변수가 설정되면 공유 퀴즈 목록이 표시됩니다.",
        );
      }
    } catch (err: any) {
      setError(err.message || "공유 퀴즈 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(SHARED_QUIZ_ADMIN_SESSION_KEY)
        : null;
    setIsAdmin(stored === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setOwnedSharedQuizIds(getOwnedSharedQuizIds());
    } catch {
      setOwnedSharedQuizIds([]);
    }
  }, []);

  useEffect(() => {
    loadSharedQuizzes(isAdmin, currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, semester, subject, unit, isAdmin, currentPage]);

  useEffect(() => {
    if (!isUploadOpen || !classCode) return;
    getQuizzes(classCode)
      .then(setMyQuizzes)
      .catch(() => setMyQuizzes([]));
  }, [isUploadOpen, classCode]);

  useEffect(() => {
    if (!isUploadOpen) {
      setSelectedMyQuizId("none");
    }
  }, [isUploadOpen]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "a") {
        setIsAdminDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    loadSharedQuizzes(isAdmin, 1);
  };

  const handlePreview = async (quiz: SharedQuiz) => {
    setError("");
    try {
      const detail = await ensureSharedQuizDetail(quiz);
      setSelectedQuiz(detail);
      setPreview(generateQuizPreview(detail.quiz_data));
    } catch {
      setSelectedQuiz(quiz);
      setPreview(`${quiz.title}\n\n미리보기를 생성할 수 없습니다.`);
    }
    setIsPreviewOpen(true);
  };

  const handleImportToMyQuiz = async (quiz: SharedQuiz) => {
    setError("");
    setMessage("");
    try {
      const detail = await ensureSharedQuizDetail(quiz);
      if (!classCode) {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "ssaemquest_pending_shared_quiz_import",
            JSON.stringify(detail.quiz_data),
          );
        }
        router.push("/teacher/quiz/create");
        return;
      }

      const result = await saveQuiz(
        buildQuizPayloadFromShared(detail, classCode),
        false,
      );
      if (!result.success) {
        setError(result.error || "퀴즈 가져오기에 실패했습니다.");
        return;
      }
      await incrementSharedQuizDownload(detail.id);
      setMessage("공유 퀴즈를 내 퀴즈 목록으로 가져왔습니다.");
      router.push(`/teacher/dashboard?code=${classCode}`);
    } catch (err: any) {
      setError(err.message || "공유 퀴즈 상세 정보를 불러오지 못했습니다.");
    }
  };


  const handleAdminExportQuiz = async (quiz: SharedQuiz) => {
    if (!isAdmin) return;
    setError("");
    try {
      const detail = await ensureSharedQuizDetail(quiz);
      const raw = detail.quiz_data || detail;
      const exportData = raw?.questions ? exportQuizToJSON(raw as Quiz) : raw;
      const safeTitle = String(detail.title || "shared-quiz")
        .replace(/[\/:*?"<>|]+/g, "_")
        .trim();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeTitle || "shared-quiz"}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(`「${detail.title}」 퀴즈를 JSON 파일로 저장했습니다.`);
    } catch (err: any) {
      setError(err.message || "퀴즈 파일을 저장하지 못했습니다.");
    }
  };
  const handleUploadFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const data = await importQuizFromJSON(file);
      setUploadData(data);
      setUploadPreview(generateQuizPreview(data));
      setSelectedMyQuizId("none");
    } catch (err: any) {
      setError(err.message || "JSON 파일을 읽지 못했습니다.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSelectMyQuizForUpload = (quizId: string) => {
    setSelectedMyQuizId(quizId);
    if (quizId === "none") return;
    const quiz = myQuizzes.find((q) => q.id === quizId);
    if (!quiz) return;
    const data = exportQuizToJSON(quiz);
    setUploadData(data);
    setUploadPreview(generateQuizPreview(data));
    setError("");
  };

  const handleThumbnailFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("썸네일은 이미지 파일만 사용할 수 있습니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setThumbnailUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleUploadSharedQuiz = async () => {
    if (!uploadData) {
      setError("공유할 퀴즈 JSON 파일을 먼저 선택해주세요.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const sharedQuiz = await uploadSharedQuiz({
        quizData: uploadData,
        authorName,
        uploadPassword,
        thumbnailUrl,
      });
      rememberOwnedSharedQuiz(sharedQuiz.id);
      setIsUploadOpen(false);
      setUploadData(null);
      setUploadPreview("");
      setAuthorName("");
      setUploadPassword("");
      setThumbnailUrl("");
      setMessage("공유 퀴즈가 등록되었습니다.");
      await loadSharedQuizzes(isAdmin);
    } catch (err: any) {
      setError(err.message || "공유 퀴즈 등록에 실패했습니다.");
    }
  };

  const handleReport = async (quiz: SharedQuiz) => {
    if (
      !confirm(
        "이 퀴즈를 신고하시겠습니까? 신고가 누적되면 자동으로 숨김 처리됩니다.",
      )
    )
      return;
    try {
      const count = await reportSharedQuiz(quiz.id);
      setMessage(`신고가 접수되었습니다. 현재 신고 ${count}회`);
      await loadSharedQuizzes(isAdmin);
    } catch (err: any) {
      setError(err.message || "신고 처리에 실패했습니다.");
    }
  };

  const handleAdminLogin = () => {
    if (isSharedQuizAdminPassword(adminPassword)) {
      setIsAdmin(true);
      localStorage.setItem(SHARED_QUIZ_ADMIN_SESSION_KEY, "true");
      sessionStorage.setItem(SHARED_QUIZ_ADMIN_PASSWORD_SESSION_KEY, adminPassword);
      setIsAdminDialogOpen(false);
      setAdminPassword("");
      setMessage("관리자 모드가 활성화되었습니다.");
    } else {
      setError("관리자 비밀번호가 올바르지 않습니다.");
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(SHARED_QUIZ_ADMIN_SESSION_KEY);
      sessionStorage.removeItem(SHARED_QUIZ_ADMIN_PASSWORD_SESSION_KEY);
    }
    setMessage("관리자 모드가 비활성화되었습니다.");
  };

  const toggleHide = async (quiz: SharedQuiz) => {
    try {
      if (quiz.is_hidden) await unhideSharedQuizAsAdmin(quiz.id);
      else await hideSharedQuizAsAdmin(quiz.id);
      await loadSharedQuizzes(true);
    } catch (err: any) {
      setError(err.message || "관리자 작업에 실패했습니다.");
    }
  };

  const openEditDialog = async (quiz: SharedQuiz) => {
    let detail: SharedQuiz;
    try {
      detail = await ensureSharedQuizDetail(quiz);
    } catch (err: any) {
      setError(err.message || "공유 퀴즈 상세 정보를 불러오지 못했습니다.");
      return;
    }
    const data: any = detail.quiz_data || {};
    const settings: any = data.settings || {};
    const curriculum: any = data.metadata?.curriculum || data.curriculum || {};
    setEditQuiz(detail);
    setEditPassword("");
    setIsEditAuthorized(isAdmin);
    setEditTitle(data.metadata?.title || detail.title || "");
    setEditDescription(data.metadata?.description || detail.description || "");
    setEditAuthorName(detail.author_name || "");
    setEditGrade(String(curriculum.grade || detail.grade || "5"));
    setEditSemester(String(curriculum.semester || detail.semester || "1"));
    setEditSubject(String(curriculum.subject || detail.subject || "social"));
    setEditUnit(String(curriculum.unit || detail.unit || "1"));
    setEditThumbnailUrl(
      detail.thumbnail_url || data.metadata?.thumbnailUrl || "",
    );
    setEditQuestions(
      (Array.isArray(data.questions) ? data.questions : []).map(
        normalizeQuestion,
      ),
    );
    setEditRewards(rewardDraftsFromShared(data.rewardOptions || []));
    setEditRetryRewards(
      rewardDraftsFromShared(
        data.retryRewardOptions || settings.retryRewardOptions || [],
      ),
    );
    setEditAllowRetry(
      Boolean(settings.allowRetry || settings.retryOptions?.enabled),
    );
    setEditRetryQuestionMode(
      settings.retryQuestionMode ||
        settings.retryOptions?.questionMode ||
        "same",
    );
    setEditRetryRewardMode(
      settings.retryRewardMode || settings.retryOptions?.rewardMode || "same",
    );
    setEditMaxRetryAttempts(
      Number(
        settings.maxRetryAttempts || settings.retryOptions?.maxAttempts || 1,
      ),
    );
    setEditRandomPickEnabled(Boolean(settings.randomPickEnabled));
    setEditRandomPickCount(Number(settings.randomPickCount || 0));
    setEditShuffleQuestionsEnabled(Boolean(settings.shuffleQuestionsEnabled));
    setEditQuizMode(settings.quizMode || "normal");
    setError("");
    setIsEditDialogOpen(true);
  };

  const handleVerifyEditPassword = async () => {
    if (!editQuiz) return;
    try {
      await verifySharedQuizPassword(editQuiz.id, editPassword, isAdmin);
      setIsEditAuthorized(true);
      setError("");
      setMessage("수정 권한이 확인되었습니다.");
    } catch (err: any) {
      setError(err.message || "비밀번호 확인에 실패했습니다.");
    }
  };

  const updateEditQuestion = (index: number, patch: Record<string, any>) => {
    setEditQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  };

  const addEditQuestion = () => {
    setEditQuestions((prev) => [
      ...prev,
      normalizeQuestion({ text: "", points: 10, type: "single" }, prev.length),
    ]);
  };

  const removeEditQuestion = (index: number) => {
    setEditQuestions((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((q, i) => ({ ...q, order: i + 1 })),
    );
  };

  const updateQuestionOption = (
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) => {
    setEditQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        const options = Array.isArray(q.options) ? [...q.options] : [];
        options[optionIndex] = value;
        return { ...q, options };
      }),
    );
  };

  const handleEditThumbnailFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("썸네일은 이미지 파일만 사용할 수 있습니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditThumbnailUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    if (!editQuiz) return;
    if (!isEditAuthorized) {
      setError("먼저 수정/삭제용 비밀번호를 확인해주세요.");
      return;
    }
    if (!editTitle.trim()) {
      setError("퀴즈 제목을 입력해주세요.");
      return;
    }
    if (editQuestions.length === 0) {
      setError("문항은 최소 1개 이상 필요합니다.");
      return;
    }
    try {
      const rewardOptions = editRewards.map(toRewardPayload);
      const retryRewardOptions = editRetryRewards.map(toRewardPayload);
      const normalizedQuestions = editQuestions.map((q, index) => ({
        ...q,
        id: q.id || `shared-question-${Date.now()}-${index}`,
        quizId: q.quizId || editQuiz.id,
        order: index + 1,
        points: Number(q.points || 0),
        options:
          q.type === "single" || q.type === "multiple"
            ? (q.options || []).filter((opt: string) => String(opt).trim())
            : [],
        correctAnswers:
          q.type === "single" || q.type === "multiple"
            ? (q.correctAnswers || [])
                .map((v: any) => Number(v))
                .filter((v: number) => Number.isFinite(v))
            : [],
        shortAnswers:
          q.type === "short"
            ? (q.shortAnswers || []).filter((answer: string) =>
                String(answer).trim(),
              )
            : [],
      }));
      const totalScore = normalizedQuestions.reduce(
        (sum, q) => sum + Number(q.points || 0),
        0,
      );
      const nextQuizData: any = {
        ...(editQuiz.quiz_data || {}),
        metadata: {
          ...((editQuiz.quiz_data as any)?.metadata || {}),
          title: editTitle.trim(),
          description: editDescription || "",
          totalScore,
          totalQuestions: normalizedQuestions.length,
          updatedAt: new Date().toISOString(),
          curriculum: {
            grade: editGrade,
            semester: editSemester,
            subject: editSubject,
            unit: editUnit,
          },
          thumbnailUrl: editThumbnailUrl || null,
        },
        curriculum: {
          grade: editGrade,
          semester: editSemester,
          subject: editSubject,
          unit: editUnit,
        },
        settings: {
          ...((editQuiz.quiz_data as any)?.settings || {}),
          allowRetry: editAllowRetry,
          retryQuestionMode: editRetryQuestionMode,
          retryRewardMode: editRetryRewardMode,
          maxRetryAttempts: Number(editMaxRetryAttempts || 1),
          randomPickEnabled: editRandomPickEnabled,
          randomPickCount: Number(editRandomPickCount || 0),
          shuffleQuestionsEnabled: editShuffleQuestionsEnabled,
          quizMode: editQuizMode,
        },
        questions: normalizedQuestions,
        rewardOptions,
        retryRewardOptions,
        version: (editQuiz.quiz_data as any)?.version || "1.0",
      };

      await updateSharedQuizWithPassword({
        id: editQuiz.id,
        password: editPassword,
        admin: isAdmin,
        title: editTitle.trim(),
        description: editDescription,
        authorName: editAuthorName,
        grade: editGrade,
        semester: editSemester,
        subject: editSubject,
        unit: editUnit,
        thumbnailUrl: editThumbnailUrl || null,
        quizData: nextQuizData,
      });
      setIsEditDialogOpen(false);
      setMessage("공유 퀴즈가 수정되었습니다.");
      await loadSharedQuizzes(isAdmin);
    } catch (err: any) {
      setError(err.message || "공유 퀴즈 수정에 실패했습니다.");
    }
  };

  const handleDeleteShared = async (quiz: SharedQuiz) => {
    const password = isAdmin
      ? ""
      : window.prompt(
          "업로드할 때 설정한 수정/삭제용 비밀번호를 입력해주세요.\n비밀번호를 설정하지 않았다면 빈칸으로 확인을 누르세요.",
        ) || "";
    if (!isAdmin && password === null) return;
    if (!window.confirm(`'${quiz.title}' 공유 퀴즈를 삭제하시겠습니까?`))
      return;
    try {
      if (isAdmin) await deleteSharedQuizAsAdmin(quiz.id);
      else await deleteSharedQuizWithPassword(quiz.id, password, false);
      setMessage("공유 퀴즈가 삭제되었습니다.");
      await loadSharedQuizzes(isAdmin);
    } catch (err: any) {
      setError(err.message || "공유 퀴즈 삭제에 실패했습니다.");
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1)
                router.back();
              else
                router.push(
                  classCode
                    ? `/teacher/dashboard?code=${classCode}`
                    : "/teacher",
                );
            }}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> 돌아가기
          </button>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">퀴즈 탐색</h1>
              <p className="text-muted-foreground mt-1">
                다른 선생님들이 공유한 퀴즈를 교육과정별로 검색하고 가져올 수
                있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={handleAdminLogout}>
                  <ShieldAlert className="w-4 h-4 mr-2" /> 관리자 로그아웃
                </Button>
              )}
              <Button onClick={() => setIsUploadOpen(true)}>
                <Upload className="w-4 h-4 mr-2" /> 공유 퀴즈 업로드
              </Button>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" /> 검색 필터
            </CardTitle>
            <CardDescription>
              학년, 학기, 과목, 단원 또는 검색어로 공유 퀴즈를 찾습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Select
              value={grade}
              onValueChange={(v) => {
                setCurrentPage(1);
                setGrade(v);
                if ((v === "3" || v === "4") && subject === "practical")
                  setSubject("all");
                setUnit("all");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="학년" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학년</SelectItem>
                {gradeOptions.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}학년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={semester}
              onValueChange={(v) => {
                setCurrentPage(1);
                setSemester(v);
                setUnit("all");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="학기" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학기</SelectItem>
                {semesterOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}학기
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={subject}
              onValueChange={(v) => {
                setCurrentPage(1);
                setSubject(v);
                setUnit("all");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="과목" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 과목</SelectItem>
                {availableSubjects.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={unit}
              disabled={!canSelectUnit}
              onValueChange={(v) => {
                setCurrentPage(1);
                setUnit(v);
              }}
            >
              <SelectTrigger className="disabled:opacity-50 disabled:cursor-not-allowed">
                <SelectValue placeholder={canSelectUnit ? "단원" : "학년/학기/과목 선택 후 선택"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 단원</SelectItem>
                {availableUnits.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}단원
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="제목/설명 검색"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? "검색 중..." : "검색"}
            </Button>
          </CardContent>
        </Card>

        {message && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {quizzes.map((quiz) => {
            const canManage = canManageSharedQuiz(quiz);
            return (
              <Card
                key={quiz.id}
                className={`overflow-hidden transition hover:shadow-md ${quiz.is_hidden ? "opacity-60 border-destructive/40" : ""}`}
              >
                <div className="aspect-square bg-sky-50 border-b flex items-center justify-center overflow-hidden">
                  {quiz.thumbnail_url ? (
                    <img
                      src={quiz.thumbnail_url}
                      alt={quiz.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sky-500">
                      <FileQuestion className="w-12 h-12" />
                      <span className="text-sm font-bold">QUIZ</span>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="shrink-0">퀴즈</Badge>
                    <span className="text-xs rounded bg-white/80 border px-2 py-0.5">
                      {quiz.question_count || 0}문제
                    </span>
                    {getSharedQuizRandomQuestionLabel(quiz) && (
                      <span className="text-xs rounded bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5">
                        {getSharedQuizRandomQuestionLabel(quiz)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold leading-snug line-clamp-2 min-h-[2.75rem]">
                      {quiz.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {quiz.description || "설명 없음"}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{getCurriculumLabel(quiz)}</p>
                    <p>
                      {quiz.author_name || "익명"} · 가져오기{" "}
                      {quiz.download_count || 0} · 신고 {quiz.report_count || 0}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreview(quiz)}
                    >
                      <Eye className="w-4 h-4 mr-1" /> 미리보기
                    </Button>
                    {!quiz.is_hidden && (
                      <Button
                        size="sm"
                        onClick={() => handleImportToMyQuiz(quiz)}
                      >
                        <Download className="w-4 h-4 mr-1" /> 가져오기
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(quiz)}
                      >
                        <Pencil className="w-4 h-4 mr-1" /> 수정
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteShared(quiz)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> 삭제
                      </Button>
                    )}
                    {!quiz.is_hidden && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReport(quiz)}
                      >
                        <Flag className="w-4 h-4 mr-1" /> 신고
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdminExportQuiz(quiz)}
                      >
                        <Download className="w-4 h-4 mr-1" /> JSON 내보내기
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => toggleHide(quiz)}
                      >
                        <ShieldAlert className="w-4 h-4 mr-1" />{" "}
                        {quiz.is_hidden ? "해제" : "숨김"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!isLoading && quizzes.length === 0 && (
            <div className="col-span-full text-center py-16 border rounded-xl bg-white/70">
              <p className="text-muted-foreground">
                조건에 맞는 공유 퀴즈가 없습니다.
              </p>
            </div>
          )}
        </div>

        {totalSharedQuizCount > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 rounded-xl border bg-white/70 p-4">
            <Button
              variant="outline"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              이전
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} /{" "}
              {Math.max(1, Math.ceil(totalSharedQuizCount / pageSize))}쪽 · 총{" "}
              {totalSharedQuizCount}개
            </span>
            <Button
              variant="outline"
              disabled={
                currentPage >= Math.ceil(totalSharedQuizCount / pageSize) ||
                isLoading
              }
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              다음
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedQuiz?.title || "퀴즈 미리보기"}</DialogTitle>
            <DialogDescription>
              {selectedQuiz ? getCurriculumLabel(selectedQuiz) : ""}
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-muted p-4 rounded-md text-xs whitespace-pre-wrap break-words overflow-auto flex-1 min-h-0 font-sans">
            {preview}
          </pre>
          <DialogFooter>
            {selectedQuiz && !selectedQuiz.is_hidden && (
              <Button onClick={() => handleImportToMyQuiz(selectedQuiz)}>
                내 퀴즈로 가져오기
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>공유 퀴즈 업로드</DialogTitle>
            <DialogDescription>
              내 퀴즈를 선택하거나 JSON 파일을 선택해 선생님들과 공유합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">작성자 이름(선택)</Label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="예: 5학년 교사"
                />
              </div>
              <div>
                <Label className="text-xs">수정/삭제용 비밀번호(선택)</Label>
                <Input
                  type="password"
                  value={uploadPassword}
                  onChange={(e) => setUploadPassword(e.target.value)}
                  placeholder="추후 수정 기능용"
                />
              </div>
            </div>
            {classCode && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">내 퀴즈에서 선택</Label>
                <Select
                  value={selectedMyQuizId}
                  onValueChange={handleSelectMyQuizForUpload}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="내 퀴즈 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안 함</SelectItem>
                    {myQuizzes.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.title} ({q.questions?.length || 0}문제)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-medium">또는 JSON 파일 선택</Label>
              <Input
                ref={uploadInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleUploadFile}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" /> 대표 사진/썸네일(선택)
              </Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleThumbnailFile}
              />
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt="썸네일 미리보기"
                  className="h-24 w-24 rounded-md border object-cover"
                />
              )}
            </div>
            {uploadPreview && (
              <pre className="bg-muted p-4 rounded-md max-h-80 overflow-auto text-xs whitespace-pre-wrap break-words font-sans">
                {uploadPreview}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUploadSharedQuiz} disabled={!uploadData}>
              공유 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>공유 퀴즈 수정</DialogTitle>
            <DialogDescription>
              비밀번호 확인 후 문항, 보상, 재도전 설정, 제목, 교육과정 분류를
              함께 수정합니다. 관리자 모드에서는 비밀번호 없이 수정할 수
              있습니다.
            </DialogDescription>
          </DialogHeader>

          {!isEditAuthorized ? (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-xs">수정/삭제용 비밀번호</Label>
                <Input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="업로드 시 설정한 비밀번호"
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleVerifyEditPassword()
                  }
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  비밀번호를 설정하지 않은 퀴즈라면 빈칸으로 확인을 누르세요.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  취소
                </Button>
                <Button onClick={handleVerifyEditPassword}>
                  비밀번호 확인
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-5 overflow-y-auto pr-2 flex-1 min-h-0">
                <section className="rounded-lg border bg-white/70 p-4 space-y-3">
                  <h3 className="font-semibold">기본 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">퀴즈 제목</Label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">작성자 이름</Label>
                      <Input
                        value={editAuthorName}
                        onChange={(e) => setEditAuthorName(e.target.value)}
                        placeholder="익명 가능"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">설명</Label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">학년</Label>
                      <Select
                        value={editGrade}
                        onValueChange={(v) => {
                          setEditGrade(v);
                          if (
                            (v === "3" || v === "4") &&
                            editSubject === "practical"
                          )
                            setEditSubject("social");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gradeOptions.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}학년
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">학기</Label>
                      <Select
                        value={editSemester}
                        onValueChange={setEditSemester}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {semesterOptions.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}학기
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">과목</Label>
                      <Select
                        value={editSubject}
                        onValueChange={setEditSubject}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {subjectOptions
                            .filter(
                              (opt) =>
                                opt.value !== "practical" ||
                                editGrade === "5" ||
                                editGrade === "6",
                            )
                            .map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">단원</Label>
                      <Input
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" /> 대표
                      사진/썸네일(선택)
                    </Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleEditThumbnailFile}
                    />
                    {editThumbnailUrl && (
                      <div className="flex items-center gap-3">
                        <img
                          src={editThumbnailUrl}
                          alt="썸네일 미리보기"
                          className="h-24 w-24 rounded-md border object-cover"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditThumbnailUrl("")}
                        >
                          썸네일 제거
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border bg-white/70 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">문항 설정</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addEditQuestion}
                    >
                      <Plus className="w-4 h-4 mr-1" /> 문항 추가
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {editQuestions.map((question, qIndex) => (
                      <div
                        key={question.id || qIndex}
                        className="rounded-lg border bg-white p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">문항 {qIndex + 1}</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeEditQuestion(qIndex)}
                          >
                            <X className="w-4 h-4 mr-1" /> 삭제
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">유형</Label>
                            <Select
                              value={question.type || "single"}
                              onValueChange={(v) =>
                                updateEditQuestion(qIndex, { type: v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="single">
                                  객관식 단일
                                </SelectItem>
                                <SelectItem value="multiple">
                                  객관식 복수
                                </SelectItem>
                                <SelectItem value="short">단답형</SelectItem>
                                <SelectItem value="essay">서술형</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">점수</Label>
                            <Input
                              type="number"
                              value={question.points}
                              onChange={(e) =>
                                updateEditQuestion(qIndex, {
                                  points: Number(e.target.value || 0),
                                })
                              }
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-xs">힌트(선택)</Label>
                            <Input
                              value={question.hint || ""}
                              onChange={(e) =>
                                updateEditQuestion(qIndex, {
                                  hint: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">문항 내용</Label>
                          <Textarea
                            value={question.text || ""}
                            onChange={(e) =>
                              updateEditQuestion(qIndex, {
                                text: e.target.value,
                              })
                            }
                            rows={3}
                          />
                        </div>
                        {(question.type === "single" ||
                          question.type === "multiple") && (
                          <div className="space-y-2">
                            <Label className="text-xs">선택지</Label>
                            {(question.options || ["", "", "", ""]).map(
                              (option: string, optionIndex: number) => (
                                <Input
                                  key={optionIndex}
                                  value={option}
                                  onChange={(e) =>
                                    updateQuestionOption(
                                      qIndex,
                                      optionIndex,
                                      e.target.value,
                                    )
                                  }
                                  placeholder={`선택지 ${optionIndex + 1}`}
                                />
                              ),
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateEditQuestion(qIndex, {
                                    options: [...(question.options || []), ""],
                                  })
                                }
                              >
                                선택지 추가
                              </Button>
                              {(question.options || []).length > 1 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateEditQuestion(qIndex, {
                                      options: (question.options || []).slice(
                                        0,
                                        -1,
                                      ),
                                    })
                                  }
                                >
                                  마지막 선택지 삭제
                                </Button>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs">정답 번호</Label>
                              <Input
                                value={(question.correctAnswers || [])
                                  .map((answer: number) => Number(answer) + 1)
                                  .join(",")}
                                onChange={(e) =>
                                  updateEditQuestion(qIndex, {
                                    correctAnswers: e.target.value
                                      .split(",")
                                      .map((v) => Number(v.trim()) - 1)
                                      .filter(
                                        (v) => Number.isFinite(v) && v >= 0,
                                      ),
                                  })
                                }
                                placeholder="예: 1 또는 1,3"
                              />
                            </div>
                          </div>
                        )}
                        {question.type === "short" && (
                          <div>
                            <Label className="text-xs">단답형 정답</Label>
                            <Input
                              value={(question.shortAnswers || []).join(",")}
                              onChange={(e) =>
                                updateEditQuestion(qIndex, {
                                  shortAnswers: e.target.value
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="예: 헌법,법"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border bg-white/70 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">보상 설정</h3>
                      <p className="text-xs text-muted-foreground">
                        퀴즈 만들기 화면과 같은 방식으로 보상 아이템을 선택하고
                        점수 조건을 수정할 수 있습니다.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditRewards((prev) => [
                          ...prev,
                          ensureRewardDraftIds(defaultReward()),
                        ])
                      }
                    >
                      <Plus className="w-4 h-4 mr-1" /> 보상 추가
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {editRewards.map((reward, rewardIndex) => (
                      <RewardItemEditor
                        key={reward.id || rewardIndex}
                        index={rewardIndex}
                        reward={reward}
                        onChange={(updated) =>
                          setEditRewards((prev) =>
                            prev.map((r, i) =>
                              i === rewardIndex
                                ? ensureRewardDraftIds(updated)
                                : r,
                            ),
                          )
                        }
                        onRemove={() =>
                          setEditRewards((prev) =>
                            prev.length <= 1
                              ? prev
                              : prev.filter((_, i) => i !== rewardIndex),
                          )
                        }
                      />
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border bg-white/70 p-4 space-y-3">
                  <h3 className="font-semibold">재도전 및 출제 설정</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">재도전 허용</Label>
                      <Select
                        value={editAllowRetry ? "true" : "false"}
                        onValueChange={(v) => setEditAllowRetry(v === "true")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">불허</SelectItem>
                          <SelectItem value="true">허용</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">최대 재도전 횟수</Label>
                      <Input
                        type="number"
                        min={1}
                        value={editMaxRetryAttempts}
                        onChange={(e) =>
                          setEditMaxRetryAttempts(Number(e.target.value || 1))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">퀴즈 모드</Label>
                      <Select
                        value={editQuizMode}
                        onValueChange={setEditQuizMode}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">일반</SelectItem>
                          <SelectItem value="live">함께 풀기</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">재도전 문제 방식</Label>
                      <Select
                        value={editRetryQuestionMode}
                        onValueChange={setEditRetryQuestionMode}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="same">같은 문제</SelectItem>
                          <SelectItem value="modified">변형 문제</SelectItem>
                          <SelectItem value="random">랜덤</SelectItem>
                          <SelectItem value="extended">확장</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">재도전 보상 방식</Label>
                      <Select
                        value={editRetryRewardMode}
                        onValueChange={setEditRetryRewardMode}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="same">같은 보상</SelectItem>
                          <SelectItem value="different">다른 보상</SelectItem>
                          <SelectItem value="none">없음</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">랜덤 출제</Label>
                      <Select
                        value={editRandomPickEnabled ? "true" : "false"}
                        onValueChange={(v) =>
                          setEditRandomPickEnabled(v === "true")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">사용 안 함</SelectItem>
                          <SelectItem value="true">사용</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">랜덤 출제 문항 수</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editRandomPickCount}
                        onChange={(e) =>
                          setEditRandomPickCount(Number(e.target.value || 0))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">문제 순서 섞기</Label>
                    <Select
                      value={editShuffleQuestionsEnabled ? "true" : "false"}
                      onValueChange={(v) =>
                        setEditShuffleQuestionsEnabled(v === "true")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">아니오</SelectItem>
                        <SelectItem value="true">예</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editAllowRetry && editRetryRewardMode === "different" && (
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label className="text-xs font-semibold">
                            재도전 전용 보상
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            재도전 보상 방식이 ‘다른 보상’일 때 사용할
                            보상입니다.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditRetryRewards((prev) => [
                              ...prev,
                              ensureRewardDraftIds(defaultReward()),
                            ])
                          }
                        >
                          <Plus className="w-4 h-4 mr-1" /> 보상 추가
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {editRetryRewards.map((reward, rewardIndex) => (
                          <RewardItemEditor
                            key={reward.id || rewardIndex}
                            index={rewardIndex}
                            reward={reward}
                            onChange={(updated) =>
                              setEditRetryRewards((prev) =>
                                prev.map((r, i) =>
                                  i === rewardIndex
                                    ? ensureRewardDraftIds(updated)
                                    : r,
                                ),
                              )
                            }
                            onRemove={() =>
                              setEditRetryRewards((prev) =>
                                prev.length <= 1
                                  ? prev
                                  : prev.filter((_, i) => i !== rewardIndex),
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  취소
                </Button>
                <Button onClick={handleSaveEdit}>수정 저장</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> 관리자 확인
            </DialogTitle>
            <DialogDescription>
              공유 퀴즈 숨김/해제를 위한 관리자 모드입니다.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="관리자 비밀번호"
            onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
          />
          <DialogFooter>
            <Button onClick={handleAdminLogin}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function QuizExplorePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <QuizExploreContent />
    </Suspense>
  );
}
