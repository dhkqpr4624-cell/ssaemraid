'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {BOSS_CATALOG} from '@/lib/boss-catalog';
import {getConfiguredShardSummary, requestLeastLoadedRoomCode} from '@/lib/supabase-shards';
import {Button} from '@/components/ui/button';

export default function TeacherStart(){
  const r=useRouter();
  const [selected,setSelected]=useState(BOSS_CATALOG.find(x=>x.enabled)?.id||'');
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState('');
  const shards=getConfiguredShardSummary();
  const available=shards.filter(x=>x.configured).length;
  return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-5xl"><img src="/school-raid-logo.png" className="mx-auto h-40 object-contain"/><h1 className="mb-5 text-2xl font-black">보스전 선택</h1><div className="mb-4 rounded-xl border border-cyan-700/70 bg-cyan-950/30 p-3 text-sm text-cyan-100"><b>서버 분산 상태:</b> {available}/3개 연결됨 · 새 방은 연결된 서버 중 하나에 자동 배정됩니다.</div><div className="grid gap-4 md:grid-cols-2">{BOSS_CATALOG.map(b=><button key={b.id} disabled={!b.enabled} onClick={()=>setSelected(b.id)} className={`rounded-xl border-2 p-5 text-left ${selected===b.id?'border-lime-400 bg-lime-950':'border-slate-700 bg-slate-900'} disabled:opacity-40`}><b>{b.grade}학년 {b.semester}학기 {b.unit}단원 마무리 문제</b><div className="mt-2 text-sm text-slate-300">{b.enabled?b.name:'준비중'}</div></button>)}</div>{error&&<div className="mt-4 rounded-lg border border-red-500/60 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}<Button disabled={creating||!selected} className="mt-6 w-full bg-lime-500 py-6 text-lg font-black text-slate-950" onClick={async()=>{if(creating)return;setCreating(true);setError('');try{const {roomCode}=await requestLeastLoadedRoomCode();r.push(`/teacher/boss-battle?code=${encodeURIComponent(roomCode)}&bossId=${selected}`);}catch(e){setError(e instanceof Error?e.message:'서버 선택에 실패했습니다.');setCreating(false);}}}>{creating?'가장 여유 있는 서버를 찾는 중...':'선택하고 입장'}</Button></div></main>
}
