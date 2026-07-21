"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { listRaidGuests, raidGuestToStudent } from "@/lib/raid-guests";
import type { Quiz, QuizQuestion, Student } from "@/lib/types";
import { BossWaitingParticipant } from "@/components/boss-battle/BossWaitingParticipant";
import { BossWaitingRoomBgm } from "@/components/boss-battle/BossWaitingRoomBgm";
import { BossBattleArena } from "@/components/boss-battle/BossBattleArena";
import { ArrowLeft, Play, RefreshCw, StopCircle, Users, QrCode, X, Pause, PlayCircle } from "lucide-react";
import { getBossById } from "@/lib/boss-catalog";
import { REWARD_FOLDER_ITEMS } from "@/lib/reward-folder-items";
import {
  HAETAE_PREPARED_QUIZ_GROUPS,
  HAETAE_PREPARED_QUESTIONS,
  HAETAE_PREPARED_QUESTION_COUNT,
} from "@/lib/boss-prepared-quizzes";
import {
  ANSWER_REVEAL_SECONDS,
  DEFENSE_REVEAL_SECONDS,
  MAX_BOSS_PLAYERS,
  RPS_REVEAL_SECONDS,
  RPS_TIME_SECONDS,
  REVIVE_REQUIRED_QUESTIONS,
  buildRoundPlan,
  calculateBossMaxHp,
  chooseBossAttack,
  bossAttackDamage,
  currentBossQuestion,
  endBossBattleSession,
  getBossAnswers,
  getBossBattleSession,
  getBossParticipants,
  grantBossBattleReward,
  isBossAnswerCorrect,
  isNewerBossSession,
  randomRps,
  resetBossParticipantStates,
  rpsMultiplier,
  saveBossBattleSession,
  submitBossRps,
  updateBossParticipantState,
  clearBossParticipants,
  type BossBattleParticipant,
  type BossBattleSession,
  subscribeBossBattleRoom,
} from "@/lib/boss-battle";

