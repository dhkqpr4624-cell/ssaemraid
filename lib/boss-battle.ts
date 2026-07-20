import { supabase } from "./supabase";
import type { QuizQuestion, Student } from "./types";
import { REWARD_FOLDER_ITEMS } from "./reward-folder-items";

const enabled = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
export const BOSS_BATTLE_ID = "corrupted-haetae-social-5-1-u3";
export const BOSS_NAME = "타락한 해태";
export const MAX_BOSS_PLAYERS = 40;
export const PLAYER_MAX_HP = 100;
export const PLAYER_BASE_ATTACK = 10;
export const RPS_TIME_SECONDS = 20;
export const ANSWER_REVEAL_SECONDS = 7;
export const RPS_REVEAL_SECONDS = 5;
export const DEFENSE_REVEAL_SECONDS = 4;
export const REVIVE_REQUIRED_QUESTIONS = 3;

export type BossBattleStatus =
  | "waiting"
  | "entrance"
  | "roar"
  | "question"
  | "answer_reveal"
  | "rps"
  | "rps_reveal"
  | "player_attack"
  | "defense_reveal"
  | "boss_attack"
  | "student_hit"
  | "transition"
  | "defeated_transition"
  | "escaped_transition"
  | "defeated"
  | "escaped"
  | "wiped"
  | "result_ready"
  | "reward_ready"
  | "ended";
export type BossQuestionKind = "attack" | "defense";
export type BossAttackKind = "claw1" | "claw2" | "clawCombo" | "lightning";
export type RpsChoice = "rock" | "paper" | "scissors";

const BOSS_STATUS_ORDER: Record<BossBattleStatus, number> = {
  waiting: 0,
  entrance: 1,
  transition: 2,
  roar: 3,
  question: 10,
  answer_reveal: 11,
  rps: 12,
  rps_reveal: 13,
  player_attack: 14,
  defense_reveal: 12,
  boss_attack: 13,
  student_hit: 14,
  defeated_transition: 90,
  escaped_transition: 90,
  defeated: 91,
  escaped: 91,
  wiped: 91,
  result_ready: 92,
  reward_ready: 93,
  ended: 99,
};
export function isNewerBossSession(
  previous: BossBattleSession | null | undefined,
  next: BossBattleSession,
) {
  if (!previous || previous.id !== next.id) return true;
  // A teacher can end/reset a battle from any phase. A reset intentionally moves
  // the round back to 0 and the status back to waiting, so it must bypass the
  // normal forward-only status/round ordering check on student clients.
  if (next.status === "waiting" && previous.status !== "waiting") return true;
  if (next.currentRound > previous.currentRound) return true;
  if (next.currentRound < previous.currentRound) return false;
  const prevTime = new Date(previous.updatedAt || 0).getTime();
  const nextTime = new Date(next.updatedAt || 0).getTime();
  const prevOrder = BOSS_STATUS_ORDER[previous.status] ?? 0;
  const nextOrder = BOSS_STATUS_ORDER[next.status] ?? 0;
  if (nextOrder < prevOrder) return false;
  return nextTime >= prevTime || nextOrder >= prevOrder;
}

