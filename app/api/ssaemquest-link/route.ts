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
