"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Loader2,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { StudentShell } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number | null;
  explanation: string | null;
};

type Attempt = {
  id: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;
  submittedAt: string;
  answers: Array<{
    questionId: string;
    selectedOptionIndex: number;
    isCorrect: boolean;
  }>;
};

type Props = {
  dateKey: string;
  dateLabel: string;
  streak: number;
  quiz: {
    id: string;
    title: string;
    theme: string;
    description: string | null;
    questionCount: number;
    questions: Question[];
  } | null;
  attempt: Attempt | null;
};

export function StudentDailyQuizClient({
  dateKey,
  dateLabel,
  streak: initialStreak,
  quiz,
  attempt: initialAttempt,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [currentAttempt, setCurrentAttempt] = useState(initialAttempt);
  const [questions, setQuestions] = useState(quiz?.questions ?? []);
  const [streak, setStreak] = useState(initialStreak);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const answerMap = useMemo(() => {
    return new Map(
      currentAttempt?.answers.map((answer) => [answer.questionId, answer]) ?? []
    );
  }, [currentAttempt]);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = quiz ? answeredCount === quiz.questions.length : false;

  const submitQuiz = async () => {
    if (!quiz) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/student/daily-quiz/${quiz.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: quiz.questions.map((question) => ({
            questionId: question.id,
            selectedOptionIndex: answers[question.id],
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan quiz");
      setCurrentAttempt({
        id: data.attempt.id,
        score: data.attempt.score,
        correctCount: data.attempt.correctCount,
        totalQuestions: data.attempt.totalQuestions,
        xpEarned: data.attempt.xpEarned,
        submittedAt: data.attempt.submittedAt,
        answers: data.attempt.answers,
      });
      if (typeof data.streak === "number") setStreak(data.streak);
      if (Array.isArray(data.reviewQuestions)) {
        setQuestions((prev) =>
          prev.map((question) => {
            const review = data.reviewQuestions.find(
              (item: { id: string }) => item.id === question.id
            );
            return review
              ? {
                  ...question,
                  correctOptionIndex: review.correctOptionIndex,
                  explanation: review.explanation,
                }
              : question;
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan quiz");
    } finally {
      setSaving(false);
    }
  };

  if (!quiz) {
    return (
      <StudentShell>
        <section className="rounded-[28px] border border-emerald-100 bg-white p-8 text-center shadow-[0_20px_56px_rgba(15,76,129,0.08)]">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">
            Quiz Harian Nasional
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Belum ada quiz untuk {dateLabel}. Cek lagi nanti setelah Super Admin
            mempublikasikan soal hari ini.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700">
            <Flame className="h-4 w-4" />
            Streak {streak} hari
          </div>
        </section>
      </StudentShell>
    );
  }

  const currentQuestion = questions[step];
  const done = Boolean(currentAttempt);

  return (
    <StudentShell>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-gradient-to-br from-indigo-600 via-sky-600 to-teal-400 p-6 text-white shadow-[0_24px_70px_rgba(15,76,129,0.18)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                Nasional · 1 quiz / hari
              </p>
              <h1 className="mt-1 text-2xl font-black">{quiz.title}</h1>
              <p className="mt-2 text-sm text-white/85">
                {dateLabel} · tema {quiz.theme}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white hover:bg-white/15">
                <Flame className="mr-1 h-3.5 w-3.5" />
                Streak {streak}
              </Badge>
              <Badge className="bg-white/15 text-white hover:bg-white/15">
                {quiz.questionCount} soal
              </Badge>
            </div>
          </div>
          {quiz.description ? (
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/90">
              {quiz.description}
            </p>
          ) : null}
        </section>

        {done && currentAttempt ? (
          <Card className="rounded-[24px] border-emerald-100 bg-white">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Selesai! Nilai {Number(currentAttempt.score.toFixed(1))}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Benar {currentAttempt.correctCount}/
                    {currentAttempt.totalQuestions} · +{currentAttempt.xpEarned}{" "}
                    XP · streak {streak} hari
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Kamu sudah main quiz {dateKey}. Kembali lagi besok untuk jaga
                streak.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!done && currentQuestion ? (
          <Card className="rounded-[24px] border-emerald-100 bg-white">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline">
                  Soal {step + 1} / {questions.length}
                </Badge>
                <p className="text-xs font-semibold text-slate-500">
                  {answeredCount}/{questions.length} terjawab
                </p>
              </div>
              <h2 className="text-lg font-black leading-7 text-slate-950">
                {currentQuestion.prompt}
              </h2>
              <div className="grid gap-2">
                {currentQuestion.options.map((option, index) => {
                  const selected = answers[currentQuestion.id] === index;
                  return (
                    <button
                      key={`${currentQuestion.id}-${index}`}
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.id]: index,
                        }))
                      }
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        selected
                          ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  disabled={step === 0}
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                >
                  Sebelumnya
                </Button>
                {step < questions.length - 1 ? (
                  <Button
                    className="rounded-2xl"
                    disabled={answers[currentQuestion.id] === undefined}
                    onClick={() =>
                      setStep((value) =>
                        Math.min(questions.length - 1, value + 1)
                      )
                    }
                  >
                    Lanjut
                  </Button>
                ) : (
                  <Button
                    className="rounded-2xl"
                    disabled={!allAnswered || saving}
                    onClick={() => void submitQuiz()}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Kirim jawaban
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {done ? (
          <div className="space-y-3">
            {questions.map((question, index) => {
              const answer = answerMap.get(question.id);
              return (
                <Card
                  key={question.id}
                  className="rounded-[22px] border-emerald-100 bg-white"
                >
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Soal {index + 1}</Badge>
                      {answer?.isCorrect ? (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Benar
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50">
                          Salah
                        </Badge>
                      )}
                    </div>
                    <p className="font-bold text-slate-900">{question.prompt}</p>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {question.options.map((option, optIndex) => {
                        const isCorrect =
                          question.correctOptionIndex === optIndex;
                        const isSelected =
                          answer?.selectedOptionIndex === optIndex;
                        return (
                          <li
                            key={`${question.id}-r-${optIndex}`}
                            className={
                              isCorrect
                                ? "font-semibold text-emerald-700"
                                : isSelected
                                  ? "text-rose-600"
                                  : undefined
                            }
                          >
                            {option}
                          </li>
                        );
                      })}
                    </ul>
                    {question.explanation ? (
                      <p className="text-sm text-slate-500">
                        {question.explanation}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </div>
    </StudentShell>
  );
}
