"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { Button } from "@/components/ui/button";
import type { Student } from "@/lib/types";
import type {
  BossAttackKind,
  BossBattleAnswer,
  BossBattleParticipant,
  BossBattleSession,
  RpsChoice,
} from "@/lib/boss-battle";
import { currentBossQuestion, rpsMultiplier, REVIVE_REQUIRED_QUESTIONS } from "@/lib/boss-battle";
import { BossSprite } from "./BossSprite";
import { SpriteEffect } from "./SpriteEffect";
import { BossQuestionPanel } from "./BossQuestionPanel";
import { BossBattleBgm } from "./BossBattleBgm";
import { Bug, Shield, Skull, Sword, Pause, PlayCircle, QrCode, Gift, X } from "lucide-react";
import { applyBossMute, BOSS_MUTE_EVENT, getBossMuted, type BossAudioRole } from "@/lib/boss-audio";
const attackAsset = (a?: BossAttackKind) =>
  a === "claw2"
    ? { src: "/boss-battle/claw2.png", cols: 2, rows: 3 }
    : a === "lightning"
      ? { src: "/boss-battle/lightning.png", cols: 8, rows: 1 }
      : { src: "/boss-battle/claw1.png", cols: 2, rows: 3 };
const choices: RpsChoice[] = ["rock", "paper", "scissors"];
const label = (c: RpsChoice) =>
  c === "rock" ? "바위" : c === "paper" ? "보" : "가위";
