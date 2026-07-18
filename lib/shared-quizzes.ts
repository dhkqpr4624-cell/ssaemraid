"use client";

import { supabase } from "./supabase";
import type { QuizExportData } from "./types";

export type SharedQuizCurriculum = {
  grade: string;
  semester: string;
  subject: string;
  unit: string;
};

export type SharedQuiz = {
  id: string;
  title: string;
  description: string;
  author_name?: string;
  grade: string;
  semester: string;
  subject: string;
  unit: string;
  quiz_data?: QuizExportData;
  thumbnail_url?: string | null;
  question_count?: number;
  random_pick_enabled?: boolean;
  random_pick_count?: number;
  total_score?: number;
  download_count?: number;
  report_count?: number;
  is_hidden?: boolean;
  is_owner?: boolean;
  created_at?: string;
};

export type SharedQuizFilters = Partial<SharedQuizCurriculum> & {
  keyword?: string;
  includeHidden?: boolean;
  page?: number;
  pageSize?: number;
};

export type SharedQuizListResult = {
  items: SharedQuiz[];
  total: number;
  page: number;
  pageSize: number;
};

export const SHARED_QUIZ_ADMIN_SESSION_KEY = "ssaemquest_shared_quiz_admin";
export const SHARED_QUIZ_ADMIN_PASSWORD_SESSION_KEY =
  "ssaemquest_shared_quiz_admin_password";
const SHARED_QUIZ_OWNER_TOKEN_KEY = "ssaemquest_shared_quiz_owner_token";

function getSupabaseReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function makeRandomToken() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `owner_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getSharedQuizOwnerToken() {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem(SHARED_QUIZ_OWNER_TOKEN_KEY) || "";
  if (!token) {
    token = makeRandomToken();
    localStorage.setItem(SHARED_QUIZ_OWNER_TOKEN_KEY, token);
  }
  return token;
}

export const OWNED_SHARED_QUIZ_IDS_KEY = "ssaemquest_owned_shared_quiz_ids";

export function getOwnedSharedQuizIds() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const parsed = JSON.parse(localStorage.getItem(OWNED_SHARED_QUIZ_IDS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

export function rememberSharedQuizAsOwned(id: string) {
  if (!id || typeof window === "undefined") return [] as string[];
  const next = Array.from(new Set([...getOwnedSharedQuizIds(), String(id)]));
  localStorage.setItem(OWNED_SHARED_QUIZ_IDS_KEY, JSON.stringify(next));
  return next;
}

export function getSharedQuizAdminSessionPassword() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(SHARED_QUIZ_ADMIN_PASSWORD_SESSION_KEY) || "";
}

function getCurriculum(data: any): SharedQuizCurriculum {
  const source = data?.metadata?.curriculum || data?.curriculum || {};
  return {
    grade: String(source.grade || "5"),
    semester: String(source.semester || "1"),
    subject: String(source.subject || "social"),
    unit: String(source.unit || "1"),
  };
}

function getQuizMeta(inputQuizData: QuizExportData) {
  const questions = Array.isArray(inputQuizData?.questions)
    ? inputQuizData.questions
    : [];
  const questionCount = Number(
    inputQuizData?.metadata?.totalQuestions || questions.length || 0,
  );
  const totalScore = Number(
    inputQuizData?.metadata?.totalScore ||
      questions.reduce(
        (sum: number, q: any) => sum + Number(q?.points || 0),
        0,
      ),
  );
  return { questions, questionCount, totalScore };
}

export function isSharedQuizAvailable() {
  return getSupabaseReady();
}

export function getSharedQuizAdminPassword() {
  return process.env.NEXT_PUBLIC_SHARED_QUIZ_ADMIN_PASSWORD || "";
}

export function isSharedQuizAdminPassword(input: string) {
  const configured = getSharedQuizAdminPassword();
  return Boolean(configured && input && input === configured);
}

export async function listSharedQuizzes(
  filters: SharedQuizFilters = {},
): Promise<SharedQuizListResult> {
  if (!getSupabaseReady())
    return { items: [], total: 0, page: 1, pageSize: 24 };

  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(48, Math.max(12, Number(filters.pageSize || 24)));
  const ownerToken = getSharedQuizOwnerToken();

  // 서버 RPC에서 목록 조회와 현재 브라우저 owner_token 기준 소유 여부를 함께 계산합니다.
  // 이렇게 해야 localStorage의 ID 목록이 비어 있거나, 대시보드에서 업로드한 경우에도
  // 내가 올린 퀴즈의 수정/삭제 버튼이 안정적으로 표시됩니다.
  const { data, error } = await supabase.rpc("list_shared_quizzes", {
    p_grade: filters.grade && filters.grade !== "all" ? filters.grade : null,
    p_semester:
      filters.semester && filters.semester !== "all" ? filters.semester : null,
    p_subject:
      filters.subject && filters.subject !== "all" ? filters.subject : null,
    p_unit: filters.unit && filters.unit !== "all" ? filters.unit : null,
    p_keyword: filters.keyword?.trim() || null,
    p_include_hidden: Boolean(filters.includeHidden),
    p_page: page,
    p_page_size: pageSize,
    p_owner_token: ownerToken || null,
  });

  if (error) {
    console.error("[Shared Quiz] list error:", error);
    throw new Error(error.message || "공유 퀴즈 목록을 불러오지 못했습니다.");
  }

  const rows = Array.isArray(data) ? data : [];
  const total = Number(rows[0]?.total_count || 0);
  return {
    items: rows.map(({ total_count, ...row }: any) => row) as SharedQuiz[],
    total,
    page,
    pageSize,
  };
}

export async function getSharedQuizById(id: string): Promise<SharedQuiz> {
  if (!getSupabaseReady())
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");

  const { data, error } = await supabase
    .from("shared_quizzes_public")
    .select(
      "id,title,description,author_name,grade,semester,subject,unit,quiz_data,thumbnail_url,question_count,total_score,download_count,report_count,is_hidden,created_at,updated_at",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[Shared Quiz] detail error:", error);
    throw new Error(
      error?.message || "공유 퀴즈 상세 정보를 불러오지 못했습니다.",
    );
  }
  return data as SharedQuiz;
}

export async function uploadSharedQuiz(input: {
  quizData: QuizExportData;
  authorName?: string;
  uploadPassword?: string;
  thumbnailUrl?: string | null;
}) {
  if (!getSupabaseReady())
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");

  const curriculum = getCurriculum(input.quizData);
  const title = input.quizData?.metadata?.title || "제목 없는 퀴즈";
  const description = input.quizData?.metadata?.description || "";
  const { questionCount, totalScore } = getQuizMeta(input.quizData);

  const { data, error } = await supabase
    .rpc("create_shared_quiz", {
      p_title: title,
      p_description: description,
      p_author_name: input.authorName?.trim() || null,
      p_grade: curriculum.grade,
      p_semester: curriculum.semester,
      p_subject: curriculum.subject,
      p_unit: curriculum.unit,
      p_quiz_data: input.quizData as any,
      p_thumbnail_url:
        input.thumbnailUrl ||
        (input.quizData?.metadata as any)?.thumbnailUrl ||
        null,
      p_upload_password: input.uploadPassword?.trim() || null,
      p_owner_token: getSharedQuizOwnerToken(),
      p_question_count: questionCount,
      p_total_score: totalScore,
    })
    .single();

  if (error) {
    console.error("[Shared Quiz] upload error:", error);
    throw new Error(error.message || "공유 퀴즈 업로드에 실패했습니다.");
  }
  if (data?.id) rememberSharedQuizAsOwned(String(data.id));
  return data as SharedQuiz;
}

export async function verifySharedQuizPassword(
  id: string,
  password?: string,
  admin = false,
) {
  if (!getSupabaseReady())
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");

  if (admin) return true;

  const { data, error } = await supabase.rpc("verify_shared_quiz_edit_access", {
    p_id: id,
    p_password: String(password || "").trim(),
    p_owner_token: getSharedQuizOwnerToken(),
  });

  if (error) throw new Error(error.message || "수정 권한 확인에 실패했습니다.");
  if (!data) throw new Error("수정/삭제 권한이 없습니다.");
  return true;
}

export async function updateSharedQuizWithPassword(input: {
  id: string;
  password?: string;
  admin?: boolean;
  title: string;
  description?: string;
  authorName?: string;
  grade: string;
  semester: string;
  subject: string;
  unit: string;
  thumbnailUrl?: string | null;
  quizData?: QuizExportData;
}) {
  if (!getSupabaseReady())
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");

  if (input.admin) {
    await callSharedQuizAdminAction("update", {
      id: input.id,
      title: input.title,
      description: input.description || "",
      authorName: input.authorName || "",
      grade: input.grade,
      semester: input.semester,
      subject: input.subject,
      unit: input.unit,
      thumbnailUrl: input.thumbnailUrl || null,
      quizData: input.quizData || null,
    });
    return;
  }

  if (!input.quizData) throw new Error("수정할 퀴즈 데이터가 없습니다.");
  const { questions, totalScore } = getQuizMeta(input.quizData);
  const nextQuizData: any = {
    ...input.quizData,
    metadata: {
      ...(input.quizData.metadata || {}),
      title: input.title,
      description: input.description || "",
      totalQuestions: questions.length,
      totalScore,
      curriculum: {
        grade: input.grade,
        semester: input.semester,
        subject: input.subject,
        unit: input.unit,
      },
      thumbnailUrl: input.thumbnailUrl || null,
    },
    curriculum: {
      grade: input.grade,
      semester: input.semester,
      subject: input.subject,
      unit: input.unit,
    },
  };

  const { error } = await supabase.rpc("update_shared_quiz_with_password", {
    p_id: input.id,
    p_password: String(input.password || "").trim(),
    p_owner_token: getSharedQuizOwnerToken(),
    p_title: input.title,
    p_description: input.description || "",
    p_author_name: input.authorName?.trim() || null,
    p_grade: input.grade,
    p_semester: input.semester,
    p_subject: input.subject,
    p_unit: input.unit,
    p_thumbnail_url: input.thumbnailUrl || null,
    p_question_count: questions.length,
    p_total_score: totalScore,
    p_quiz_data: nextQuizData,
  });

  if (error) throw new Error(error.message || "공유 퀴즈 수정에 실패했습니다.");
}

export async function deleteSharedQuizWithPassword(
  id: string,
  password?: string,
  admin = false,
) {
  if (!getSupabaseReady())
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");

  if (admin) {
    await deleteSharedQuizAsAdmin(id);
    return;
  }

  const { error } = await supabase.rpc("delete_shared_quiz_with_password", {
    p_id: id,
    p_password: String(password || "").trim(),
    p_owner_token: getSharedQuizOwnerToken(),
  });
  if (error) throw new Error(error.message || "공유 퀴즈 삭제에 실패했습니다.");
}

async function callSharedQuizAdminAction(action: string, payload: Record<string, any>) {
  const password = getSharedQuizAdminSessionPassword();
  const response = await fetch("/api/shared-quizzes/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, password, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || "관리자 작업에 실패했습니다.");
  }
  return result;
}

export async function deleteSharedQuizAsAdmin(id: string) {
  await callSharedQuizAdminAction("delete", { id });
}

export async function incrementSharedQuizDownload(id: string) {
  try {
    await supabase.rpc("increment_shared_quiz_download", { p_id: id });
  } catch (err) {
    console.warn("[Shared Quiz] download count update skipped:", err);
  }
}

export async function reportSharedQuiz(id: string) {
  const { data, error } = await supabase.rpc("report_shared_quiz", { p_id: id });
  if (error) throw new Error(error.message || "신고 처리에 실패했습니다.");
  return Number(data || 0);
}

export async function hideSharedQuizAsAdmin(id: string) {
  await callSharedQuizAdminAction("hide", { id });
}

export async function unhideSharedQuizAsAdmin(id: string) {
  await callSharedQuizAdminAction("unhide", { id });
}
