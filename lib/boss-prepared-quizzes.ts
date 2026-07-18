import type { QuizQuestion } from "@/lib/types";
import q1 from "./boss-prepared-quizzes/law-basics.json";
import q2 from "./boss-prepared-quizzes/roles-of-law.json";
import q3 from "./boss-prepared-quizzes/constitution-rights.json";
import q4 from "./boss-prepared-quizzes/rights-violations.json";
import q5 from "./boss-prepared-quizzes/rights-solutions.json";
import q6 from "./boss-prepared-quizzes/rights-practice.json";

export interface PreparedBossQuizGroup {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

function normalizeGroup(raw: { title: string; questions: any[] }, groupIndex: number): PreparedBossQuizGroup {
  const groupId = `haetae-prepared-${groupIndex + 1}`;
  return {
    id: groupId,
    title: raw.title,
    questions: raw.questions.map((question, questionIndex) => ({
      id: `${groupId}-q${questionIndex + 1}`,
      quizId: groupId,
      order: question.order ?? questionIndex + 1,
      type: question.type,
      text: question.text,
      points: question.points ?? 10,
      options: question.options ?? [],
      correctAnswers: question.correctAnswers ?? [],
      shortAnswers: question.shortAnswers ?? [],
      hint: question.hint ?? "",
    })),
  };
}

export const HAETAE_PREPARED_QUIZ_GROUPS: PreparedBossQuizGroup[] = [
  normalizeGroup(q1, 0),
  normalizeGroup(q2, 1),
  normalizeGroup(q3, 2),
  normalizeGroup(q4, 3),
  normalizeGroup(q5, 4),
  normalizeGroup(q6, 5),
];

export const HAETAE_PREPARED_QUESTIONS = HAETAE_PREPARED_QUIZ_GROUPS.flatMap(
  (group) => group.questions,
);

export const HAETAE_PREPARED_QUESTION_COUNT = HAETAE_PREPARED_QUESTIONS.length;
