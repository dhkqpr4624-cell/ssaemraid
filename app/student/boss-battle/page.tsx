"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Palette, X, Shuffle } from "lucide-react";
import { BossWaitingParticipant } from "@/components/boss-battle/BossWaitingParticipant";
import { BossWaitingRoomBgm } from "@/components/boss-battle/BossWaitingRoomBgm";
import { BossBattleArena } from "@/components/boss-battle/BossBattleArena";
import { getRaidGuestSession, listRaidGuests, raidGuestToStudent, updateRaidGuest, saveRaidGuestSession, type RaidGuest } from "@/lib/raid-guests";
import { RAID_AVATAR_ITEMS, RAID_AVATAR_COLORS, randomRaidAvatar } from "@/lib/raid-avatar";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import type { Student } from "@/lib/types";
import { getBossById } from "@/lib/boss-catalog";
import {
  getBossAnswers,
  getBossBattleSession,
  getBossParticipants,
  heartbeatBossParticipant,
  isBossAnswerCorrect,
  isNewerBossSession,
  removeBossParticipant,
  submitBossAnswer,
  submitBossRps,
  updateBossParticipantState,
  type BossBattleAnswer,
  type BossBattleParticipant,
  type BossBattleSession,
  type RpsChoice,
} from "@/lib/boss-battle";
export default function StudentBossBattlePage() {
  const sp = useSearchParams(),
    router = useRouter(),
    saved = getRaidGuestSession(),
    code = (sp.get("code") || saved?.roomCode || "").toUpperCase();
  const [session, setSession] = useState<BossBattleSession | null>(null),
    [me, setMe] = useState<Student | null>(null),
    [students, setStudents] = useState<Student[]>([]),
    [guest, setGuest] = useState<RaidGuest | null>(saved),
    [avatarOpen, setAvatarOpen] = useState(false),
    [participants, setParticipants] = useState<BossBattleParticipant[]>([]),
    [submitted, setSubmitted] = useState(false),
    [currentAnswer, setCurrentAnswer] = useState<
      BossBattleAnswer | undefined
    >(),
    [error, setError] = useState("");
  const pollSequence = useRef(0);
  useEffect(() => {
    if (!saved || !code) {
      router.replace("/student");
      return;
    }
    Promise.all([getBossBattleSession(code), listRaidGuests(code)]).then(async ([ss, guests]) => {
      if (!ss) { setError("현재 열린 보스전이 없습니다."); return; }
      const current = guests.find(g => g.id === saved.id) || saved;
      const mine = raidGuestToStudent(current);
      setGuest(current); setSession(ss); setMe(mine); setStudents(guests.map(raidGuestToStudent));
      await heartbeatBossParticipant(code, ss.id, current.joinOrder, current.id);
    });
  }, [code]);
  useEffect(() => {
    pollSequence.current += 1;
    setSubmitted(false);
    setCurrentAnswer(undefined);
  }, [session?.currentRound]);
  useEffect(() => {
    if (!session || !saved || !me) return;
    const beat = () =>
      heartbeatBossParticipant(code, session.id, saved.joinOrder, me.id);
    const poll = async () => {
      const requestId = ++pollSequence.current;
      const latest = await getBossBattleSession(code);
      if (requestId !== pollSequence.current) return;
      if (!latest) {
        setError("보스전이 종료되었습니다.");
        return;
      }
      if (latest.status === "reward_ready") {
        const outcome = latest.bossHp <= 0 ? "defeated" : latest.rewardGranted ? "escaped" : "wiped";
        router.replace(`/student/boss-battle/reward?code=${code}&outcome=${outcome}`);
        return;
      }
      setSession((prev) => isNewerBossSession(prev, latest) ? latest : prev);
      let latestParticipants = await getBossParticipants(code, latest.id, true);
      // 브라우저 탭이 백그라운드여도 방어 실패 피해가 누락되지 않도록
      // 각 학생 클라이언트가 자신의 미적용 피해를 멱등적으로 확정한다.
      const phaseEnded = latest.phaseEndsAt && Date.now() >= new Date(latest.phaseEndsAt).getTime();
      const myParticipant = latestParticipants.find((p) => p.studentId === me.id);
      if (
        phaseEnded &&
        (latest.status === "boss_attack" || latest.status === "student_hit") &&
        myParticipant?.state.lastResult === "pending_hit" &&
        !myParticipant.state.knockedOut
      ) {
        const damage = Math.max(0, myParticipant.state.lastDamage || 0);
        const hp = Math.max(0, myParticipant.state.hp - damage);
        await updateBossParticipantState(code, latest.id, me.id, {
          hp,
          knockedOut: hp <= 0,
          lastResult: "hit",
        });
        latestParticipants = await getBossParticipants(code, latest.id, true);
      }
      setParticipants(latestParticipants);
      const guests = await listRaidGuests(code);
      setStudents(guests.map(raidGuestToStudent));
      const ans = await getBossAnswers(code, latest.id, latest.currentRound);
      if (requestId !== pollSequence.current) return;
      const mineAnswer = ans.find((a) => a.studentId === me.id && a.roundIndex === latest.currentRound);
      setCurrentAnswer(mineAnswer);
      setSubmitted(Boolean(mineAnswer));
    };
    beat();
    poll();
    const h = setInterval(beat, 8000),
      p = setInterval(poll, 700);
    return () => {
      clearInterval(h);
      clearInterval(p);
    };
  }, [session?.id, me?.id]);
  async function leave() {
    if (session && me) await removeBossParticipant(code, session.id, me.id);
    router.push("/");
  }
  async function answer(a: any) {
    if (!session || !me) return;
    const q =
      session.selectedQuestions.find(
        (x) => x.id === session.roundPlan[session.currentRound]?.questionId,
      ) || session.selectedQuestions[session.currentRound];
    await submitBossAnswer(
      code,
      session.id,
      session.currentRound,
      me.id,
      String(me.attendanceNumber),
      a,
      isBossAnswerCorrect(q, a),
    );
    setSubmitted(true);
  }
  async function rps(c: RpsChoice) {
    if (!session || !me) return;
    await submitBossRps(code, session.id, session.currentRound, me.id, c);
    setCurrentAnswer((v) => (v ? { ...v, rpsChoice: c } : v));
  }
  const selectedBoss = getBossById(session?.bossId),
    joined = participants
      .map((p) => students.find((s) => s.id === p.studentId))
      .filter(Boolean) as Student[],
    mine = participants.find((p) => p.studentId === me?.id);
  if (error)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div>
          <p>{error}</p>
          <Button onClick={() => router.push("/")}>
            처음으로
          </Button>
        </div>
      </main>
    );
  if (session && session.status !== "waiting")
    return (
      <BossBattleArena
        session={session}
        me={me}
        participant={mine}
        submitted={submitted}
        currentAnswer={currentAnswer}
        onAnswer={answer}
        onRps={rps}
        teacherStudents={joined}
        teacherParticipants={participants}
        onExit={() => router.push("/")}
      />
    );
  return (
    <main className="min-h-screen bg-slate-950 p-3 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-3 flex items-center justify-between">
          <Button className="bg-white text-black" onClick={leave}>
            <ArrowLeft className="mr-2" />
            나가기
          </Button>
          <b>
            {selectedBoss.grade}학년 {selectedBoss.semester}학기{" "}
            {selectedBoss.unit}단원 마무리 문제
          </b>
          <div className="flex items-center gap-3">
            <Button onClick={()=>setAvatarOpen(true)} className="bg-amber-500 text-slate-950 hover:bg-amber-400"><Palette className="mr-2 h-4 w-4"/>아바타 설정</Button>
            <Users />
            {joined.length}/40
            <BossWaitingRoomBgm />
          </div>
        </div>
        <section
          className="relative min-h-[650px] overflow-hidden rounded-xl border-4 border-amber-400 bg-cover"
          style={{ backgroundImage: "url('/boss-battle/waiting-room.png')" }}
        >
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-xl bg-black/70 px-6 py-3 text-center">
            <b>교사가 게임을 시작할 때까지 기다려주세요</b>
            <div>
              문제 {session?.questionCount}개 · 문제당{" "}
              {session?.timeLimitSeconds}초
            </div>
          </div>
          <div className="absolute bottom-[calc(4%+60px)] left-[2%] right-[2%] flex h-[58%] items-start justify-center overflow-hidden">
            {(() => {
              const sorted = [...joined].sort((a,b)=>Number(a.attendanceNumber)-Number(b.attendanceNumber));
              const rows = [sorted.slice(0,6)];
              for (let i=6;i<sorted.length;i+=9) rows.push(sorted.slice(i,i+9));
              const scale = joined.length <= 4 ? 1 : joined.length === 5 ? 0.9 : 0.82;
              return <div className="flex max-w-full flex-col items-center gap-1">
                {rows.map((row,ri)=><div key={ri} className="flex justify-center gap-1">
                  {row.map((s)=><div key={s.id} className="relative"><BossWaitingParticipant
                    student={s}
                    label={me?.id === s.id ? "나" : s.nickname}
                    isSelf={me?.id === s.id}
                    scale={scale}
                   /></div>)}
                </div>)}
              </div>;
            })()}
          </div>
        </section>
      </div>
      {avatarOpen && guest && <AvatarModal guest={guest} onClose={()=>setAvatarOpen(false)} onSave={async g=>{await updateRaidGuest(g);saveRaidGuestSession(g);setGuest(g);setMe(raidGuestToStudent(g));setStudents((await listRaidGuests(code)).map(raidGuestToStudent));setAvatarOpen(false)}}/>}
    </main>
  );
}

