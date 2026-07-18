import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getConfiguredAdminPassword() {
  return (
    process.env.SHARED_QUIZ_ADMIN_PASSWORD ||
    process.env.NEXT_PUBLIC_SHARED_QUIZ_ADMIN_PASSWORD ||
    ""
  );
}

function buildUpdatedQuizData(input: any) {
  const quizData = input.quizData || {};
  const questions = Array.isArray(quizData.questions) ? quizData.questions : [];
  const totalScore = questions.reduce(
    (sum: number, q: any) => sum + Number(q?.points || 0),
    0,
  );
  return {
    quizData: {
      ...quizData,
      metadata: {
        ...(quizData.metadata || {}),
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
    },
    questionCount: questions.length,
    totalScore,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const configured = getConfiguredAdminPassword();
    if (!configured || body.password !== configured) {
      return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const supabase = getAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다." },
        { status: 500 },
      );
    }

    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "퀴즈 ID가 없습니다." }, { status: 400 });

    if (body.action === "delete") {
      const { error } = await supabase.from("shared_quizzes").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "hide" || body.action === "unhide") {
      const patch =
        body.action === "hide"
          ? { is_hidden: true }
          : { is_hidden: false, report_count: 0 };
      const { error } = await supabase.from("shared_quizzes").update(patch).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update") {
      const { quizData, questionCount, totalScore } = buildUpdatedQuizData(body);
      const { error } = await supabase
        .from("shared_quizzes")
        .update({
          title: body.title,
          description: body.description || "",
          author_name: body.authorName || null,
          grade: body.grade,
          semester: body.semester,
          subject: body.subject,
          unit: body.unit,
          thumbnail_url: body.thumbnailUrl || null,
          question_count: questionCount,
          total_score: totalScore,
          quiz_data: quizData,
        })
        .eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "알 수 없는 관리자 작업입니다." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "관리자 작업 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
