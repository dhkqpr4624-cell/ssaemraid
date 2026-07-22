import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const base=(process.env.SSAEMQUEST_URL||"").replace(/\/$/,""); const secret=process.env.SCHOOLRAID_REWARD_SECRET||"";
  if(!base||!secret)return NextResponse.json({error:"쌤퀘스트 연동 환경 변수가 필요합니다."},{status:500});
  const body=await req.json().catch(()=>({}));
  if(!["defeated","escaped"].includes(body.outcome))return NextResponse.json({error:"이 결과에는 보상이 없습니다."},{status:400});
  const response=await fetch(`${base}/api/raid-rewards`,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-schoolraid-secret":secret},body:JSON.stringify({action:"issue",outcome:body.outcome,sourceKey:body.sourceKey})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)return NextResponse.json({error:result.error||"보상 코드를 만들지 못했습니다."},{status:response.status});
  return NextResponse.json({...result,claimUrl:`${base}/student/raid-reward?code=${encodeURIComponent(result.reward.code)}`});
}