export default function TeacherBossBattlePage() {
  const sp = useSearchParams(),
    router = useRouter(),
    code = (sp.get("code") || "").toUpperCase(),
    selectedBoss = getBossById(sp.get("bossId"));
  const [quizzes, setQuizzes] = useState<Quiz[]>([]),
    [students, setStudents] = useState<Student[]>([]),
    [participants, setParticipants] = useState<BossBattleParticipant[]>([]),
    [session, setSession] = useState<BossBattleSession | null>(null);
  const [count, setCount] = useState(10),
    [seconds, setSeconds] = useState(20),
    [selected, setSelected] = useState<Record<string, boolean>>({}),
    [preparedSelected, setPreparedSelected] = useState<Record<string, boolean>>({}),
    [busy, setBusy] = useState(false),
    [qrOpen, setQrOpen] = useState(false),
    [avatarCustomizationEnabled, setAvatarCustomizationEnabled] = useState(true),
    [victoryRewardItemId, setVictoryRewardItemId] = useState(
      "g5-s1-social-u3-pet-law-judge-haetae",
    ),
    [escapeRewardItemId, setEscapeRewardItemId] = useState(
      "g5-s1-social-u3-face-haetae-tear",
    );
  const resolving = useRef(false),
    phaseTimerBusy = useRef(false),
    participantCountRef = useRef(0),
    hpScalingBusy = useRef(false);
  const scaledBossDamage = (attack: any, current: BossBattleSession) => {
    const defenseCount = Math.max(
      1,
      current.roundPlan.filter((x) => x.kind === "defense").length,
    );
    // 전멸은 모든 학생이 쓰러졌을 때만 발생합니다. 다만 반복 오답의 긴장감을 위해
    // 기존 기준보다 약 12.5% 높은 총 잠재 피해량을 사용합니다.
    const base = Math.min(47, Math.max(15, Math.ceil(135 / defenseCount)));
    const multiplier =
      attack === "lightning" ? 1.45 : attack === "clawCombo" ? 1.2 : 1;
    return Math.min(68, Math.max(10, Math.round(base * multiplier)));
  };
  useEffect(() => {
    if (!code) return;
    Promise.all([listRaidGuests(code), getBossBattleSession(code)]).then(([guests, ss]) => {
      setStudents(guests.map(raidGuestToStudent));
      setSession(ss);
      if (ss) {
        setCount(ss.questionCount);
        setSeconds(ss.timeLimitSeconds);
        setAvatarCustomizationEnabled(ss.avatarCustomizationEnabled !== false);
        setVictoryRewardItemId(
          ss.victoryRewardItemId || "g5-s1-social-u3-pet-law-judge-haetae",
        );
        setEscapeRewardItemId(
          ss.escapeRewardItemId || "g5-s1-social-u3-face-haetae-tear",
        );
      }
    });
  }, [code]);
  useEffect(() => {
    if (!session?.id) return;
    const run = async () => {
      const [ss, ps, guests] = await Promise.all([
        getBossBattleSession(code),
        getBossParticipants(
          code,
          session.id,
          !["defeated", "escaped", "wiped", "result_ready"].includes(session.status),
        ),
        listRaidGuests(code),
      ]);
      if (ss) {
        let nextSession = ss;
        const previousCount = participantCountRef.current;
        participantCountRef.current = ps.length;
        const combatActive = !["waiting", "ended", "defeated", "escaped", "wiped", "result_ready", "reward_ready"].includes(ss.status);
        if (combatActive && previousCount > 0 && ps.length > 0 && previousCount !== ps.length && !hpScalingBusy.current) {
          hpScalingBusy.current = true;
          try {
            const attackRounds = Math.max(1, ss.roundPlan.filter(x => x.kind === "attack").length);
            const newMax = calculateBossMaxHp(ps.length, attackRounds);
            if (newMax !== ss.bossMaxHp) {
              const ratio = ss.bossMaxHp > 0 ? ss.bossHp / ss.bossMaxHp : 1;
              const newHp = ss.bossHp <= 0 ? 0 : Math.max(1, Math.min(newMax, Math.round(newMax * ratio)));
              nextSession = await saveBossBattleSession(code, { ...ss, bossMaxHp: newMax, bossHp: newHp });
            }
          } finally { hpScalingBusy.current = false; }
        }
        setSession((prev) => (isNewerBossSession(prev, nextSession) ? nextSession : prev));
      }
      setParticipants(ps);
      setStudents(guests.map(raidGuestToStudent));
    };
    run();
    const unsubscribe = subscribeBossBattleRoom(code, session.id, () => { void run(); });
    const t = setInterval(run, 2500);
    return () => { unsubscribe(); clearInterval(t); };
  }, [code, session?.id]);

  useEffect(() => {
    if (!session?.id || session.resultSnapshot?.length) return;
    if (!["defeated", "escaped", "wiped", "result_ready"].includes(session.status)) return;
    let cancelled = false;
    (async () => {
      const [allParticipants, guests] = await Promise.all([
        getBossParticipants(code, session.id, false),
        listRaidGuests(code),
      ]);
      if (cancelled || !allParticipants.length) return;
      const snapshot = allParticipants.map((participant) => {
        const guest = guests.find((g) => g.id === participant.studentId);
        const student = guest ? raidGuestToStudent(guest) : undefined;
        return {
          studentId: participant.studentId,
          attendanceNumber: participant.attendanceNumber,
          nickname: student?.nickname || participant.attendanceNumber,
          avatarState: student?.avatarState,
          items: student?.items || [],
          state: { ...participant.state },
        };
      });
      const saved = await saveBossBattleSession(code, { ...session, resultSnapshot: snapshot });
      if (!cancelled) setSession(saved);
    })();
    return () => { cancelled = true; };
  }, [code, session?.id, session?.status, session?.resultSnapshot?.length]);

  const allQuestions = useMemo(
      () =>
        quizzes.flatMap((q) =>
          (q.questions || []).map(
            (x) =>
              ({
                ...x,
                quizId: x.quizId || q.id,
                sourceQuizTitle: q.title,
              }) as any,
          ),
        ),
      [quizzes],
    ),
    chosen = allQuestions.filter((q) => selected[q.id]),
    preparedChosen = HAETAE_PREPARED_QUESTIONS.filter((q) => preparedSelected[q.id]),
    rewardItems = REWARD_FOLDER_ITEMS.filter(
      (x) =>
        x.grade === "5" &&
        x.semester === "1" &&
        x.subject === "social" &&
        x.unit === "5-1-social-3",
    );
  async function toggleAvatarCustomization() {
    const next = !avatarCustomizationEnabled;
    setAvatarCustomizationEnabled(next);
    if (session) {
      const saved = await saveBossBattleSession(code, { ...session, avatarCustomizationEnabled: next });
      setSession(saved);
    }
  }
  async function applyWaitingRoomSettings() {
    if (!session || session.status !== "waiting") return session;

    const safeCount = Math.max(1, Math.min(50, Number(count) || 1));
    const safeSeconds = Math.max(5, Math.min(180, Number(seconds) || 20));
    const pool: QuizQuestion[] = preparedChosen.length
      ? preparedChosen
      : HAETAE_PREPARED_QUESTIONS;

    // 기존에 뽑힌 문제는 가능한 한 유지하고, 문제 수가 늘어난 경우에만 새 문제를 보충합니다.
    const poolIds = new Set(pool.map((question) => question.id));
    const kept = (session.selectedQuestions || []).filter((question) => poolIds.has(question.id));
    const keptIds = new Set(kept.map((question) => question.id));
    const additions = pool
      .filter((question) => !keptIds.has(question.id))
      .sort(() => Math.random() - 0.5);
    const questions = [...kept, ...additions].slice(0, Math.min(safeCount, pool.length));
    const roundPlan = buildRoundPlan(questions);
    const attackCount = Math.max(1, roundPlan.filter((round) => round.kind === "attack").length);
    const bossMaxHp = calculateBossMaxHp(
      Math.max(1, participants.length || students.length),
      attackCount,
    );

    const saved = await saveBossBattleSession(code, {
      ...session,
      questionCount: questions.length,
      timeLimitSeconds: safeSeconds,
      selectedQuestions: questions,
      roundPlan,
      bossMaxHp,
      bossHp: bossMaxHp,
    });
    setCount(questions.length);
    setSeconds(safeSeconds);
    setSession(saved);
    return saved;
  }

  async function createRoom() {
    if (busy) return;
    setBusy(true);
    try {
      const pool: QuizQuestion[] = preparedChosen.length ? preparedChosen : HAETAE_PREPARED_QUESTIONS;
      const qs = [...pool]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(count, pool.length));
      const plan = buildRoundPlan(qs),
        attackCount = plan.filter((x) => x.kind === "attack").length,
        hp = calculateBossMaxHp(
          Math.max(1, participants.length || students.length),
          attackCount,
        );
      if (session?.id) await clearBossParticipants(session.id, code);
      const s = await saveBossBattleSession(code, {
        status: "waiting",
        bossId: selectedBoss.id,
        bossName: selectedBoss.name,
        questionCount: qs.length,
        timeLimitSeconds: Math.max(5, Math.min(180, seconds)),
        selectedQuestions: qs,
        roundPlan: plan,
        currentRound: 0,
        bossMaxHp: hp,
        bossHp: hp,
        lightningUnlocked: false,
        defenseRoundsSinceLightning: 0,
        avatarCustomizationEnabled,
        victoryRewardItemId,
        escapeRewardItemId,
        resultSnapshot: undefined,
      });
      setSession(s);
      setParticipants([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`방을 만들지 못했습니다.\n\n${message}\n\n인터넷 연결을 확인하고 다시 시도해 주세요.`);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (!session || !participants.length) return alert("참여 학생이 없습니다.");
    const currentSession = (await applyWaitingRoomSettings()) || session;
    const plan = currentSession.roundPlan?.length
      ? currentSession.roundPlan.map((round, index, rounds) =>
          index === rounds.length - 1 ? { ...round, kind: "attack" as const } : round,
        )
      : buildRoundPlan(currentSession.selectedQuestions);
    const hp = calculateBossMaxHp(
      participants.length,
      plan.filter((x) => x.kind === "attack").length,
    );
    await resetBossParticipantStates(code, session.id);
    setSession(
      await saveBossBattleSession(code, {
        ...currentSession,
        roundPlan: plan,
        bossMaxHp: hp,
        bossHp: hp,
        currentRound: 0,
        status: "entrance",
        phaseStartedAt: new Date().toISOString(),
        phaseEndsAt: new Date(Date.now() + 3400).toISOString(),
        resultSnapshot: undefined,
      }),
    );
  }
  async function finish() {
    if (!session) return;
    if (["defeated", "escaped", "wiped"].includes(session.status)) {
      if (!confirm("결과를 닫고 모두 대기실로 돌아갈까요?")) return;
      const reset = await saveBossBattleSession(code, { ...session, status: "waiting", currentRound: 0, bossHp: session.bossMaxHp, phaseStartedAt: undefined, phaseEndsAt: undefined, rewardGranted: false });
      await resetBossParticipantStates(code, session.id);
      setSession(reset);
      return;
    }
    if (!confirm("현재 전투를 끝내고 모두 대기실로 돌아갈까요?")) return;
    const reset = await saveBossBattleSession(code, {
      ...session,
      status: "waiting",
      currentRound: 0,
      bossHp: session.bossMaxHp,
      phaseStartedAt: undefined,
      phaseEndsAt: undefined,
      rewardGranted: false,
      bossRpsChoice: undefined,
      roundDamage: 0,
    });
    await resetBossParticipantStates(code, session.id);
    setSession(reset);
  }
  async function goQuestion(
    nextRound: number,
    sourceSession: BossBattleSession | null = session,
  ) {
    if (!sourceSession) return;
    if (nextRound >= sourceSession.roundPlan.length) {
      setSession(
        await saveBossBattleSession(code, {
          ...sourceSession,
          status:
            sourceSession.bossHp <= 0
              ? "defeated_transition"
              : "escaped_transition",
          phaseStartedAt: new Date().toISOString(),
          phaseEndsAt: new Date(Date.now() + 3000).toISOString(),
        }),
      );
      return;
    }

    // 부활 조건을 채운 학생은 현재 문제의 모든 연출과 피해 처리가 끝난 뒤,
    // 다음 문제로 넘어가는 순간에 부활시킵니다.
    const latestParticipants = await getBossParticipants(code, sourceSession.id, false);
    for (const participant of latestParticipants) {
      if (
        participant.state.knockedOut &&
        participant.state.reviveProgress >= REVIVE_REQUIRED_QUESTIONS
      ) {
        await updateBossParticipantState(code, sourceSession.id, participant.studentId, {
          knockedOut: false,
          hp: 40,
          reviveProgress: 0,
          reviveCount: participant.state.reviveCount + 1,
          lastResult: "revived",
        });
      }
    }

    setSession(
      await saveBossBattleSession(code, {
        ...sourceSession,
        currentRound: nextRound,
        status: "question",
        phaseStartedAt: new Date().toISOString(),
        phaseEndsAt: new Date(
          Date.now() + sourceSession.timeLimitSeconds * 1000,
        ).toISOString(),
        debugEvent: undefined,
      }),
    );
  }
  async function resolveQuestion() {
    if (!session || resolving.current) return;
    resolving.current = true;
    try {
      const answers = await getBossAnswers(
          code,
          session.id,
          session.currentRound,
        ),
        q = currentBossQuestion(session),
        plan = session.roundPlan[session.currentRound];
      if (!q || !plan) return;
      const active = participants.filter((p) => !p.state.knockedOut);
      const correctIds = new Set(
        answers
          .filter((a) => a.isCorrect === true || isBossAnswerCorrect(q, a.answer))
          .map((a) => a.studentId),
      );
      for (const p of participants) {
        if (p.state.knockedOut) {
          if (correctIds.size > 0) {
            const rp = p.state.reviveProgress + 1;
            await updateBossParticipantState(code, session.id, p.studentId, {
              // 조건 달성 여부만 기록하고 실제 부활은 다음 문제 진입 직전에 처리합니다.
              reviveProgress: Math.min(rp, REVIVE_REQUIRED_QUESTIONS),
            });
          }
          continue;
        }
        const ok = correctIds.has(p.studentId);
        await updateBossParticipantState(code, session.id, p.studentId, {
          correctCount: p.state.correctCount + (ok ? 1 : 0),
          attackCorrectCount:
            p.state.attackCorrectCount + (ok && plan.kind === "attack" ? 1 : 0),
          defenseSuccessCount:
            p.state.defenseSuccessCount +
            (ok && plan.kind === "defense" ? 1 : 0),
          lastResult: ok ? "correct" : "wrong",
        });
      }
      if (plan.kind === "attack") {
        setSession(
          await saveBossBattleSession(code, {
            ...session,
            status: "answer_reveal",
            phaseStartedAt: new Date().toISOString(),
            phaseEndsAt: new Date(
              Date.now() + ANSWER_REVEAL_SECONDS * 1000,
            ).toISOString(),
            bossRpsChoice: undefined,
          }),
        );
      } else {
        const attack = chooseBossAttack(session),
          damage = scaledBossDamage(attack, session);
        for (const p of active) {
          if (correctIds.has(p.studentId)) continue;
          await updateBossParticipantState(code, session.id, p.studentId, {
            lastDamage: damage,
            reviveProgress: 0,
            lastResult: "pending_hit",
          });
        }
        setSession(
          await saveBossBattleSession(code, {
            ...session,
            status: "answer_reveal",
            bossAttack: attack,
            lightningUnlocked:
              session.lightningUnlocked ||
              attack === "lightning" ||
              session.bossHp / session.bossMaxHp <= 0.5,
            defenseRoundsSinceLightning:
              attack === "lightning"
                ? 0
                : (session.defenseRoundsSinceLightning || 0) + 1,
            phaseStartedAt: new Date().toISOString(),
            phaseEndsAt: new Date(
              Date.now() + ANSWER_REVEAL_SECONDS * 1000,
            ).toISOString(),
          }),
        );
      }
    } finally {
      resolving.current = false;
    }
  }
  async function resolveRps() {
    if (!session || resolving.current) return;
    resolving.current = true;
    try {
      const answers = await getBossAnswers(
          code,
          session.id,
          session.currentRound,
        ),
        bossChoice = session.bossRpsChoice || randomRps();
      let total = 0;
      for (const p of participants) {
        const a = answers.find((x) => x.studentId === p.studentId);
        const q = currentBossQuestion(session);
        if (!a || !q || !(a.isCorrect === true || isBossAnswerCorrect(q, a.answer))) continue;
        // 정답 제출은 확인되었지만 네트워크 지연으로 가위바위보 값만 늦게 온 경우에도
        // 공격 자체가 사라지지 않도록 기본 배율(1배)을 보장합니다.
        // 제한 시간 안에 선택하지 못한 학생은 교사 진행 클라이언트가
        // 무작위 선택을 확정해 DB에도 저장합니다.
        const choice = a.rpsChoice || randomRps();
        if (!a.rpsChoice) {
          await submitBossRps(
            code,
            session.id,
            session.currentRound,
            p.studentId,
            choice,
          );
        }
        const dmg = Math.round(10 * rpsMultiplier(choice, bossChoice));
        total += dmg;
        await updateBossParticipantState(code, session.id, p.studentId, {
          totalDamage: p.state.totalDamage + dmg,
          lastDamage: dmg,
          lastResult: `${choice}/${bossChoice}`,
        });
      }
      setSession(
        await saveBossBattleSession(code, {
          ...session,
          bossRpsChoice: bossChoice,
          roundDamage: total,
          status: "rps_reveal",
          phaseStartedAt: new Date().toISOString(),
          phaseEndsAt: new Date(
            Date.now() + RPS_REVEAL_SECONDS * 1000,
          ).toISOString(),
        }),
      );
    } finally {
      resolving.current = false;
    }
  }
  async function finishEntrance() {
    if (!session || session.status !== "entrance" || phaseTimerBusy.current)
      return;
    phaseTimerBusy.current = true;
    try {
      setSession(
        await saveBossBattleSession(code, {
          ...session,
          status: "transition",
          phaseStartedAt: new Date().toISOString(),
          phaseEndsAt: new Date(Date.now() + 600).toISOString(),
        }),
      );
    } finally {
      phaseTimerBusy.current = false;
    }
  }
  useEffect(() => {
    if (!session || session.status === "waiting" || session.paused) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled || phaseTimerBusy.current) return;
      const now = Date.now(),
        end = session.phaseEndsAt ? new Date(session.phaseEndsAt).getTime() : 0;
      if (session.status === "entrance" && now >= end) {
        await finishEntrance();
        return;
      }
      if (session.status === "transition" && now >= end) {
        phaseTimerBusy.current = true;
        try {
          setSession(
            await saveBossBattleSession(code, {
              ...session,
              status: "roar",
              phaseStartedAt: new Date().toISOString(),
              phaseEndsAt: new Date(Date.now() + 3000).toISOString(),
            }),
          );
        } finally {
          phaseTimerBusy.current = false;
        }
        return;
      }
      if (session.status === "roar" && now >= end) {
        phaseTimerBusy.current = true;
        try {
          await goQuestion(0);
        } finally {
          phaseTimerBusy.current = false;
        }
        return;
      }
      if (session.status === "question") {
        const answers = await getBossAnswers(
            code,
            session.id,
            session.currentRound,
          ),
          alive = participants.filter((p) => !p.state.knockedOut);
        const allAliveSubmitted = alive.length > 0 && alive.every((participant) =>
          answers.some((answer) => answer.studentId === participant.studentId),
        );
        if (now >= end || allAliveSubmitted) await resolveQuestion();
        return;
      }
      if (session.status === "answer_reveal" && now >= end) {
        const kind = session.roundPlan[session.currentRound]?.kind;
        phaseTimerBusy.current = true;
        try {
          if (kind === "attack")
            setSession(
              await saveBossBattleSession(code, {
                ...session,
                status: "rps",
                phaseStartedAt: new Date().toISOString(),
                phaseEndsAt: new Date(
                  Date.now() + RPS_TIME_SECONDS * 1000,
                ).toISOString(),
              }),
            );
          else
            setSession(
              await saveBossBattleSession(code, {
                ...session,
                status: "defense_reveal",
                phaseStartedAt: new Date().toISOString(),
                phaseEndsAt: new Date(
                  Date.now() + DEFENSE_REVEAL_SECONDS * 1000,
                ).toISOString(),
              }),
            );
        } finally {
          phaseTimerBusy.current = false;
        }
        return;
      }
      if (session.status === "rps") {
        const answers = await getBossAnswers(
            code,
            session.id,
            session.currentRound,
          ),
          q = currentBossQuestion(session);
        const eligible = q
          ? answers.filter((a) => a.isCorrect === true || isBossAnswerCorrect(q, a.answer))
          : [];
        if (
          now >= end ||
          eligible.length === 0 ||
          eligible.every((a) => !!a.rpsChoice)
        )
          await resolveRps();
        return;
      }
      if (session.status === "rps_reveal" && now >= end) {
        phaseTimerBusy.current = true;
        try {
          if ((session.roundDamage || 0) > 0)
            setSession(
              await saveBossBattleSession(code, {
                ...session,
                status: "player_attack",
                phaseStartedAt: new Date().toISOString(),
                phaseEndsAt: new Date(Date.now() + 1400).toISOString(),
              }),
            );
          else await goQuestion(session.currentRound + 1);
        } finally {
          phaseTimerBusy.current = false;
        }
        return;
      }
      if (session.status === "defense_reveal" && now >= end) {
        const duration =
          session.bossAttack === "lightning"
            ? 3000
            : session.bossAttack === "clawCombo"
              ? 2600
              : 1700;
        phaseTimerBusy.current = true;
        try {
          setSession(
            await saveBossBattleSession(code, {
              ...session,
              status: "boss_attack",
              phaseStartedAt: new Date().toISOString(),
              phaseEndsAt: new Date(Date.now() + duration).toISOString(),
            }),
          );
        } finally {
          phaseTimerBusy.current = false;
        }
        return;
      }
      if (session.status === "boss_attack" && now >= end) {
        const refreshed = await getBossParticipants(code, session.id, false),
          pending = refreshed.filter(
            (p) => p.state.lastResult === "pending_hit" && !p.state.knockedOut,
          );
        phaseTimerBusy.current = true;
        try {
          if (pending.length) {
            for (const p of pending) {
              const damage =
                  p.state.lastDamage ||
                  scaledBossDamage(session.bossAttack, session),
                hp = Math.max(0, p.state.hp - damage);
              await updateBossParticipantState(code, session.id, p.studentId, {
                hp,
                knockedOut: hp <= 0,
                lastResult: "hit",
              });
            }
            let healedSession = session;
            if (session.bossEndured && pending.length > 0) {
              const perStudent = Math.max(
                1,
                Math.round(session.bossMaxHp * 0.0017),
              );
              const healCap = Math.max(1, Math.round(session.bossMaxHp * 0.017));
              const healAmount = Math.min(healCap, perStudent * pending.length);
              const healedHp = Math.min(
                session.bossMaxHp,
                session.bossHp + healAmount,
              );
              healedSession = await saveBossBattleSession(code, {
                ...session,
                bossHp: healedHp,
                bossHealAmount: healedHp - session.bossHp,
                bossNotice: `보스가 체력을 ${healedHp - session.bossHp} 회복합니다!`,
                bossNoticeUntil: new Date(Date.now() + 4500).toISOString(),
              });
              setSession(healedSession);
            }
            const after = await getBossParticipants(code, session.id, false),
              hasReviveReady = after.some(
                (p) =>
                  p.state.knockedOut &&
                  p.state.reviveProgress >= REVIVE_REQUIRED_QUESTIONS,
              ),
              allDead =
                after.length > 0 &&
                after.every((p) => p.state.knockedOut) &&
                !hasReviveReady;
            if (allDead)
              setSession(
                await saveBossBattleSession(code, {
                  ...healedSession,
                  status: "wiped",
                }),
              );
            else
              setSession(
                await saveBossBattleSession(code, {
                  ...healedSession,
                  status: "student_hit",
                  phaseStartedAt: new Date().toISOString(),
                  phaseEndsAt: new Date(Date.now() + 1000).toISOString(),
                }),
              );
          } else {
            // 학생 클라이언트가 백그라운드 탭 복귀 시 자신의 피해를 먼저
            // 확정했을 수 있으므로, pending 목록이 비어도 전멸/피격 상태를 재확인한다.
            const after = await getBossParticipants(code, session.id, false);
            const hasReviveReady = after.some(
              (p) =>
                p.state.knockedOut &&
                p.state.reviveProgress >= REVIVE_REQUIRED_QUESTIONS,
            );
            const allDead =
              after.length > 0 &&
              after.every((p) => p.state.knockedOut) &&
              !hasReviveReady;
            const anyHit = after.some((p) => p.state.lastResult === "hit");
            if (allDead)
              setSession(await saveBossBattleSession(code, { ...session, status: "wiped" }));
            else if (anyHit)
              setSession(await saveBossBattleSession(code, {
                ...session,
                status: "student_hit",
                phaseStartedAt: new Date().toISOString(),
                phaseEndsAt: new Date(Date.now() + 1000).toISOString(),
              }));
            else await goQuestion(session.currentRound + 1);
          }
        } finally {
          phaseTimerBusy.current = false;
        }
        return;
      }
      if (session.status === "player_attack" && now >= end) {
        phaseTimerBusy.current = true;
        try {
          const isLastQuestion =
            session.currentRound >= session.roundPlan.length - 1;
          const rawHp = Math.max(
            0,
            session.bossHp - (session.roundDamage || 0),
          );
          const remainingAttackRounds = session.roundPlan
            .slice(session.currentRound + 1)
            .filter((round) => round.kind === "attack").length;
          const totalAttackRounds = Math.max(
            1,
            session.roundPlan.filter((round) => round.kind === "attack").length,
          );
          // 보스가 마지막 문제 전 쓰러지는 것은 막되, 마지막 공격 직전에는
          // 최대 체력의 약 50% 비율까지 내려갈 수 있도록 진행도 하한을 완화합니다.
          const progressionFloor = isLastQuestion
            ? 0
            : Math.max(1, Math.round(session.bossMaxHp * (remainingAttackRounds / totalAttackRounds) * 0.5));
          const hp = isLastQuestion ? rawHp : Math.max(rawHp, progressionFloor);
          const enduredNow = !isLastQuestion && rawHp < progressionFloor;
          const updated = await saveBossBattleSession(code, {
            ...session,
            bossHp: hp,
            roundDamage: 0,
            bossEndured: session.bossEndured || enduredNow,
            ...(enduredNow
              ? {
                  bossNotice: "보스가 버텨냈습니다!",
                  bossNoticeUntil: new Date(Date.now() + 4500).toISOString(),
                  bossHealAmount: 0,
                }
              : {}),
            ...(hp <= 0
              ? {
                  status: "defeated_transition" as const,
                  phaseStartedAt: new Date().toISOString(),
                  phaseEndsAt: new Date(Date.now() + 3000).toISOString(),
                }
              : {}),
          });
          setSession(updated);
          if (hp > 0) await goQuestion(session.currentRound + 1, updated);
        } finally {
          phaseTimerBusy.current = false;
        }
        return;
      }
      if (
        (session.status === "defeated_transition" ||
          session.status === "escaped_transition") &&
        now >= end
      ) {
        phaseTimerBusy.current = true;
        try {
          setSession(
            await saveBossBattleSession(code, {
              ...session,
              status:
                session.status === "defeated_transition"
                  ? "defeated"
                  : "escaped",
              phaseStartedAt: new Date().toISOString(),
              phaseEndsAt: undefined,
            }),
          );
        } finally {
          phaseTimerBusy.current = false;
        }
        return;
      }
      if (session.status === "student_hit" && now >= end) {
        phaseTimerBusy.current = true;
        try {
          await goQuestion(session.currentRound + 1);
        } finally {
          phaseTimerBusy.current = false;
        }
      }
    };
    void run().catch((error) => console.warn("[Boss Battle] phase sync retry:", error));
    const timer = window.setInterval(
      () => void run().catch((error) => console.warn("[Boss Battle] phase sync retry:", error)),
      800,
    );
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    session?.id,
    session?.status,
    session?.phaseEndsAt,
    session?.currentRound,
    session?.paused,
    participants.length,
  ]);
  async function togglePause() {
    if (!session || session.status === "waiting" || busy) return;
    setBusy(true);
    try {
      const now = Date.now();
      if (!session.paused) {
        const remaining = Math.max(0, session.phaseEndsAt ? new Date(session.phaseEndsAt).getTime() - now : 0);
        setSession(await saveBossBattleSession(code, { ...session, paused: true, pausedRemainingMs: remaining }));
      } else {
        const remaining = Math.max(250, session.pausedRemainingMs || 0);
        setSession(await saveBossBattleSession(code, {
          ...session, paused: false, pausedRemainingMs: 0,
          phaseStartedAt: new Date().toISOString(),
          phaseEndsAt: session.phaseEndsAt ? new Date(now + remaining).toISOString() : undefined,
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`일시정지 상태를 변경하지 못했습니다.\n\n${message}\n\n인터넷 연결을 확인하고 다시 시도해 주세요.`);
    } finally {
      setBusy(false);
    }
  }

  async function debugEvent(e: string) {
    if (!session) return;
    if (e === "boss-death")
      setSession(
        await saveBossBattleSession(code, {
          ...session,
          bossHp: 0,
          status: "defeated",
        }),
      );
    else if (e === "boss-hit")
      setSession(
        await saveBossBattleSession(code, {
          ...session,
          status: "player_attack",
          phaseEndsAt: new Date(Date.now() + 1400).toISOString(),
        }),
      );
    else if (e === "student-hit")
      setSession(
        await saveBossBattleSession(code, {
          ...session,
          status: "boss_attack",
          bossAttack: "claw1",
          phaseEndsAt: new Date(Date.now() + 1400).toISOString(),
        }),
      );
    else if (["claw1", "claw2", "clawCombo", "lightning"].includes(e))
      setSession(
        await saveBossBattleSession(code, {
          ...session,
          status: "boss_attack",
          bossAttack: e as any,
          phaseEndsAt: new Date(Date.now() + 1600).toISOString(),
        }),
      );
  }
  const joined = participants
    .map((p) => students.find((s) => s.id === p.studentId))
    .filter(Boolean) as Student[];
  if (session && session.status !== "waiting")
    return (
      <>
        <div className="fixed left-3 top-3 z-[120]">
          <Button variant="destructive" onClick={finish}>
            <StopCircle className="mr-2 h-4 w-4" />
            보스전 끝내기
          </Button>
        </div>
        <BossBattleArena
          session={session}
          isTeacher
          teacherStudents={joined}
          teacherParticipants={participants}
          onDebug={debugEvent}
          onEntranceEnded={finishEntrance}
          onFinish={finish}
          onPause={togglePause}
          onShowQr={() => setQrOpen(true)}
        />
        {qrOpen && <div className="fixed inset-0 z-[500] grid place-items-center bg-black/75 p-4"><div className="relative rounded-2xl bg-white p-7 text-center text-slate-950"><button className="absolute right-3 top-3" onClick={()=>setQrOpen(false)}><X/></button><h2 className="mb-3 text-2xl font-black">학생 입장 QR 코드</h2><img className="mx-auto h-80 w-80 max-h-[60dvh] max-w-[60dvh]" alt="방 입장 QR 코드" src={`https://api.qrserver.com/v1/create-qr-code/?size=640x640&data=${encodeURIComponent(`${window.location.origin}/student?code=${code}`)}`}/><div className="mt-3 font-mono text-3xl font-black">{code}</div><p className="mt-2 text-sm text-slate-600">QR 스캔 후 닉네임 설정 화면으로 바로 이동합니다.</p></div></div>}
      </>
    );
  return (
    <main className="min-h-screen bg-slate-950 p-3 text-white md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <Button
            className="bg-white text-black"
            onClick={() => router.push(`/`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            처음으로
          </Button>
          <b>
            {selectedBoss.grade}학년 {selectedBoss.semester}학기{" "}
            {selectedBoss.unit}단원 마무리 문제
          </b>
          <div className="flex gap-2">
            <BossWaitingRoomBgm role="teacher" />
            {session && (
              <Button variant="destructive" onClick={finish}>
                보스전 끝내기
              </Button>
            )}
          </div>
        </div>
        <Card className="bg-amber-50">
          <CardContent className="grid gap-4 p-4 text-slate-900 md:grid-cols-[160px_180px_1fr_auto]">
            <div>
              <Label>문제 수</Label>
              <Input
                type="number"
                value={count}
                onChange={(e) => setCount(+e.target.value)}
                onBlur={() => void applyWaitingRoomSettings()}
                min={1}
                max={50}
              />
            </div>
            <div>
              <Label>문제 당 제한시간</Label>
              <Input
                type="number"
                value={seconds}
                onChange={(e) => setSeconds(+e.target.value)}
                onBlur={() => void applyWaitingRoomSettings()}
                min={5}
                max={180}
              />
            </div>
            <div>
              <div>공격 1~2문제 뒤 방어 1문제가 자동 배치됩니다.</div>
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-300 bg-white/70 px-3 py-2">
                <Switch
                  id="avatar-customization-toggle"
                  checked={avatarCustomizationEnabled}
                  onCheckedChange={() => void toggleAvatarCustomization()}
                  aria-label="아바타 꾸미기 허용"
                />
                <Label htmlFor="avatar-customization-toggle" className="cursor-pointer font-bold">
                  아바타 꾸미기 {avatarCustomizationEnabled ? "ON" : "OFF"}
                </Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={createRoom} disabled={busy}>
                <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
                {busy ? "방 만드는 중…" : "방 만들기"}
              </Button>
              {session && <div className="rounded bg-slate-900 px-4 py-2 font-mono text-xl font-black text-white">방 코드 {code}</div>}
              <Button variant="outline" onClick={()=>setQrOpen(true)} disabled={!session} className="text-black"><QrCode className="mr-2 h-4 w-4"/>QR코드 보기</Button>
              <Button onClick={start} disabled={!session}>
                <Play className="mr-2 h-4 w-4" />
                토벌전 시작
              </Button>
            </div>
          </CardContent>
        </Card>
        <details className="rounded-lg bg-white p-3 text-black">
          <summary className="cursor-pointer font-bold">문제 선택</summary>
          <p className="my-2 rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-900">아무 문제도 선택하지 않으면 준비된 총 {HAETAE_PREPARED_QUESTION_COUNT}문항 중 설정한 문제 수만큼 무작위로 출제됩니다.</p>
          <div className="space-y-3">{HAETAE_PREPARED_QUIZ_GROUPS.map(group=><details key={group.id} className="rounded border p-2"><summary className="cursor-pointer font-bold">{group.title} ({group.questions.length}문항)</summary><div className="mt-2 space-y-2">{group.questions.map(question=><label key={question.id} className="flex cursor-pointer items-start gap-2 rounded p-1 hover:bg-slate-50"><Checkbox checked={!!preparedSelected[question.id]} onCheckedChange={value=>setPreparedSelected(previous=>({...previous,[question.id]:!!value}))}/><span className="text-sm">{question.text}</span></label>)}</div></details>)}</div>
        </details>
        <section
          className="relative min-h-[560px] overflow-hidden rounded-xl border-4 border-amber-400 bg-cover"
          style={{ backgroundImage: "url('/boss-battle/waiting-room.png')" }}
        >
          <div className="absolute left-3 top-3 rounded bg-black/70 p-2">
            <Users className="inline" /> {joined.length}/40
          </div>
          <div className="absolute bottom-[calc(4%+60px)] left-[2%] right-[2%] flex h-[58%] items-start justify-center overflow-hidden">
            {(() => {
              const sorted = [...joined].sort(
                (a, b) =>
                  Number(a.attendanceNumber) - Number(b.attendanceNumber),
              );
              const rows = [sorted.slice(0, 6)];
              for (let i = 6; i < sorted.length; i += 9)
                rows.push(sorted.slice(i, i + 9));
              const scale =
                joined.length <= 4 ? 1 : joined.length === 5 ? 0.9 : 0.82;
              return (
                <div className="flex max-w-full flex-col items-center gap-1">
                  {rows.map((row, ri) => (
                    <div key={ri} className="flex justify-center gap-1">
                      {row.map((s) => (
                        <div key={s.id} className="relative">
                          <BossWaitingParticipant
                            student={s}
                            label={s.nickname}
                            scale={scale}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>
      </div>
      {qrOpen && <div className="fixed inset-0 z-[300] grid place-items-center bg-black/75 p-4"><div className="relative rounded-2xl bg-white p-7 text-center text-slate-950"><button className="absolute right-3 top-3" onClick={()=>setQrOpen(false)}><X/></button><h2 className="mb-3 text-2xl font-black">학생 입장 QR 코드</h2><img className="mx-auto h-80 w-80" alt="방 입장 QR 코드" src={`https://api.qrserver.com/v1/create-qr-code/?size=640x640&data=${encodeURIComponent(`${window.location.origin}/student?code=${code}`)}`}/><div className="mt-3 font-mono text-3xl font-black">{code}</div><p className="mt-2 text-sm text-slate-600">QR 스캔 후 닉네임 설정 화면으로 바로 이동합니다.</p></div></div>}
    </main>
  );
}
