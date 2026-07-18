"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuizQuestion } from "@/lib/types";

type Props = {
  question: QuizQuestion;
  disabled?: boolean;
  onSubmit: (a: any) => void;
  reveal?: boolean;
  submittedAnswer?: any;
  isCorrect?: boolean;
};
export function BossQuestionPanel({
  question,
  disabled,
  onSubmit,
  reveal = false,
  submittedAnswer,
  isCorrect,
}: Props) {
  const [sel, setSel] = useState<number[]>([]),
    [text, setText] = useState("");
  useEffect(() => {
    setSel([]);
    setText("");
  }, [question.id]);
  useEffect(() => {
    if (!submittedAnswer) return;
    setSel((submittedAnswer.selectedOptions || []).map(Number));
    setText(submittedAnswer.textAnswer || "");
  }, [submittedAnswer]);
  const multi = question.type === "multiple",
    correct = new Set((question.correctAnswers || []).map(Number));
  return (
    <div className="rounded-xl border-2 border-amber-500 bg-amber-50/95 p-3 text-slate-900 shadow-2xl">
      <div className="mb-2 text-center text-lg font-bold">{question.text}</div>
      {question.type === "single" || question.type === "multiple" ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {(question.options || []).map((o, i) => {
            const picked = sel.includes(i),
              right = correct.has(i),
              wrongPicked = reveal && picked && !right;
            const cls = reveal
              ? right
                ? "border-green-700 bg-green-200 text-green-950"
                : wrongPicked
                  ? "border-red-700 bg-red-200 text-red-950"
                  : "border-slate-300 bg-slate-100 text-slate-500"
              : picked
                ? "border-indigo-600 bg-indigo-100"
                : "border-amber-200 bg-white";
            return (
              <button
                key={i}
                disabled={disabled || reveal}
                onClick={() =>
                  setSel((v) =>
                    multi
                      ? v.includes(i)
                        ? v.filter((x) => x !== i)
                        : [...v, i]
                      : [i],
                  )
                }
                className={`rounded-lg border-2 p-2.5 text-left font-semibold ${cls}`}
              >
                {i + 1}. {o}
                {reveal && right && (
                  <span className="float-right font-black">정답</span>
                )}
                {wrongPicked && (
                  <span className="float-right font-black">내가 선택</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <input
            disabled={disabled || reveal}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`w-full rounded-lg border-2 p-2.5 ${reveal ? (isCorrect ? "border-green-700 bg-green-100" : "border-red-700 bg-red-100") : ""}`}
            placeholder="정답 입력"
          />
          {reveal && (
            <div className="mt-2 rounded-lg bg-green-100 p-3 font-bold text-green-900">
              정답: {(question.shortAnswers || []).join(", ")}
            </div>
          )}
        </div>
      )}
      {!reveal && (
        <Button
          disabled={
            disabled || (question.type === "short" ? !text : sel.length === 0)
          }
          className="mt-3 w-full bg-amber-600 hover:bg-amber-700"
          onClick={() =>
            onSubmit(
              question.type === "short"
                ? { textAnswer: text }
                : { selectedOptions: sel },
            )
          }
        >
          정답 제출
        </Button>
      )}
      {reveal && (
        <div
          className={`mt-3 text-center text-xl font-black ${isCorrect ? "text-green-700" : "text-red-700"}`}
        >
          {isCorrect ? "정답입니다!" : "오답입니다."}
        </div>
      )}
    </div>
  );
}