export interface BossRoundPlan {
  questionId: string;
  kind: BossQuestionKind;
}
export interface BossBattleSession {
  id: string;
  classCode: string;
  status: BossBattleStatus;
  bossId: string;
  bossName: string;
  questionCount: number;
  timeLimitSeconds: number;
  selectedQuestions: QuizQuestion[];
  roundPlan: BossRoundPlan[];
  currentRound: number;
  phaseStartedAt?: string;
  phaseEndsAt?: string;
  bossMaxHp: number;
  bossHp: number;
  maxPlayers: number;
  bossAttack?: BossAttackKind;
  lightningUnlocked?: boolean;
  defenseRoundsSinceLightning?: number;
  debugEvent?: string;
  bossRpsChoice?: RpsChoice;
  roundDamage?: number;
  victoryRewardItemId?: string;
  escapeRewardItemId?: string;
  rewardGranted?: boolean;
  avatarCustomizationEnabled?: boolean;
  paused?: boolean;
  pausedRemainingMs?: number;
  bossEndured?: boolean;
  bossNotice?: string;
  bossNoticeUntil?: string;
  bossHealAmount?: number;
  resultSnapshot?: BossResultSnapshotEntry[];
  createdAt: string;
  updatedAt: string;
}
export interface BossParticipantState {
  hp: number;
  maxHp: number;
  totalDamage: number;
  correctCount: number;
  attackCorrectCount: number;
  defenseSuccessCount: number;
  knockedOut: boolean;
  reviveProgress: number;
  reviveCount: number;
  lastDamage: number;
  lastResult?: string;
}
export interface BossBattleParticipant {
  sessionId: string;
  classCode: string;
  studentId: string;
  attendanceNumber: string;
  lastSeenAt: string;
  state: BossParticipantState;
}
export interface BossResultSnapshotEntry {
  studentId: string;
  attendanceNumber: string;
  nickname: string;
  avatarState?: any;
  items?: any[];
  state: BossParticipantState;
}
export interface BossBattleAnswer {
  sessionId: string;
  roundIndex: number;
  studentId: string;
  attendanceNumber: string;
  answer: any;
  isCorrect?: boolean;
  rpsChoice?: RpsChoice;
  submittedAt: string;
}

const defaultParticipantState = (): BossParticipantState => ({
  hp: 100,
  maxHp: 100,
  totalDamage: 0,
  correctCount: 0,
  attackCorrectCount: 0,
  defenseSuccessCount: 0,
  knockedOut: false,
  reviveProgress: 0,
  reviveCount: 0,
  lastDamage: 0,
});
function key(code: string) {
  return `bossBattle_${code.toUpperCase()}`;
}
function participantKey(code: string, sessionId: string) {
  return `${key(code)}_participants_${sessionId}`;
}
function answerKey(code: string, sessionId: string, round: number) {
  return `${key(code)}_answers_${sessionId}_${round}`;
}
function camel(row: any): BossBattleSession | null {
  if (!row) return null;
  const d = row.session_data || {};
  return {
    id: row.id,
    classCode: row.class_code,
    status: row.status,
    bossId: row.boss_id || d.bossId || BOSS_BATTLE_ID,
    bossName: row.boss_name || d.bossName || BOSS_NAME,
    questionCount: Number(row.question_count ?? d.questionCount ?? 10),
    timeLimitSeconds: Number(
      row.time_limit_seconds ?? d.timeLimitSeconds ?? 20,
    ),
    selectedQuestions: d.selectedQuestions || [],
    roundPlan: d.roundPlan || [],
    currentRound: Number(d.currentRound || 0),
    phaseStartedAt: d.phaseStartedAt,
    phaseEndsAt: d.phaseEndsAt,
    bossMaxHp: Number(row.boss_max_hp ?? d.bossMaxHp ?? 100),
    bossHp: Number(row.boss_hp ?? d.bossHp ?? 100),
    maxPlayers: Number(d.maxPlayers ?? MAX_BOSS_PLAYERS),
    bossAttack: d.bossAttack,
    lightningUnlocked: !!d.lightningUnlocked,
    defenseRoundsSinceLightning: Number(d.defenseRoundsSinceLightning || 0),
    debugEvent: d.debugEvent,
    bossRpsChoice: d.bossRpsChoice,
    roundDamage: Number(d.roundDamage || 0),
    victoryRewardItemId:
      d.victoryRewardItemId || "g5-s1-social-u3-pet-law-judge-haetae",
    escapeRewardItemId:
      d.escapeRewardItemId || "g5-s1-social-u3-face-haetae-tear",
    rewardGranted: !!d.rewardGranted,
    avatarCustomizationEnabled: d.avatarCustomizationEnabled !== false,
    paused: !!d.paused,
    pausedRemainingMs: Number(d.pausedRemainingMs || 0),
    bossEndured: !!d.bossEndured,
    bossNotice: d.bossNotice,
    bossNoticeUntil: d.bossNoticeUntil,
    bossHealAmount: Number(d.bossHealAmount || 0),
    resultSnapshot: Array.isArray(d.resultSnapshot) ? d.resultSnapshot : undefined,
    createdAt: row.created_at || d.createdAt,
    updatedAt: row.updated_at || d.updatedAt,
  };
}
export function buildRoundPlan(questions: QuizQuestion[]): BossRoundPlan[] {
  const out: BossRoundPlan[] = [];
  let i = 0;
  while (i < questions.length) {
    const attacks = Math.random() < 0.5 ? 1 : 2;
    for (let n = 0; n < attacks && i < questions.length; n++, i++)
      out.push({ questionId: questions[i].id, kind: "attack" });
    if (i < questions.length) {
      out.push({ questionId: questions[i].id, kind: "defense" });
      i++;
    }
  }
  // 보스는 모든 문제를 다 푼 뒤에만 쓰러질 수 있으므로 마지막 문제는 항상 공격 문제로 고정합니다.
  if (out.length > 0) out[out.length - 1] = { ...out[out.length - 1], kind: "attack" };
  return out;
}
// 15차 밸런스 기준값
const EXPECTED_ANSWER_RATE = 0.6;
// 승(2배), 무(1배), 패(0.5배)가 같은 확률일 때의 기대 배율: 7 / 6
const EXPECTED_RPS_MULTIPLIER = 7 / 6;
const BOSS_HP_EXPECTED_DAMAGE_FACTOR = 1.08;

