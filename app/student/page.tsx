'use client';
import {Suspense, useEffect, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {getBossBattleSession} from '@/lib/boss-battle';
import {createRaidGuest,findRaidGuestByNickname,saveRaidGuestSession} from '@/lib/raid-guests';
import {normalizeRaidRoomCode} from '@/lib/supabase-shards';
import {randomRaidAvatar} from '@/lib/raid-avatar';
import {SupabaseShardBadge} from '@/components/debug/SupabaseShardBadge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

function formatCodeInput(value:string){
  const raw=value.toUpperCase().replace(/[^A-Z0-9-]/g,'');
  const compact=raw.replace(/-/g,'');
  if(/^[ABC]/.test(compact)) return `${compact.slice(0,1)}${compact.length>1?'-':''}${compact.slice(1,6)}`;
  return compact.slice(0,6);
}
function isValidCode(value:string){
  const normalized=normalizeRaidRoomCode(value);
  return /^[ABC]-[A-Z2-9]{5}$/.test(normalized)||/^[A-Z0-9]{6}$/.test(normalized);
}

function StudentJoinContent(){
  const r=useRouter(),sp=useSearchParams();
  const qrCode=normalizeRaidRoomCode(sp.get('code')||'');
  const [step,setStep]=useState(qrCode?2:1),[code,setCode]=useState(qrCode),[nickname,setNickname]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!qrCode)return;getBossBattleSession(qrCode).then(s=>{if(!s||s.status==='ended'){setError('방 코드를 확인해주세요. 아직 방이 만들어지지 않았거나 종료된 방입니다.');setStep(1)}}).catch(()=>{setError('해당 서버에 연결하지 못했습니다. 방 코드와 서버 환경 변수를 확인해주세요.');setStep(1)})},[qrCode]);
  async function check(){
    const normalized=normalizeRaidRoomCode(code);
    setBusy(true);setError('');
    try{const s=await getBossBattleSession(normalized);if(!s||s.status==='ended'){setError('방 코드를 확인해주세요. 아직 방이 만들어지지 않았거나 종료된 방입니다.');return;}setCode(normalized);setStep(2)}
    catch(e:any){setError(e?.message||'해당 서버에 연결하지 못했습니다.')}
    finally{setBusy(false)}
  }
  async function join(){if(!nickname.trim()){setError('닉네임을 입력해주세요.');return}setBusy(true);try{const normalized=normalizeRaidRoomCode(code);const existing=await findRaidGuestByNickname(normalized,nickname);let g=existing;if(!g){const a=randomRaidAvatar();g=await createRaidGuest(normalized,nickname,a.state,a.items);}saveRaidGuestSession(g);r.push(`/student/boss-battle?code=${encodeURIComponent(normalized)}`)}catch(e:any){setError(e.message||'입장하지 못했습니다.')}finally{setBusy(false)}}
  return <main className="min-h-screen bg-slate-950 p-6 text-white flex items-center justify-center"><SupabaseShardBadge roomCode={code}/><div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl"><img src="/school-raid-logo.png" className="mx-auto mb-4 h-32 object-contain"/><h1 className="mb-5 text-center text-2xl font-black">{step===1?'방 코드 입력':'닉네임 설정'}</h1>{step===1?<><Input value={code} onChange={e=>setCode(formatCodeInput(e.target.value))} placeholder="예: A-2BCDE" className="h-14 text-center text-2xl font-black tracking-[.18em] text-white placeholder:text-slate-300 bg-slate-800 border-slate-600"/><p className="mt-2 text-center text-xs text-slate-400">새 방 코드는 A/B/C로 시작하며 서버가 자동 선택됩니다.</p><Button disabled={busy||!isValidCode(code)} onClick={check} className="mt-4 w-full py-6 text-lg">입장</Button></>:<><Input value={nickname} onChange={e=>setNickname(e.target.value.slice(0,12))} placeholder="닉네임" className="h-14 text-center text-xl text-white placeholder:text-slate-300 bg-slate-800 border-slate-600"/><Button disabled={busy} onClick={join} className="mt-4 w-full py-6 text-lg">입장</Button></>}{error&&<p className="mt-4 text-center text-sm text-red-400">{error}</p>}</div></main>
}
export default function StudentJoin(){return <Suspense fallback={<main className="min-h-screen bg-slate-950"/>}><StudentJoinContent/></Suspense>}
