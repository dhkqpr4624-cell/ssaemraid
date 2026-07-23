import { NextRequest, NextResponse } from "next/server";
const config = () => ({ base: (process.env.SSAEMQUEST_URL || "").replace(/\/$/, ""), secret: process.env.SCHOOLRAID_REWARD_SECRET || "" });
export async function GET(req: NextRequest) {
  const { base, secret } = config();
  const token = req.nextUrl.searchParams.get("token") || "";
  const studentId = req.nextUrl.searchParams.get("studentId") || "";
  if (!base || !secret) return NextResponse.json({ error: "쌤퀘스트 연동 환경 변수가 필요합니다." }, { status: 500 });
  const response = await fetch(`${base}/api/schoolraid-links?token=${encodeURIComponent(token)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ""}`, { cache: "no-store", headers: { "x-schoolraid-secret": secret } });
  const result = await response.json().catch(()=>({ error: "연동 응답 오류" }));
  return NextResponse.json({ ...result, ssaemquestUrl: base }, { status: response.status });
}
export async function PATCH(req: NextRequest) {
  const { base, secret } = config();
  const body = await req.json().catch(()=>({}));
  if (!base || !secret) return NextResponse.json({ error: "쌤퀘스트 연동 환경 변수가 필요합니다." }, { status: 500 });
  const response = await fetch(`${base}/api/schoolraid-links`, { method: "PATCH", headers: { "content-type": "application/json", "x-schoolraid-secret": secret }, body: JSON.stringify(body) });
  return NextResponse.json(await response.json().catch(()=>({ error: "연동 응답 오류" })), { status: response.status });
}

export async function POST(req: NextRequest) {
  const { base, secret } = config();
  const body = await req.json().catch(() => ({}));
  if (!base || !secret)
    return NextResponse.json(
      { error: "쌤퀘스트 연동 환경 변수가 필요합니다." },
      { status: 500 },
    );

  const outcome =
    body.outcome === "defeated"
      ? "defeated"
      : body.outcome === "escaped"
        ? "escaped"
        : "";
  const sourceKey = String(body.sourceKey || "").slice(0, 200);
  if (!outcome || !sourceKey)
    return NextResponse.json(
      { error: "보상을 발급할 수 없는 전투 결과입니다." },
      { status: 400 },
    );

  const response = await fetch(`${base}/api/raid-rewards`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-schoolraid-secret": secret,
    },
    // roomCode는 전달하지 않습니다. 학생에게 자동 지급하지 않고 교사가
    // 보여 주는 QR/보상 코드를 통해서만 수령하게 하기 위함입니다.
    body: JSON.stringify({ action: "issue", outcome, sourceKey }),
  });
  const result = await response
    .json()
    .catch(() => ({ error: "보상 발급 응답 오류" }));
  return NextResponse.json(
    { ...result, ssaemquestUrl: base },
    { status: response.status },
  );
}
