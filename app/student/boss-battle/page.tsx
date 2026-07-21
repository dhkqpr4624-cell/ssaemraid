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
  subscribeBossBattleRoom,
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
  const pollInFlight = useRef(false);
  const answerHydratedRound = useRef<number | null>(null);
  const pollNowRef = useRef<() => void>(() => {});
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
    if (session?.avatarCustomizationEnabled === false) setAvatarOpen(false);
  }, [session?.avatarCustomizationEnabled]);
  useEffect(() => {
    pollSequence.current += 1;
    answerHydratedRound.current = null;
    setSubmitted(false);
    setCurrentAnswer(undefined);
  }, [session?.currentRound]);
  useEffect(() => {
    if (!session || !saved || !me) return;
    const beat = () =>
      heartbeatBossParticipant(code, session.id, saved.joinOrder, me.id);
    const poll = async () => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      const requestId = ++pollSequence.current;
      try {
      const latest = await getBossBattleSession(code);
      if (requestId !== pollSequence.current) return;
      if (!latest) {
        router.replace(`/student?code=${code}`);
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
      if (answerHydratedRound.current !== latest.currentRound) {
        const ans = await getBossAnswers(code, latest.id, latest.currentRound);
        if (requestId !== pollSequence.current) return;
        const mineAnswer = ans.find((a) => a.studentId === me.id && a.roundIndex === latest.currentRound);
        setCurrentAnswer(mineAnswer);
        setSubmitted(Boolean(mineAnswer));
        answerHydratedRound.current = latest.currentRound;
      }
      } finally {
        pollInFlight.current = false;
      }
    };
    pollNowRef.current = () => { void poll(); };
    beat();
    poll();
    const unsubscribe = subscribeBossBattleRoom(
      code,
      session.id,
      () => pollNowRef.current(),
      { participants: false, answers: false, guests: false },
    );
    // 40명이 한 번에 입장해도 주기 요청이 같은 밀리초에 몰리지 않도록
    // 브라우저마다 약간 다른 간격을 사용합니다.
    const h = setInterval(beat, 14000 + Math.floor(Math.random() * 3000)),
      // Realtime이 끊겼을 때를 위한 저빈도 안전망입니다.
      p = setInterval(poll, 3000 + Math.floor(Math.random() * 1200));
    return () => {
      unsubscribe();
      clearInterval(h);
      clearInterval(p);
    };
  }, [session?.id, me?.id]);
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;
    const refreshGuests = async () => {
      const guests = await listRaidGuests(code, true);
      if (!cancelled) setStudents(guests.map(raidGuestToStudent));
    };
    const unsubscribe = subscribeBossBattleRoom(
      code,
      undefined,
      () => { void refreshGuests(); },
      { participants: false, answers: false, guests: true },
    );
    return () => { cancelled = true; unsubscribe(); };
  }, [code, session?.id]);
  async function leave() {
    // 전투가 시작된 뒤에는 결과 기록 보존을 위해 참가자 행을 삭제하지 않습니다.
    // 새 방 생성 시 교사가 기존 참가자 데이터를 일괄 정리합니다.
    if (session && me && session.status === "waiting")
      await removeBossParticipant(code, session.id, me.id);
    router.push("/");
  }
  async function answer(a: any) {
    if (!session || !me || session.paused || submitted) return;
    const q =
      session.selectedQuestions.find(
        (x) => x.id === session.roundPlan[session.currentRound]?.questionId,
      ) || session.selectedQuestions[session.currentRound];
    try {
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
      pollNowRef.current();
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`답안을 전송하지 못했습니다.\n\n${message}\n\n인터넷 연결을 확인한 뒤 다시 제출해 주세요.`);
    }
  }
  async function rps(c: RpsChoice) {
    if (!session || !me || session.paused) return;
    try {
      await submitBossRps(code, session.id, session.currentRound, me.id, c);
      setCurrentAnswer((v) => (v ? { ...v, rpsChoice: c } : v));
      pollNowRef.current();
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`가위바위보 선택을 전송하지 못했습니다.\n\n${message}`);
    }
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
            <Button
              onClick={() => setAvatarOpen(true)}
              disabled={session?.avatarCustomizationEnabled === false}
              title={session?.avatarCustomizationEnabled === false ? "교사가 아바타 꾸미기를 비허용했습니다." : "아바타 꾸미기"}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            >
              <Palette className="mr-2 h-4 w-4"/>
              아바타 설정
            </Button>
            <Users />
            {joined.length}/40
            <BossWaitingRoomBgm role="student" />
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
      {avatarOpen && guest && session?.avatarCustomizationEnabled !== false && <AvatarModal guest={guest} onClose={()=>setAvatarOpen(false)} onSave={async g=>{await updateRaidGuest(g);saveRaidGuestSession(g);setGuest(g);setMe(raidGuestToStudent(g));setStudents((await listRaidGuests(code)).map(raidGuestToStudent));setAvatarOpen(false)}}/>}
    </main>
  );
}