function AvatarModal({guest,onClose,onSave}:{guest:RaidGuest;onClose:()=>void;onSave:(g:RaidGuest)=>void}){
 const [draft,setDraft]=useState<RaidGuest>({...guest,avatarState:{...guest.avatarState,equipped:{...guest.avatarState.equipped}}});
 const slots=["hair","eyes","eyebrow","mouth","face","top","bottom","shoes","hat","headAccessory","accessory","cape","pet"] as const;
 const labels:any={hair:"머리",eyes:"눈",eyebrow:"눈썹",mouth:"입",face:"얼굴장식",top:"상의",bottom:"하의",shoes:"신발",hat:"모자",headAccessory:"머리장식",accessory:"장신구",cape:"망토",pet:"펫"};
 const setColor=(k:string,v:string)=>setDraft(d=>({...d,avatarState:{...d.avatarState,[k]:v}}));
 return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/75 p-4"><div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border-2 border-amber-400 bg-slate-900 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">아바타 꾸미기</h2><Button variant="ghost" onClick={onClose}><X/></Button></div><div className="grid gap-6 md:grid-cols-[260px_1fr]"><div className="rounded-xl bg-slate-800 p-4"><div className="mx-auto h-[220px] w-[220px]"><AvatarRenderer avatarState={draft.avatarState} inventory={draft.items} size="sprite" facing="front" showAnimation={false} useSprite={true}/></div><Button className="mt-3 w-full" onClick={()=>{const a=randomRaidAvatar();setDraft(d=>({...d,avatarState:a.state,items:a.items}))}}><Shuffle className="mr-2 h-4 w-4"/>전체 랜덤</Button><div className="mt-4 space-y-3">{[["skinColor","피부색",RAID_AVATAR_COLORS.skin],["hairColor","머리색",RAID_AVATAR_COLORS.hair],["eyeColor","눈색",RAID_AVATAR_COLORS.eye]].map(([k,l,colors]:any)=><div key={k}><b className="text-sm">{l}</b><div className="mt-1 flex flex-wrap gap-2">{colors.map((c:string)=><button key={c} className="h-8 w-8 rounded-full border-2 border-white/50" style={{background:c}} onClick={()=>setColor(k,c)}/>)}</div></div>)}</div></div><div className="space-y-5">{slots.map(slot=>{const items=RAID_AVATAR_ITEMS.filter(i=>i.slot===slot);if(!items.length)return null;return <div key={slot}><h3 className="mb-2 font-bold text-amber-300">{labels[slot]}</h3><div className="flex gap-2 overflow-x-auto pb-2"><button className="h-20 min-w-20 rounded border border-slate-600" onClick={()=>setDraft(d=>({...d,avatarState:{...d.avatarState,equipped:{...d.avatarState.equipped,[slot]:null}}}))}>없음</button>{items.map(i=><button title={i.name} key={i.id} className={`h-20 min-w-20 rounded border p-1 ${draft.avatarState.equipped[slot]===i.id?'border-amber-400 bg-amber-950':'border-slate-600 bg-slate-800'}`} onClick={()=>setDraft(d=>({...d,avatarState:{...d.avatarState,equipped:{...d.avatarState.equipped,[slot]:i.id}}}))}>{i.iconUrl?<img src={i.iconUrl} className="h-full w-full object-contain"/>:<span>{i.icon||"?"}</span>}</button>)}</div></div>})}</div></div><div className="mt-5 flex justify-end gap-3"><Button variant="outline" onClick={onClose}>취소</Button><Button className="bg-amber-500 text-slate-950" onClick={()=>onSave(draft)}>적용</Button></div></div></div>
}