function participantHpScale(playerCount: number) {
  if (playerCount >= 31) return 1.08;
  if (playerCount >= 21) return 1.05;
  if (playerCount >= 11) return 1.03;
  return 1;
}

export function calculateBossMaxHp(
  playerCount: number,
  attackQuestionCount: number,
) {
  // 문항 평균 정답률 60%와 가위바위보 기대 배율을 기준으로 예상 총 피해를 계산합니다.
  // 참가자가 많을수록 평균값이 안정되어 전투가 쉬워지는 현상을 완화하기 위해
  // 11~40명 구간에 3~8%의 완만한 HP 보정을 추가합니다.
  const normalizedPlayers = Math.max(1, Math.min(MAX_BOSS_PLAYERS, playerCount));
  const expectedDamage =
    normalizedPlayers *
    Math.max(1, attackQuestionCount) *
    PLAYER_BASE_ATTACK *
    EXPECTED_ANSWER_RATE *
    EXPECTED_RPS_MULTIPLIER;
  const scaledHp =
    expectedDamage *
    BOSS_HP_EXPECTED_DAMAGE_FACTOR *
    participantHpScale(normalizedPlayers);
  return Math.max(120, Math.round(scaledHp / 10) * 10);
}
export function normalizeText(text: string) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}
export function isBossAnswerCorrect(question: QuizQuestion, answer: any) {
  if (!question) return false;
  if (question.type === "single")
    return (
      Number(answer?.selectedOptions?.[0]) ===
      Number(question.correctAnswers?.[0])
    );
  if (question.type === "multiple") {
    const a = [...(answer?.selectedOptions || [])]
      .map(Number)
      .sort((x, y) => x - y);
    const b = [...(question.correctAnswers || [])]
      .map(Number)
      .sort((x, y) => x - y);
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (question.type === "short")
    return (question.shortAnswers || []).some(
      (x) => normalizeText(x) === normalizeText(answer?.textAnswer || ""),
    );
  return false;
}
export function rpsMultiplier(player: RpsChoice, boss: RpsChoice) {
  if (player === boss) return 1;
  const wins =
    (player === "rock" && boss === "scissors") ||
    (player === "paper" && boss === "rock") ||
    (player === "scissors" && boss === "paper");
  return wins ? 2 : 0.5;
}
export function randomRps(): RpsChoice {
  return (["rock", "paper", "scissors"] as RpsChoice[])[
    Math.floor(Math.random() * 3)
  ];
}
export function chooseBossAttack(session: BossBattleSession): BossAttackKind {
  const hpRate = session.bossMaxHp ? session.bossHp / session.bossMaxHp : 1;
  if (hpRate <= 0.5 && !session.lightningUnlocked) return "lightning";
  if (
    session.lightningUnlocked &&
    (session.defenseRoundsSinceLightning || 0) >= (Math.random() < 0.5 ? 1 : 2)
  )
    return "lightning";
  return (["claw1", "claw2", "clawCombo"] as BossAttackKind[])[
    Math.floor(Math.random() * 3)
  ];
}
export function bossAttackDamage(kind?: BossAttackKind) {
  return kind === "lightning" ? 35 : kind === "clawCombo" ? 20 : 10;
}

export async function getBossBattleSession(
  classCode: string,
): Promise<BossBattleSession | null> {
  const code = classCode.trim().toUpperCase();
  if (enabled) {
    const { data, error } = await supabase
      .from("boss_battle_sessions")
      .select("*")
      .eq("class_code", code)
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error) return camel(data);
    console.warn("[Boss Battle] session fallback:", error.message);
  }
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key(code));
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed?.status === "ended" ? null : parsed;
}
export async function saveBossBattleSession(
  classCode: string,
  input: Partial<BossBattleSession>,
) {
  const code = classCode.trim().toUpperCase(),
    existing = await getBossBattleSession(code),
    now = new Date().toISOString();
  const merged: BossBattleSession = {
    id: existing?.id || crypto.randomUUID?.() || `${code}_${Date.now()}`,
    classCode: code,
    status: "waiting",
    bossId: BOSS_BATTLE_ID,
    bossName: BOSS_NAME,
    questionCount: 10,
    timeLimitSeconds: 20,
    selectedQuestions: [],
    roundPlan: [],
    currentRound: 0,
    bossMaxHp: 100,
    bossHp: 100,
    maxPlayers: MAX_BOSS_PLAYERS,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    ...existing,
    ...input,
  };
  if (enabled) {
    const row = {
      id: merged.id,
      class_code: code,
      status: merged.status,
      boss_id: merged.bossId,
      boss_name: merged.bossName,
      question_count: merged.questionCount,
      time_limit_seconds: merged.timeLimitSeconds,
      boss_max_hp: merged.bossMaxHp,
      boss_hp: merged.bossHp,
      session_data: merged,
      updated_at: now,
    };
    const { data, error } = await supabase
      .from("boss_battle_sessions")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (!error) return camel(data)!;
    console.warn("[Boss Battle] save fallback:", error.message);
  }
  if (typeof window !== "undefined")
    localStorage.setItem(key(code), JSON.stringify(merged));
  return merged;
}
export function subscribeBossBattleRoom(
  classCode: string,
  sessionId: string | undefined,
  onChange: () => void,
) {
  if (!enabled || typeof window === "undefined") return () => {};
  const code = classCode.trim().toUpperCase();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const notify = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 80);
  };
  const channel = supabase
    .channel(`ssaemraid:${code}:${sessionId || "room"}:${Math.random()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "boss_battle_sessions", filter: `class_code=eq.${code}` }, notify)
    .on("postgres_changes", { event: "*", schema: "public", table: "raid_guests", filter: `room_code=eq.${code}` }, notify);
  if (sessionId) {
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "boss_battle_participants", filter: `session_id=eq.${sessionId}` }, notify)
      .on("postgres_changes", { event: "*", schema: "public", table: "boss_battle_answers", filter: `session_id=eq.${sessionId}` }, notify);
  }
  channel.subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}

export async function endBossBattleSession(
  classCode: string,
  session: BossBattleSession,
) {
  const ended = await saveBossBattleSession(classCode, {
    ...session,
    status: "ended",
  });
  await clearBossParticipants(session.id, classCode);
  if (typeof window !== "undefined") localStorage.removeItem(key(classCode));
  return ended;
}
export async function heartbeatBossParticipant(
  classCode: string,
  sessionId: string,
  attendanceNumber: number,
  studentId: string,
) {
  const code = classCode.trim().toUpperCase(),
    now = new Date().toISOString();
  if (enabled) {
    // 한 번의 RPC로 참가자 생성/heartbeat를 처리합니다. 기존 상태를 덮어쓰지 않아
    // 40명이 동시에 heartbeat를 보내도 SELECT+UPSERT 경쟁이 발생하지 않습니다.
    const { error } = await supabase.rpc("ssaemraid_heartbeat_participant", {
      p_session_id: sessionId,
      p_class_code: code,
      p_student_id: studentId,
      p_attendance_number: String(attendanceNumber),
      p_default_state: defaultParticipantState(),
    });
    if (!error) return true;
    console.warn("[Boss Battle] heartbeat fallback:", error.message);
  }
  if (typeof window !== "undefined") {
    const k = participantKey(code, sessionId),
      current = JSON.parse(localStorage.getItem(k) || "{}");
    current[studentId] = {
      attendanceNumber: String(attendanceNumber),
      lastSeenAt: now,
      state: current[studentId]?.state || defaultParticipantState(),
    };
    localStorage.setItem(k, JSON.stringify(current));
  }
  return true;
}
export async function getBossParticipants(
  classCode: string,
  sessionId: string,
  activeOnly = true,
): Promise<BossBattleParticipant[]> {
  const code = classCode.trim().toUpperCase(),
    cutoff = new Date(Date.now() - 60000).toISOString();
  if (enabled) {
    let query = supabase
      .from("boss_battle_participants")
      .select(
        "session_id,class_code,student_id,attendance_number,last_seen_at,participant_data",
      )
      .eq("session_id", sessionId);
    if (activeOnly) query = query.gte("last_seen_at", cutoff);
    const { data, error } = await query.order("attendance_number");
    if (!error)
      return (data || [])
        .map((x: any) => ({
          sessionId: x.session_id,
          classCode: x.class_code,
          studentId: x.student_id || "",
          attendanceNumber: String(x.attendance_number),
          lastSeenAt: x.last_seen_at,
          state: {
            ...defaultParticipantState(),
            ...(x.participant_data || {}),
          },
        }))
        .slice(0, MAX_BOSS_PLAYERS);
    console.warn("[Boss Battle] participants fallback:", error.message);
  }
  if (typeof window === "undefined") return [];
  const current = JSON.parse(
    localStorage.getItem(participantKey(code, sessionId)) || "{}",
  );
  return Object.entries(current)
    .map(([studentId, value]: any) => ({
      sessionId,
      classCode: code,
      studentId,
      attendanceNumber: String(value?.attendanceNumber || ""),
      lastSeenAt: String(value?.lastSeenAt || ""),
      state: { ...defaultParticipantState(), ...(value?.state || {}) },
    }))
    .filter(
      (p) =>
        !activeOnly || new Date(p.lastSeenAt).getTime() >= Date.now() - 60000,
    )
    .sort((a, b) => Number(a.attendanceNumber) - Number(b.attendanceNumber))
    .slice(0, MAX_BOSS_PLAYERS);
}
export async function hasBossParticipant(
  classCode: string,
  sessionId: string,
  studentId: string,
): Promise<boolean> {
  const code = classCode.trim().toUpperCase();
  if (!sessionId || !studentId) return false;
  if (enabled) {
    const { data, error } = await supabase
      .from("boss_battle_participants")
      .select("student_id")
      .eq("session_id", sessionId)
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle();
    if (!error) return !!data;
    console.warn("[Boss Battle] participant check fallback:", error.message);
  }
  if (typeof window === "undefined") return false;
  const current = JSON.parse(
    localStorage.getItem(participantKey(code, sessionId)) || "{}",
  );
  return !!current[studentId];
}
export async function updateBossParticipantState(
  classCode: string,
  sessionId: string,
  studentId: string,
  state: Partial<BossParticipantState>,
) {
  if (enabled) {
    const { error } = await supabase.rpc("ssaemraid_patch_participant_state", {
      p_session_id: sessionId,
      p_student_id: studentId,
      p_patch: state,
    });
    if (!error) return;
    console.warn("[Boss Battle] participant patch fallback:", error.message);
  }
  const all = await getBossParticipants(classCode, sessionId, false),
    p = all.find((x) => x.studentId === studentId);
  if (!p) return;
  const next = { ...p.state, ...state };
  if (typeof window !== "undefined") {
    const k = participantKey(classCode, sessionId),
      c = JSON.parse(localStorage.getItem(k) || "{}");
    if (c[studentId]) {
      c[studentId].state = next;
      localStorage.setItem(k, JSON.stringify(c));
    }
  }
}
export async function resetBossParticipantStates(
  classCode: string,
  sessionId: string,
) {
  const all = await getBossParticipants(classCode, sessionId, false);
  await Promise.all(
    all.map((p) =>
      updateBossParticipantState(
        classCode,
        sessionId,
        p.studentId,
        defaultParticipantState(),
      ),
    ),
  );
}
export async function submitBossAnswer(
  classCode: string,
  sessionId: string,
  roundIndex: number,
  studentId: string,
  attendanceNumber: string,
  answer: any,
  isCorrect?: boolean,
) {
  const now = new Date().toISOString();
  if (enabled) {
    const { error } = await supabase.from("boss_battle_answers").upsert(
      {
        session_id: sessionId,
        class_code: classCode.toUpperCase(),
        round_index: roundIndex,
        student_id: studentId,
        attendance_number: attendanceNumber,
        answer_data: answer,
        is_correct: isCorrect,
        submitted_at: now,
      },
      { onConflict: "session_id,round_index,student_id" },
    );
    if (!error) return true;
  }
  if (typeof window !== "undefined") {
    const k = answerKey(classCode, sessionId, roundIndex),
      c = JSON.parse(localStorage.getItem(k) || "{}");
    c[studentId] = {
      sessionId,
      roundIndex,
      studentId,
      attendanceNumber,
      answer,
      isCorrect,
      submittedAt: now,
    };
    localStorage.setItem(k, JSON.stringify(c));
  }
  return true;
}
export async function submitBossRps(
  classCode: string,
  sessionId: string,
  roundIndex: number,
  studentId: string,
  choice: RpsChoice,
) {
  if (enabled) {
    // 답안 upsert 직후 Realtime/네트워크 경합으로 update가 0행에 적용되는 경우를
    // 막기 위해 짧게 재시도합니다. 기존 answer_data를 덮지 않는 안전한 update입니다.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await supabase
        .from("boss_battle_answers")
        .update({ rps_choice: choice })
        .eq("session_id", sessionId)
        .eq("round_index", roundIndex)
        .eq("student_id", studentId)
        .select("student_id");
      if (!error && (data?.length || 0) > 0) return true;
      if (attempt < 3)
        await new Promise((resolve) => window.setTimeout(resolve, 120 * (attempt + 1)));
    }
  }
  if (typeof window !== "undefined") {
    const k = answerKey(classCode, sessionId, roundIndex),
      c = JSON.parse(localStorage.getItem(k) || "{}");
    if (c[studentId]) c[studentId].rpsChoice = choice;
    localStorage.setItem(k, JSON.stringify(c));
  }
  return true;
}
export async function getBossAnswers(
  classCode: string,
  sessionId: string,
  roundIndex: number,
): Promise<BossBattleAnswer[]> {
  if (enabled) {
    const { data, error } = await supabase
      .from("boss_battle_answers")
      .select("*")
      .eq("session_id", sessionId)
      .eq("round_index", roundIndex);
    if (!error)
      return (data || []).map((x: any) => ({
        sessionId: x.session_id,
        roundIndex: x.round_index,
        studentId: x.student_id,
        attendanceNumber: x.attendance_number,
        answer: x.answer_data,
        isCorrect: x.is_correct,
        rpsChoice: x.rps_choice,
        submittedAt: x.submitted_at,
      }));
  }
  if (typeof window === "undefined") return [];
  return Object.values(
    JSON.parse(
      localStorage.getItem(answerKey(classCode, sessionId, roundIndex)) || "{}",
    ),
  ) as BossBattleAnswer[];
}
export async function removeBossParticipant(
  classCode: string,
  sessionId: string,
  studentId: string,
) {
  if (enabled) {
    const { error } = await supabase
      .from("boss_battle_participants")
      .delete()
      .eq("session_id", sessionId)
      .eq("student_id", studentId);
    if (!error) return true;
  }
  if (typeof window !== "undefined") {
    const k = participantKey(classCode, sessionId),
      c = JSON.parse(localStorage.getItem(k) || "{}");
    delete c[studentId];
    localStorage.setItem(k, JSON.stringify(c));
  }
  return true;
}
export async function clearBossParticipants(
  sessionId: string,
  classCode?: string,
) {
  if (enabled)
    await supabase
      .from("boss_battle_participants")
      .delete()
      .eq("session_id", sessionId);
  if (typeof window !== "undefined" && classCode)
    localStorage.removeItem(participantKey(classCode, sessionId));
}
export function currentBossQuestion(session: BossBattleSession | null) {
  if (!session) return null;
  const plan = session.roundPlan?.[session.currentRound];
  return (
    session.selectedQuestions.find((q) => q.id === plan?.questionId) ||
    session.selectedQuestions[session.currentRound] ||
    null
  );
}
export function joinedStudents(
  participants: BossBattleParticipant[],
  students: Student[],
) {
  return participants
    .map(
      (p) =>
        students.find((s) => s.id === p.studentId) ||
        students.find((s) => String(s.attendanceNumber) === p.attendanceNumber),
    )
    .filter(Boolean) as Student[];
}

export async function grantBossBattleReward(
  session: BossBattleSession,
  participants: BossBattleParticipant[],
) {
  if (
    !enabled ||
    session.rewardGranted ||
    !["defeated", "escaped"].includes(session.status)
  )
    return false;
  const itemId =
    session.status === "defeated"
      ? session.victoryRewardItemId
      : session.escapeRewardItemId;
  const catalog = REWARD_FOLDER_ITEMS.find((x) => x.id === itemId);
  if (!catalog) return false;
  for (const p of participants) {
    const { data: row, error } = await supabase
      .from("students")
      .select("items")
      .eq("id", p.studentId)
      .maybeSingle();
    if (error || !row) continue;
    const items = Array.isArray(row.items) ? row.items : [];
    if (
      items.some(
        (x: any) =>
          x?.itemId === catalog.id ||
          x?.catalogItemId === catalog.id ||
          x?.id === catalog.id,
      )
    )
      continue;
    const item = {
      id: catalog.id,
      itemId: catalog.id,
      catalogItemId: catalog.id,
      name: catalog.name,
      type: catalog.type,
      slot: catalog.slot,
      icon: catalog.icon,
      iconUrl: catalog.iconUrl,
      imageUrl: catalog.imageUrl,
      spriteUrl: catalog.imageUrl,
      description: catalog.description,
      roomPetImageUrl: catalog.roomPetImageUrl,
      tintMaskUrl: catalog.tintMaskUrl,
      shadowImageUrl: catalog.shadowImageUrl,
      outlineImageUrl: catalog.outlineImageUrl,
      overlayImageUrl: catalog.overlayImageUrl,
      eyeShadowImageUrl: catalog.eyeShadowImageUrl,
      acquiredAt: new Date().toISOString(),
      source: `boss:${session.id}:${session.status}`,
    };
    await supabase
      .from("students")
      .update({ items: [...items, item] })
      .eq("id", p.studentId);
  }
  return true;
}