function AvatarModal({guest,onClose,onSave}:{guest:RaidGuest;onClose:()=>void;onSave:(g:RaidGuest)=>void}){
 const [draft,setDraft]=useState<RaidGuest>({...guest,avatarState:{...guest.avatarState,equipped:{...guest.avatarState.equipped}}});
 const slots=["hair","eyes","eyebrow","mouth","face","top","bottom","shoes","hat","headAccessory","accessory","cape","pet"] as const;
 const labels:any={hair:"머리",eyes:"눈",eyebrow:"눈썹",mouth:"입",face:"얼굴장식",top:"상의",bottom:"하의",shoes:"신발",hat:"모자",headAccessory:"머리장식",accessory:"장신구",cape:"망토",pet:"펫"};
 const setColor=(k:string,v:string)=>setDraft(d=>({...d,avatarState:{...d.avatarState,[k]:v}}));
 return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/75 p-3">
  <div className="relative flex h-[min(760px,92dvh)] w-[min(960px,96vw)] flex-col overflow-hidden rounded-2xl border-2 border-amber-400 bg-slate-900 shadow-2xl">
   <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-950 px-5 py-3 pr-36">
    <h2 className="text-xl font-black">아바타 꾸미기</h2>
    <Button variant="ghost" onClick={onClose} className="absolute right-3 top-3"><X/></Button>
    <Button className="absolute right-14 top-3 bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={()=>onSave(draft)}>적용</Button>
   </div>
   <div className="grid min-h-0 flex-1 gap-4 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
    <div className="overflow-y-auto rounded-xl bg-slate-800 p-3">
     <div className="mx-auto h-[180px] w-[180px]"><AvatarRenderer avatarState={draft.avatarState} inventory={draft.items} size="sprite" facing="front" showAnimation={false} useSprite={true}/></div>
     <Button className="mt-2 w-full" onClick={()=>{const a=randomRaidAvatar();setDraft(d=>({...d,avatarState:a.state,items:a.items}))}}><Shuffle className="mr-2 h-4 w-4"/>전체 랜덤</Button>
     <div className="mt-3 space-y-2">{[["skinColor","피부색",RAID_AVATAR_COLORS.skin],["hairColor","머리색",RAID_AVATAR_COLORS.hair],["eyeColor","눈색",RAID_AVATAR_COLORS.eye]].map(([k,l,colors]:any)=><div key={k}><b className="text-xs">{l}</b><div className="mt-1 flex flex-wrap gap-1.5">{colors.map((c:string)=><button key={c} className="h-7 w-7 rounded-full border-2 border-white/50" style={{background:c}} onClick={()=>setColor(k,c)}/>)}</div></div>)}</div>
    </div>
    <div className="min-w-0 overflow-y-auto pr-2">{slots.map(slot=>{const items=RAID_AVATAR_ITEMS.filter(i=>i.slot===slot);if(!items.length)return null;return <section key={slot} className="mb-4"><h3 className="mb-2 font-bold text-amber-300">{labels[slot]}</h3><div className="flex max-w-full gap-2 overflow-x-auto pb-2"><button className="h-16 min-w-16 rounded border border-slate-600" onClick={()=>setDraft(d=>({...d,avatarState:{...d.avatarState,equipped:{...d.avatarState.equipped,[slot]:null}}}))}>없음</button>{items.map(i=><button title={i.name} key={i.id} className={`h-16 min-w-16 rounded border p-1 ${draft.avatarState.equipped[slot]===i.id?'border-amber-400 bg-amber-950':'border-slate-600 bg-slate-800'}`} onClick={()=>setDraft(d=>({...d,avatarState:{...d.avatarState,equipped:{...d.avatarState.equipped,[slot]:i.id}}}))}>{i.iconUrl?<img src={i.iconUrl} className="h-full w-full object-contain"/>:<span>{i.icon||"?"}</span>}</button>)}</div></section>})}</div>
   </div>
  </div>
 </div>
}