export function BossBattleArena({
  session,
  me,
  participant,
  isTeacher = false,
  submitted = false,
  currentAnswer,
  onAnswer,
  onRps,
  onDebug,
  onEntranceEnded,
  teacherStudents = [],
  teacherParticipants = [],
  onExit,
  onFinish,
  onPause,
  onShowQr,
}: {
  session: BossBattleSession;
  me?: Student | null;
  participant?: BossBattleParticipant;
  isTeacher?: boolean;
  submitted?: boolean;
  currentAnswer?: BossBattleAnswer;
  onAnswer?: (a: any) => void;
  onRps?: (c: RpsChoice) => void;
  onDebug?: (e: string) => void;
  onEntranceEnded?: () => void;
  teacherStudents?: Student[];
  teacherParticipants?: BossBattleParticipant[];
  onExit?: () => void;
  onFinish?: () => void;
  onPause?: () => void;
  onShowQr?: () => void;
}) {
  const q = currentBossQuestion(session),
    plan = session.roundPlan?.[session.currentRound];
  const [now, setNow] = useState(Date.now()),
    [debug, setDebug] = useState(false),
    [showRanking, setShowRanking] = useState(false),
    [muted, setMuted] = useState(false),
    [audioUnlocked, setAudioUnlocked] = useState(false),
    [rewardOpen, setRewardOpen] = useState(false),
    [rewardBusy, setRewardBusy] = useState(false),
    [rewardInfo, setRewardInfo] = useState<any>(null),
    [rewardError, setRewardError] = useState(""),
    [linkedRewardArrived, setLinkedRewardArrived] = useState(false),
    [tabletStageScale, setTabletStageScale] = useState<number | null>(null);
  async function openSsaemquestReward() {
    setRewardOpen(true); setRewardError(""); if(rewardInfo)return; setRewardBusy(true);
    try { const response=await fetch("/api/ssaemquest-reward",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({outcome:session.status,sourceKey:`${session.id}:${session.status}`,roomCode:session.classCode})}); const result=await response.json(); if(!response.ok)throw new Error(result.error||"보상을 보내지 못했습니다."); setRewardInfo(result); }
    catch(error:any){setRewardError(error.message||"보상 코드를 만들지 못했습니다.");} finally{setRewardBusy(false);}
  }
  useEffect(() => {
    if (isTeacher || typeof window === "undefined") return;
    const token = sessionStorage.getItem("ssaemquest-schoolraid-token");
    if (!token) return;
    const check = async () => {
      const response = await fetch(`/api/ssaemquest-link?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (data?.link?.status === "rewarded") setLinkedRewardArrived(true);
    };
    void check();
    const timer = window.setInterval(check, 5000);
    return () => window.clearInterval(timer);
  }, [isTeacher]);
  useEffect(() => {
    if (isTeacher) {
      setTabletStageScale(null);
      return;
    }
    const updateStageScale = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const landscape = window.matchMedia("(orientation: landscape)").matches;
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      const tablet = coarse && landscape && width <= 1600;
      if (!tablet) {
        setTabletStageScale(null);
        return;
      }
      // PC 학생 전투 화면의 1500x864 디자인 좌표계를 통째로 등비 축소합니다.
      setTabletStageScale(Math.min(width / 1500, height / 864));
    };
    updateStageScale();
    window.addEventListener("resize", updateStageScale);
    window.visualViewport?.addEventListener("resize", updateStageScale);
    return () => {
      window.removeEventListener("resize", updateStageScale);
      window.visualViewport?.removeEventListener("resize", updateStageScale);
    };
  }, [isTeacher]);

  const audioRole: BossAudioRole = isTeacher ? "teacher" : "student";
  const hitAudio = useRef<HTMLAudioElement | null>(null),
    roarAudio = useRef<HTMLAudioElement | null>(null),
    lightningAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const t = setInterval(() => { if (!session.paused) setNow(Date.now()); }, 100);
    return () => clearInterval(t);
  }, [session.paused]);
  useEffect(() => {
    const syncMute = () => {
      const value = getBossMuted(audioRole);
      setMuted(value);
      if (hitAudio.current) hitAudio.current.muted = value;
      if (roarAudio.current) roarAudio.current.muted = value;
      if (lightningAudio.current) lightningAudio.current.muted = value;
    };
    syncMute();
    window.addEventListener(BOSS_MUTE_EVENT, syncMute);
    window.addEventListener("storage", syncMute);
    return () => {
      window.removeEventListener(BOSS_MUTE_EVENT, syncMute);
      window.removeEventListener("storage", syncMute);
    };
  }, [audioRole]);
  const unlockAudio = async () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor();
        if (ctx.state === "suspended") await ctx.resume();
        await ctx.close();
      }
      const probe = applyBossMute(new Audio("/boss-battle/hit.wav"), audioRole);
      probe.volume = 0.001;
      await probe.play();
      probe.pause();
      probe.currentTime = 0;
      setAudioUnlocked(true);
    } catch {
      setAudioUnlocked(false);
    }
  };
  useEffect(() => {
    if (isTeacher) return;
    const unlock = () => { void unlockAudio(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [isTeacher]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "a") setDebug((v) => !v);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  useEffect(() => {
    if (
      session.status === "player_attack" ||
      (session.status === "student_hit" &&
        participant?.state.lastResult === "hit")
    ) {
      hitAudio.current = applyBossMute(new Audio("/boss-battle/hit.wav"), audioRole);
      void hitAudio.current.play().catch(() => {});
    }
  }, [session.status, session.currentRound, participant?.state.lastResult]);
  useEffect(() => {
    if (!(
      session.status === "roar" ||
      (session.status === "boss_attack" && session.bossAttack === "lightning")
    ))
      return;
    roarAudio.current?.pause();
    const a = applyBossMute(new Audio("/boss-battle/roar.wav"), audioRole);
    a.volume = 0.25;
    roarAudio.current = a;
    void a.play().catch(() => {});
    return () => {
      a.pause();
      a.currentTime = 0;
    };
  }, [session.status, session.bossAttack, session.currentRound]);
  useEffect(() => {
    if (session.status !== "boss_attack" || session.bossAttack !== "lightning")
      return;
    lightningAudio.current?.pause();
    const a = applyBossMute(new Audio("/boss-battle/lightning.wav"), audioRole);
    a.volume = 0.72;
    lightningAudio.current = a;
    void a.play().catch(() => {});
    return () => {
      a.pause();
      a.currentTime = 0;
    };
  }, [session.status, session.bossAttack, session.currentRound]);
  const isResult = ["defeated", "escaped", "wiped", "result_ready"].includes(
    session.status,
  );
  const isCinematic =
    session.status === "defeated_transition" ||
    session.status === "escaped_transition";
  useEffect(() => {
    if (!isResult) return;
    const a = applyBossMute(
      new Audio(
        session.status === "wiped"
          ? "/boss-battle/wipe.wav"
          : "/boss-battle/result-fanfare.wav",
      ),
    );
    a.volume = 0.43;
    void a.play().catch(() => {});
    return () => {
      a.pause();
      a.currentTime = 0;
    };
  }, [isResult, session.status]);
  const snapshotParticipants = useMemo(
    () =>
      (session.resultSnapshot || []).map((entry) => ({
        sessionId: session.id,
        classCode: session.classCode,
        studentId: entry.studentId,
        attendanceNumber: entry.attendanceNumber,
        lastSeenAt: session.updatedAt,
        state: entry.state,
      })),
    [session.resultSnapshot, session.id, session.classCode, session.updatedAt],
  );
  const snapshotStudents = useMemo(
    () =>
      (session.resultSnapshot || []).map((entry) => ({
        id: entry.studentId,
        nickname: entry.nickname,
        attendanceNumber: entry.attendanceNumber,
        avatarState: entry.avatarState,
        items: entry.items || teacherStudents.find((student) => student.id === entry.studentId)?.items || [],
        classId: session.classCode,
        score: 0,
        coins: 0,
        avatarId: "raid-result",
        roomDecorations: [],
      })) as Student[],
    [session.resultSnapshot, teacherStudents, session.classCode],
  );
  const ranking = useMemo(
    () =>
      (isResult && snapshotParticipants.length ? snapshotParticipants : teacherParticipants)
        .slice()
        .sort(
          (a, b) =>
            b.state.totalDamage - a.state.totalDamage ||
            b.state.correctCount - a.state.correctCount,
        ),
    [isResult, snapshotParticipants, teacherParticipants],
  );
  const rankingStudents = isResult && snapshotStudents.length ? snapshotStudents : teacherStudents;
  const left = Math.max(
      0,
      session.phaseEndsAt ? new Date(session.phaseEndsAt).getTime() - now : 0,
    ),
    total = Math.max(
      1,
      session.status === "rps"
        ? 20000
        : session.status === "answer_reveal"
          ? 7000
          : session.status === "rps_reveal"
            ? 5000
            : session.status === "defense_reveal"
              ? 4000
              : session.timeLimitSeconds * 1000,
    ),
    pct = Math.max(0, Math.min(100, (left / total) * 100));
  const bossMode =
    session.status === "roar" ||
    (session.status === "boss_attack" && session.bossAttack === "lightning")
      ? "roar"
      : session.status === "player_attack" ||
          session.status === "defeated_transition"
        ? "hit"
        : session.status === "defeated"
          ? "defeated"
          : "idle";
  const dead = participant?.state.knockedOut,
    attack = attackAsset(session.bossAttack),
    correct = currentAnswer?.isCorrect === true,
    wrong = currentAnswer?.isCorrect === false,
    selectedRps = currentAnswer?.rpsChoice,
    bossRps = session.bossRpsChoice;
  const showHit =
      session.status === "student_hit" &&
      participant?.state.lastResult === "hit" &&
      !dead,
    showShield =
      (session.status === "defense_reveal" ||
        session.status === "boss_attack") &&
      correct &&
      !dead;
  const rpsResult =
    selectedRps && bossRps ? rpsMultiplier(selectedRps, bossRps) : null;
  const showTeacherDialogue =
    !isTeacher ||
    session.status === "question" ||
    session.status === "answer_reveal";
  const teacherScale =
    teacherStudents.length > 28
      ? 0.42
      : teacherStudents.length > 20
        ? 0.5
        : teacherStudents.length > 12
          ? 0.6
          : 0.72;
  const teacherCols = Math.min(
    10,
    Math.max(
      1,
      Math.ceil(Math.sqrt(Math.max(1, teacherStudents.length) * 2.4)),
    ),
  );
  return (
    <main
      className={`boss-arena ${isTeacher ? "boss-arena-teacher" : "boss-arena-student"} relative h-[100dvh] overflow-hidden bg-slate-950 text-white ${dead || session.paused ? "grayscale" : ""} ${session.paused ? "boss-paused" : ""}`}
    >
      {session.status === "entrance" && (
        <video
          src="/boss-battle/entrance.mp4"
          autoPlay
          playsInline
          preload="auto"
          muted
          onEnded={onEntranceEnded}
          className="absolute inset-0 z-50 h-full w-full bg-black object-contain"
        />
      )}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/boss-battle/battle-background.png')" }}
      />
      <div
        className={`boss-stage ${tabletStageScale !== null ? "boss-stage-tablet" : ""}`}
        style={
          tabletStageScale !== null
            ? {
                width: 1500,
                height: 864,
                transform: `translate(-50%, -50%) scale(${tabletStageScale})`,
              }
            : undefined
        }
      >
      <header className="relative z-30 flex h-12 items-center justify-between bg-slate-950/90 px-5">
        <div className="font-bold">5학년 1학기 3단원 마무리 문제</div>
        <div className="text-sm">
          {session.currentRound + 1} / {session.questionCount}
        </div>
        <div className="flex items-center gap-2">
          {isTeacher && <Button size="sm" onClick={onPause} className="bg-amber-500 text-black hover:bg-amber-400">{session.paused ? <PlayCircle className="mr-1 h-4 w-4"/> : <Pause className="mr-1 h-4 w-4"/>}{session.paused ? "재생" : "일시정지"}</Button>}
          {isTeacher && <Button size="sm" onClick={onShowQr} className="bg-white text-black hover:bg-slate-200"><QrCode className="mr-1 h-4 w-4"/>QR 코드</Button>}
          <BossBattleBgm role={audioRole} />
        </div>
      </header>
      <section className="relative z-10 mx-auto flex h-[calc(100dvh-48px)] max-w-[1500px] flex-col">
        <div className="relative min-h-0 flex-[58] overflow-hidden">
          {!isResult && !isCinematic && (
            <div className="absolute left-1/2 top-3 z-20 w-[70%] -translate-x-1/2">
              <div className="mb-1 flex justify-between text-sm font-bold">
                <span>타락한 해태</span>
                <span>
                  {Math.max(0, session.bossHp).toLocaleString()} /{" "}
                  {session.bossMaxHp.toLocaleString()}
                </span>
              </div>
              <div className="h-5 overflow-hidden rounded-full border-2 border-amber-300 bg-black/70">
                <div
                  className="h-full bg-gradient-to-r from-red-700 to-orange-400 transition-all"
                  style={{
                    width: `${Math.max(0, (session.bossHp / session.bossMaxHp) * 100)}%`,
                  }}
                />
              </div>
              {isTeacher &&
                session.bossNotice &&
                (!session.bossNoticeUntil ||
                  new Date(session.bossNoticeUntil).getTime() > now) && (
                  <div className="mt-2 text-center text-xl font-black text-amber-200 [text-shadow:0_2px_0_#000]">
                    {session.bossNotice}
                  </div>
                )}
            </div>
          )}
          {session.status !== "escaped" && (
            <div className="boss-sprite-layer pointer-events-none absolute inset-x-0 bottom-[-65px] flex justify-center">
              <div
                className={`boss-sprite-wrap relative shrink-0 ${session.status === "transition" ? "animate-[bossFade_.6s_ease-out_1]" : ""} ${isCinematic ? "animate-[bossSlowShake_3s_ease-in-out_1]" : ""}`}
              >
                <BossSprite mode={bossMode} />
              </div>
            </div>
          )}
          {(isTeacher || isResult) &&
            teacherStudents.length > 0 &&
            session.status !== "wiped" && (
              <div className="absolute inset-x-4 bottom-8 z-20 flex justify-between gap-[46%]">
                {[
                  teacherStudents.filter((_, i) => i % 2 === 0),
                  teacherStudents.filter((_, i) => i % 2 === 1),
                ].map((group, side) => (
                  <div
                    key={side}
                    className="grid w-[27%] grid-cols-3 content-end gap-x-1 gap-y-2"
                  >
                    {group.map((student) => {
                      const tp = teacherParticipants.find(
                        (p) => p.studentId === student.id,
                      );
                      const hp = tp?.state.hp ?? 100,
                        maxHp = tp?.state.maxHp ?? 100;
                      const defended =
                        tp?.state.lastResult === "correct" &&
                        plan?.kind === "defense";
                      const scale =
                        teacherStudents.length > 24
                          ? 0.34
                          : teacherStudents.length > 16
                            ? 0.42
                            : teacherStudents.length > 8
                              ? 0.52
                              : 0.62;
                      return (
                        <div
                          key={student.id}
                          className="relative h-[104px] min-w-0"
                        >
                          <div
                            className="absolute bottom-4 left-1/2 h-[200px] w-[200px] origin-bottom"
                            style={{
                              transform: `translateX(-50%) scale(${scale})`,
                            }}
                          >
                            <AvatarRenderer
                              avatarState={{
                                ...(student.avatarState || {
                                  skinColor: "#FFE0BD",
                                  equipped: {},
                                }),
                                animationState: "idle",
                              }}
                              inventory={student.items}
                              size="sprite"
                              facing="front"
                              showAnimation
                              useSprite
                              showDebugOverlay={false}
                            />
                            {(session.status === "defense_reveal" ||
                              session.status === "boss_attack") &&
                              defended && (
                                <div className="absolute inset-2 animate-pulse rounded-full border-8 border-cyan-300/80 bg-cyan-300/20 shadow-[0_0_30px_cyan]" />
                              )}
                            {session.status === "boss_attack" && (
                              <SpriteEffect
                                src={attack.src}
                                cols={attack.cols}
                                rows={attack.rows}
                                frames={
                                  session.bossAttack === "lightning"
                                    ? 8
                                    : undefined
                                }
                                duration={
                                  session.bossAttack === "lightning"
                                    ? 2600
                                    : 1700
                                }
                                className={
                                  session.bossAttack === "lightning"
                                    ? "absolute bottom-0 left-1/2 z-30 h-[160px] w-[120px] -translate-x-1/2"
                                    : "absolute inset-0 z-30 h-[200px] w-[200px]"
                                }
                              />
                            )}
                          </div>
                          <div className="absolute bottom-0 left-1/2 w-[78px] -translate-x-1/2 rounded bg-black/75 px-1 py-[2px] text-[8px] leading-none">
                            <div className="flex justify-between gap-1">
                              <span className="max-w-[27px] truncate">
                                {student.nickname}
                              </span>
                              <span>{hp}</span>
                            </div>
                            <div className="mt-[2px] h-1 overflow-hidden rounded bg-slate-700">
                              <div
                                className="h-full bg-emerald-500"
                                style={{
                                  width: `${Math.max(0, (hp / maxHp) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          {isTeacher && session.status === "rps" && (
            <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 text-5xl font-black tracking-[.16em] text-amber-200 [text-shadow:0_3px_0_#5b2b00,0_0_18px_#ffc44d]">
              가위바위보!
            </div>
          )}
          {isTeacher && session.status === "rps_reveal" && bossRps && (
            <div className="absolute left-1/2 top-16 z-30 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-black/70 px-6 py-3 text-2xl font-black">
              <span>보스의 선택</span>
              <img
                src={`/boss-battle/rps-${bossRps}.png`}
                className="h-20 w-20 object-contain"
              />
            </div>
          )}
          {me && !dead && !isResult && !isCinematic && (
            <div
              className={`student-avatar-wrap absolute bottom-2 left-[4%] z-40 h-[200px] w-[200px] ${showHit ? "animate-[playerShake_.12s_ease-in-out_infinite]" : ""}`}
            >
              <AvatarRenderer
                avatarState={{
                  ...(me.avatarState || { skinColor: "#FFE0BD", equipped: {} }),
                  animationState: "idle",
                }}
                inventory={me.items}
                size="sprite"
                facing="front"
                showAnimation
                useSprite
                showDebugOverlay={false}
              />
              {showHit && (
                <div className="pointer-events-none absolute inset-0 animate-[hitFlash_.5s_ease-out_1] opacity-70 mix-blend-screen [filter:brightness(0)_saturate(100%)_invert(18%)_sepia(98%)_saturate(7482%)_hue-rotate(358deg)_brightness(108%)_contrast(118%)]">
                  <AvatarRenderer
                    avatarState={{
                      ...(me.avatarState || {
                        skinColor: "#FFE0BD",
                        equipped: {},
                      }),
                      animationState: "idle",
                    }}
                    inventory={me.items}
                    size="sprite"
                    facing="front"
                    showAnimation
                    useSprite
                    showDebugOverlay={false}
                  />
                </div>
              )}
              <div className="absolute -bottom-2 left-1/2 w-48 -translate-x-1/2 rounded-lg bg-black/80 px-3 py-2">
                <div className="mb-1 flex justify-between text-xs font-bold">
                  <span>HP</span>
                  <span>
                    {participant?.state.hp || 0}/
                    {participant?.state.maxHp || 100}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${Math.max(0, ((participant?.state.hp || 0) / (participant?.state.maxHp || 100)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          {!isTeacher &&
            session.status === "boss_attack" &&
            session.bossAttack !== "clawCombo" && (
              <SpriteEffect
                src={attack.src}
                cols={attack.cols}
                rows={attack.rows}
                frames={session.bossAttack === "lightning" ? 8 : undefined}
                duration={session.bossAttack === "lightning" ? 2600 : 1700}
                className={`absolute z-20 bg-contain bg-center ${session.bossAttack === "lightning" ? "bottom-0 left-[6%] h-[300px] w-[225px]" : "bottom-0 left-[5%] h-[260px] w-[300px]"}`}
              />
            )}
          {!isTeacher &&
            session.status === "boss_attack" &&
            session.bossAttack === "clawCombo" && (
              <>
                <SpriteEffect
                  src="/boss-battle/claw1.png"
                  cols={2}
                  rows={3}
                  duration={1300}
                  className="absolute bottom-0 left-[3%] z-20 h-[260px] w-[300px] bg-contain bg-center"
                />
                <div className="absolute bottom-0 left-[5%] z-20 animate-[comboDelay_1.3s_steps(1)_1]">
                  <SpriteEffect
                    src="/boss-battle/claw2.png"
                    cols={2}
                    rows={3}
                    duration={1300}
                    className="h-[260px] w-[300px] bg-contain bg-center"
                  />
                </div>
              </>
            )}
          {showShield && (
            <div className="absolute bottom-8 left-[8%] z-30 h-[210px] w-[210px] animate-pulse rounded-full border-8 border-cyan-300/80 bg-cyan-300/20 shadow-[0_0_40px_cyan]">
              <Shield className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 text-cyan-100" />
            </div>
          )}
          {dead && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-black/40">
              <div className="rounded-2xl bg-slate-950/90 p-8 text-center">
                <Skull className="mx-auto mb-3 h-14 w-14" />
                <div className="text-3xl font-black">전투 불능</div>
                <div className="mt-2 text-xl text-amber-300">
                  부활까지{" "}
                  {Math.max(0, REVIVE_REQUIRED_QUESTIONS - (participant?.state.reviveProgress || 0))}
                  문제
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="boss-dialogue-zone relative min-h-0 flex-[42] overflow-hidden px-3 pb-2 pt-1">
          {showTeacherDialogue && !isResult && (
            <>
              <div className="pointer-events-none absolute inset-x-[18%] bottom-1 top-1 rounded-xl bg-black/72" />
              <img
                src="/boss-battle/dialogue-frame.png"
                alt=""
                className="pointer-events-none absolute inset-x-[16%] bottom-0 top-0 z-[1] h-full w-[68%] object-fill"
              />
              <div className="boss-dialogue-content relative z-[2] mx-auto max-w-[760px] scale-[.86] origin-top">
                {[
                  "question",
                  "answer_reveal",
                  "rps",
                  "rps_reveal",
                  "defense_reveal",
                ].includes(session.status) && (
                  <div className="mx-auto mb-2 max-w-4xl">
                    <div
                      className={`mx-auto mb-2 flex w-fit items-center gap-3 rounded-xl border-2 px-6 py-2 shadow-[0_4px_0_rgba(0,0,0,.45),0_0_24px_rgba(255,255,255,.15)] ${plan?.kind === "attack" ? "border-orange-300 bg-gradient-to-b from-red-700/95 to-red-950/95 text-amber-100" : "border-cyan-200 bg-gradient-to-b from-sky-700/95 to-blue-950/95 text-cyan-50"}`}
                    >
                      {plan?.kind === "attack" ? (
                        <Sword className="h-8 w-8 drop-shadow-[0_2px_0_#4b1600]" />
                      ) : (
                        <Shield className="h-8 w-8 drop-shadow-[0_2px_0_#062f49]" />
                      )}
                      <span className="text-2xl font-black tracking-[.12em] [text-shadow:0_3px_0_rgba(0,0,0,.75)]">
                        {plan?.kind === "attack" ? "공격 문제" : "방어 문제"}
                      </span>
                    </div>
                    <div className="mb-1 flex justify-end text-sm font-bold">
                      <span>{Math.ceil(left / 1000)}초</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-black/90 ring-1 ring-white/20">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-300 to-orange-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
                {!isTeacher &&
                  session.bossNotice &&
                  (!session.bossNoticeUntil ||
                    new Date(session.bossNoticeUntil).getTime() > now) && (
                    <div className="mx-auto mb-3 w-fit rounded-xl border border-amber-300 bg-black/70 px-5 py-2 text-center text-2xl font-black text-amber-300 [text-shadow:0_2px_0_#000]">
                      {session.bossNotice}
                    </div>
                  )}
                {(session.status === "question" ||
                  session.status === "answer_reveal") &&
                  q &&
                  (isTeacher ? (
                    <div className="mx-auto max-w-5xl">
                      <BossQuestionPanel
                        key={`teacher-${session.currentRound}-${q.id}`}
                        question={q}
                        disabled
                        reveal={session.status === "answer_reveal"}
                        submittedAnswer={undefined}
                        isCorrect={session.status === "answer_reveal" ? true : undefined}
                        onSubmit={() => {}}
                      />
                      {session.status === "question" && (
                        <div className="mt-2 text-center text-amber-200">
                          학생들이 문제를 풀고 있습니다.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mx-auto max-w-5xl">
                      <BossQuestionPanel
                        key={`student-${session.id}-${session.currentRound}-${q.id}`}
                        question={q}
                        disabled={submitted || dead || session.paused}
                        reveal={session.status === "answer_reveal"}
                        submittedAnswer={currentAnswer?.answer}
                        isCorrect={currentAnswer?.isCorrect}
                        onSubmit={(a) => onAnswer?.(a)}
                      />
                      {session.status === "question" && submitted && (
                        <div className="mt-2 text-center text-emerald-300">
                          제출 완료
                        </div>
                      )}
                    </div>
                  ))}
                {session.status === "rps" &&
                  !isTeacher &&
                  !dead &&
                  (correct ? (
                    <div className="mx-auto max-w-4xl text-center">
                      <div className="mb-4 text-2xl font-black">
                        가위바위보를 선택하세요!
                      </div>
                      <div className="grid grid-cols-3 gap-5">
                        {choices.map((c) => (
                          <button
                            key={c}
                            disabled={session.paused || !!selectedRps}
                            onClick={() => onRps?.(c)}
                            className={`rounded-2xl p-3 transition disabled:cursor-not-allowed disabled:opacity-50 ${selectedRps === c ? "bg-white/30 ring-4 ring-white" : "bg-black/60 brightness-50 hover:brightness-100"}`}
                          >
                            <img
                              src={`/boss-battle/rps-${c}.png`}
                              className="mx-auto aspect-square w-full max-w-[150px] object-contain"
                            />
                            <div className="mt-2 font-bold">{label(c)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid h-full place-items-center text-center text-2xl font-black text-slate-300">
                      오답이므로 다른 친구들의 선택을 기다리고 있습니다.
                    </div>
                  ))}
                {session.status === "rps_reveal" && !isTeacher && (
                  <div className="mx-auto max-w-4xl text-center">
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <div className="mb-2 text-xl font-bold">나의 선택</div>
                        {selectedRps ? (
                          <img
                            src={`/boss-battle/rps-${selectedRps}.png`}
                            className="mx-auto h-36 object-contain"
                          />
                        ) : (
                          <div className="grid h-44 place-items-center text-slate-400">
                            선택하지 않음
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="mb-2 text-xl font-bold">
                          보스의 선택
                        </div>
                        {bossRps && (
                          <img
                            src={`/boss-battle/rps-${bossRps}.png`}
                            className="mx-auto h-36 object-contain"
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-black/50 p-4 text-3xl font-black text-yellow-300">
                      {!correct
                        ? "공격에 참여하지 못했습니다."
                        : rpsResult === 2
                          ? "공격력 2배!"
                          : rpsResult === 1
                            ? "기본 공격력!"
                            : "공격력 ÷2!"}
                    </div>
                  </div>
                )}
                {session.status === "defense_reveal" && !isTeacher && (
                  <div
                    className={`grid h-full place-items-center text-4xl font-black ${correct ? "text-cyan-300" : "text-red-400"}`}
                  >
                    {correct ? "방어 성공!" : "방어 실패!"}
                  </div>
                )}
                {[
                  "roar",
                  "player_attack",
                  "boss_attack",
                  "student_hit",
                  "transition",
                ].includes(session.status) && (
                  <div className="grid h-full place-items-center text-center text-3xl font-black">
                    {session.status === "player_attack"
                      ? "공격!"
                      : session.status === "boss_attack"
                        ? session.bossAttack === "lightning"
                          ? "낙뢰 공격!"
                          : "해태의 발톱 공격!"
                        : session.status === "student_hit"
                          ? "피격!"
                          : "전투 진행 중..."}
                  </div>
                )}
                {session.status === "defeated" && (
                  <div className="grid h-full place-items-center text-5xl font-black text-yellow-300">
                    보스 섬멸 성공!
                  </div>
                )}
                {session.status === "escaped" && (
                  <div className="grid h-full place-items-center text-5xl font-black text-sky-300">
                    보스가 도망갔습니다
                  </div>
                )}
                {session.status === "wiped" && (
                  <div className="grid h-full place-items-center text-5xl font-black text-red-400">
                    전멸했습니다
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
      {isCinematic && (
        <div className="pointer-events-none absolute inset-0 z-[70] animate-[bossWhiteout_3s_ease-in-out_forwards] bg-white" />
      )}
      {isResult && (
        <div
          className={`absolute inset-0 z-50 ${session.status === "wiped" && !isTeacher ? "grayscale" : ""}`}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className={`absolute left-1/2 top-24 -translate-x-1/2 rounded-2xl border-2 px-10 py-4 text-center font-black shadow-2xl ${session.status === "wiped" ? "border-red-500 bg-red-950/90 text-red-200" : session.status === "escaped" ? "border-cyan-300 bg-slate-950/85 text-cyan-200" : "border-amber-300 bg-amber-950/85 text-amber-100"}`}
          >
            <div className="text-5xl tracking-[.08em] [text-shadow:0_4px_0_#000]">
              {session.status === "wiped"
                ? isTeacher
                  ? "토벌 실패!"
                  : "전멸!"
                : session.status === "escaped"
                  ? "보스가 도망갔습니다"
                  : "보스 섬멸 성공!"}
            </div>
            <div className="mt-2 text-sm opacity-80">
              {session.status === "wiped"
                ? "모두 쓰러졌습니다. 다시 도전해보세요!"
                : session.status === "escaped"
                  ? "아쉽지만 보스가 연기를 뿜으며 사라졌습니다!"
                  : "정확한 문제 풀이와 강력한 공격으로 보스를 물리쳤습니다!"}
            </div>
          </div>
          {isTeacher && (
            <div className="absolute right-8 top-1/2 w-[330px] -translate-y-1/2 rounded-2xl border-4 border-amber-400 bg-[#3c2415]/95 p-4 shadow-2xl">
              <div className="mb-3 text-center text-2xl font-black text-amber-200">
                TOP 3 피해량
              </div>
              {(session.status === "defeated" || session.status === "escaped") && <Button className="mb-4 w-full bg-amber-400 font-black text-slate-950 hover:bg-amber-300" onClick={()=>void openSsaemquestReward()}><Gift className="mr-2 h-5 w-5"/>쌤퀘스트에서 보상 받기</Button>}
              <div className="flex items-end justify-center gap-2">
                {[1, 0, 2].map((rankIndex) => {
                  const rp = ranking[rankIndex];
                  const st =
                    rp && rankingStudents.find((x) => x.id === rp.studentId);
                  if (!rp || !st)
                    return (
                      <div
                        key={rankIndex}
                        className="h-40 w-24 rounded bg-black/25"
                      />
                    );
                  return (
                    <div
                      key={rp.studentId}
                      className={`relative w-24 rounded-lg border-2 p-1 text-center ${rankIndex === 0 ? "h-48 border-yellow-300" : "h-40 border-amber-700"}`}
                    >
                      <div className="font-black text-amber-200">
                        {rankIndex + 1}위
                      </div>
                      <div className="relative mx-auto h-24 w-24 overflow-hidden">
                        <div
                          className="absolute left-1/2 top-1/2 h-[200px] w-[200px] origin-center"
                          style={{ transform: "translate(-50%, -50%) scale(0.48)" }}
                        >
                          <AvatarRenderer
                            avatarState={{
                              ...(st.avatarState || {
                                skinColor: "#FFE0BD",
                                equipped: {},
                              }),
                              animationState: "idle",
                            }}
                            inventory={st.items || []}
                            size="sprite"
                            facing="front"
                            useSprite
                            showDebugOverlay={false}
                          />
                        </div>
                      </div>
                      <div className="truncate text-xs">{st.nickname}</div>
                      <div className="font-bold text-yellow-300">
                        {rp.state.totalDamage.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setShowRanking(true)}
                  className="bg-cyan-700"
                >
                  순위 보기
                </Button>
                <Button onClick={onFinish} className="bg-amber-500 text-black">
                  대기실로
                </Button>
              </div>
            </div>
          )}
          {showRanking && isTeacher && (
            <div className="absolute inset-0 z-[80] grid place-items-center bg-black/70 p-8">
              <div className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-2xl border-4 border-amber-700 bg-amber-50 p-5 text-slate-900">
                <div className="mb-4 flex justify-between">
                  <h2 className="text-3xl font-black">전체 순위</h2>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRanking(false)}
                  >
                    닫기
                  </Button>
                </div>
                <table className="w-full text-center">
                  <thead>
                    <tr className="bg-amber-900 text-white">
                      <th>순위</th>
                      <th>학생</th>
                      <th>남은 HP</th>
                      <th>정답 수</th>
                      <th>총 피해량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((rp, i) => {
                      const st = rankingStudents.find(
                        (x) => x.id === rp.studentId,
                      );
                      return (
                        <tr
                          key={rp.studentId}
                          className="border-b border-amber-300"
                        >
                          <td className="py-2 font-black">{i + 1}</td>
                          <td>{st?.nickname || rp.attendanceNumber}</td>
                          <td>
                            {rp.state.hp}/{rp.state.maxHp}
                          </td>
                          <td>{rp.state.correctCount}</td>
                          <td className="font-black">
                            {rp.state.totalDamage.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {rewardOpen && isTeacher && <div className="absolute inset-0 z-[110] grid place-items-center bg-black/75 p-4"><div className="relative w-full max-w-md rounded-2xl bg-white p-6 text-center text-slate-950"><button className="absolute right-3 top-3" onClick={()=>setRewardOpen(false)}><X/></button><h2 className="mb-3 text-2xl font-black">쌤퀘스트 보상</h2>{rewardBusy&&<p>보상 코드를 만드는 중...</p>}{rewardError&&<div className="space-y-3 text-red-600"><p>{rewardError}</p><Button onClick={()=>{setRewardInfo(null);void openSsaemquestReward();}}>다시 시도</Button></div>}{rewardInfo&&<><img className="mx-auto h-52 w-52" alt="보상 QR 코드" src={`https://api.qrserver.com/v1/create-qr-code/?size=640x640&data=${encodeURIComponent(rewardInfo.claimUrl)}`}/><div className="mt-3 text-xl font-black">{rewardInfo.reward.item_name}</div><div className="mt-2 font-mono text-4xl font-black tracking-widest">{rewardInfo.reward.code}</div><p className="mt-2 text-sm text-slate-600">QR 코드를 찍거나 쌤퀘스트에서 보상 코드를 입력하세요.</p></>}</div></div>}
        </div>
      )}
      </div>
      {session.paused && (
        <div className="pointer-events-none absolute inset-0 z-[450] grid place-items-center bg-black/35">
          <div className="rounded-2xl border-4 border-white bg-black/80 px-12 py-8 text-6xl font-black tracking-[.18em] text-white shadow-2xl">일시정지</div>
        </div>
      )}
      {linkedRewardArrived && !isTeacher && <div className="absolute inset-0 z-[520] grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border-4 border-amber-400 bg-white p-7 text-center text-slate-950"><h2 className="text-2xl font-black">승리 보상이 도착했습니다.</h2><p className="mt-3 text-sm text-slate-600">보상은 이미 쌤퀘스트 계정에 지급되었습니다.</p><Button className="mt-6 w-full bg-amber-500 font-black" onClick={()=>{const url=sessionStorage.getItem("ssaemquest-return-url");if(url)window.location.href=`${url}/student/dashboard`;}}>쌤퀘스트로 이동하기</Button></div></div>}
      <style jsx global>{`
        .boss-paused * { animation-play-state: paused !important; transition-duration: 0s !important; }
        /* PC와 교사 화면은 기존 revision5 레이아웃을 그대로 유지합니다. */
        .boss-stage {
          position: relative;
          z-index: 10;
          width: 100%;
          height: 100%;
        }

        /* 학생 가로형 태블릿은 개별 요소를 다시 배치하지 않습니다.
           PC 학생 화면 전체(1500x864)를 단일 캔버스로 보고 등비 확대/축소합니다. */
        .boss-stage-tablet {
          position: absolute !important;
          left: 50% !important;
          top: 50% !important;
          z-index: 10 !important;
          transform-origin: center center !important;
          overflow: visible !important;
        }
        .boss-stage-tablet > header {
          height: 48px !important;
          padding-left: 20px !important;
          padding-right: 20px !important;
        }
        .boss-stage-tablet > section {
          width: 1500px !important;
          max-width: 1500px !important;
          height: 816px !important;
        }
        .boss-stage-tablet > section > div:first-child {
          flex: 58 1 0% !important;
        }
        .boss-stage-tablet .boss-dialogue-zone {
          flex: 42 1 0% !important;
          padding: 4px 12px 8px !important;
        }
        .boss-stage-tablet .boss-dialogue-zone > div.pointer-events-none {
          left: 18% !important;
          right: 18% !important;
          top: 4px !important;
          bottom: 4px !important;
        }
        .boss-stage-tablet .boss-dialogue-zone > img {
          left: 16% !important;
          right: 16% !important;
          width: 68% !important;
          height: 100% !important;
          object-fit: fill !important;
        }
        .boss-stage-tablet .boss-dialogue-content {
          width: auto !important;
          max-width: 760px !important;
          transform: scale(.86) !important;
          transform-origin: top center !important;
        }
        .boss-stage-tablet .boss-sprite-layer {
          /* 보스 위치는 좌표/translate 조합이 아니라 전투 영역 전체 폭을 기준으로 한 flex 중앙 정렬로 고정합니다.
             따라서 태블릿 브라우저의 transform 계산이나 중첩 스케일과 무관하게 항상 가로 중앙에 놓입니다. */
          left: 0 !important;
          right: 0 !important;
          bottom: -65px !important;
          width: 100% !important;
          display: flex !important;
          justify-content: center !important;
          transform: none !important;
        }
        .boss-stage-tablet .boss-sprite-wrap {
          position: relative !important;
          left: auto !important;
          right: auto !important;
          top: auto !important;
          bottom: auto !important;
          margin: 0 !important;
          transform-origin: bottom center !important;
        }
        .boss-stage-tablet .student-avatar-wrap {
          left: 4% !important;
          bottom: 8px !important;
          transform: none !important;
          transform-origin: bottom left !important;
        }
      `}</style>
      {debug && (
        <div className="fixed bottom-4 right-4 z-[100] w-72 rounded-xl border border-fuchsia-400 bg-black/90 p-3">
          <div className="mb-2 flex items-center gap-2 font-bold">
            <Bug />
            디버그 모드
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              "boss-hit",
              "boss-death",
              "student-hit",
              "claw1",
              "claw2",
              "clawCombo",
              "lightning",
            ].map((x) => (
              <Button size="sm" key={x} onClick={() => onDebug?.(x)}>
                {x}
              </Button>
            ))}
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes bossShake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-4px);
          }
          75% {
            transform: translateX(4px);
          }
        }
        @keyframes playerShake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-4px);
          }
          75% {
            transform: translateX(4px);
          }
        }
        @keyframes hitFlash {
          0% {
            opacity: 0;
          }
          35% {
            opacity: 0.7;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes bossFade {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes bossWhiteout {
          0%,
          55% {
            opacity: 0;
          }
          82% {
            opacity: 0.96;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes bossSlowShake {
          0%,
          100% {
            transform: translateX(0) scale(1);
            filter: brightness(1);
          }
          35% {
            transform: translateX(-5px) scale(0.995);
            filter: brightness(1.15);
          }
          70% {
            transform: translateX(5px) scale(0.99);
            filter: brightness(1.5);
          }
        }
        @keyframes comboDelay {
          0%,
          49% {
            opacity: 0;
          }
          50%,
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}
