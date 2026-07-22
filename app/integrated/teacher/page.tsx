"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HAETAE_PREPARED_QUESTIONS } from "@/lib/boss-prepared-quizzes";
import { buildRoundPlan, calculateBossMaxHp, saveBossBattleSession } from "@/lib/boss-battle";
import { requestLeastLoadedRoomCode } from "@/lib/supabase-shards";

function IntegratedTeacherContent(){
  const sp=useSearchParams(),router=useRouter(),token=sp.get("token")||"",started=useRef(false),[message,setMessage]=useState("연동 정보를 확인하는 중…"),[error,setError]=useState("");
  useEffect(()=>{if(!token||started.current)return;started.current=true;(async()=>{try{
    const linkResponse=await fetch(`/api/ssaemquest-link?token=${encodeURIComponent(token)}`,{cache:"no-store"});const payload=await linkResponse.json();if(!linkResponse.ok)throw new Error(payload.error||"연동 정보를 불러오지 못했습니다.");
    setMessage("가장 여유 있는 서버를 탐색하는 중…");const {roomCode}=await requestLeastLoadedRoomCode();const settings=payload.link.settings||{};const selectedIds=new Set(settings.questionIds||[]);const pool=selectedIds.size?HAETAE_PREPARED_QUESTIONS.filter(q=>selectedIds.has(q.id)):HAETAE_PREPARED_QUESTIONS;const questions=[...pool].slice(0,Math.max(1,Math.min(Number(settings.questionCount)||10,pool.length)));const plan=buildRoundPlan(questions);const hp=calculateBossMaxHp(20,Math.max(1,plan.filter(x=>x.kind==="attack").length));
    setMessage("협동전 방을 만드는 중…");await saveBossBattleSession(roomCode,{status:"waiting",bossId:payload.link.boss_id||"corrupted-haetae",bossName:"타락한 해태",questionCount:questions.length,timeLimitSeconds:Math.max(5,Math.min(180,Number(settings.timeLimitSeconds)||20)),selectedQuestions:questions,roundPlan:plan,currentRound:0,bossMaxHp:hp,bossHp:hp,victoryRewardItemId:"g5-s1-social-u3-pet-law-judge-haetae",escapeRewardItemId:"g5-s1-social-u3-face-haetae-tear"});
    const notify=await fetch("/api/ssaemquest-link",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({token,roomCode,status:"waiting"})});if(!notify.ok)throw new Error("쌤퀘스트에 방 정보를 저장하지 못했습니다.");router.replace(`/teacher/boss-battle?code=${encodeURIComponent(roomCode)}&bossId=${encodeURIComponent(payload.link.boss_id||"corrupted-haetae")}`);
  }catch(e){setError(e instanceof Error?e.message:"협동전 방을 만들지 못했습니다.");}})()},[token]);
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><div className="w-full max-w-lg rounded-2xl border border-cyan-500 bg-slate-900 p-8 text-center"><img src="/school-raid-logo.png" className="mx-auto mb-5 h-32 object-contain"/>{error?<><h1 className="text-2xl font-black text-red-300">연동에 실패했습니다</h1><p className="mt-3">{error}</p></>:<><div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent"/><h1 className="text-xl font-black">{message}</h1><p className="mt-2 text-sm text-slate-300">잠시만 기다려주세요.</p></>}</div></main>
}
export default function IntegratedTeacher(){return <Suspense><IntegratedTeacherContent/></Suspense>}
