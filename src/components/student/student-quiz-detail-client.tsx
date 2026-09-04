"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Send, Trophy } from "lucide-react";
import { StudentShell } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number | null;
  explanation: string | null;
};

type Quiz = {
  id: string;
  title: string;
  mapel: string;
  description: string | null;
  teacherName: string;
  questions: QuizQuestion[];
};

type Attempt = {
  id: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  submittedAt: string;
  answers: {
    questionId: string;
    selectedOptionIndex: number;
    isCorrect: boolean;
  }[];
};

type Props = {
  student: {
    name: string;
    className: string;
    jenjang: string;
    tahunAjaran: string;
  };
  quiz: Quiz;
  attempt: Attempt | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatScore(score: number) {
  return Number(score.toFixed(1));
}

export function StudentQuizDetailClient({ student, quiz, attempt }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentAttempt, setCurrentAttempt] = useState(attempt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const answerMap = useMemo(() => {
    return new Map(
      currentAttempt?.answers.map((answer) => [answer.questionId, answer]) ?? []
    );
  }, [currentAttempt]);

  const submitQuiz = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/student/quizzes/${quiz.id}/attempt`, {
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
        submittedAt: data.attempt.submittedAt,
        answers: data.attempt.answers,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan quiz");
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudentShell>
      <div className="space-y-5">
        <Button variant="ghost" asChild className="-ml-3 rounded-2xl">
          <Link href="/student">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Portal Siswa
          </Link>
        </Button>

        <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_24px_70px_rgba(15,76,129,0.09)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 lg:p-8">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                {quiz.mapel}
              </Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                {quiz.title}
              </h1>
              {quiz.description ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                  {quiz.description}
                </p>
              ) : null}
            </div>
            <div className="border-t border-blue-50 bg-gradient-to-br from-emerald-600 to-teal-400 p-6 text-white lg:border-l lg:border-t-0 lg:p-8">
              <div className="grid gap-4">
                <div className="rounded-3xl bg-white/15 p-4 backdrop-blur">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/70">
                    Kelas
                  </p>
                  <p className="mt-2 text-xl font-black">{student.className}</p>
                  <p className="mt-1 text-sm text-white/75">
                    {student.jenjang.toUpperCase()} · TA {student.tahunAjaran}
                  </p>
                </div>
                <div className="rounded-3xl bg-white/15 p-4 backdrop-blur">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/70">
                    Guru
                  </p>
                  <p className="mt-2 text-xl font-black">{quiz.teacherName}</p>
                </div>
                <div className="rounded-3xl bg-white/15 p-4 backdrop-blur">
                  <p className="text-sm font-bold">{quiz.questions.length} soal pilihan ganda</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {currentAttempt ? (
          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Sudah dikerjakan
                </Badge>
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Dikirim pada {formatDate(currentAttempt.submittedAt)}
                </p>
              </div>
              <div className="rounded-3xl bg-emerald-50 px-6 py-4 text-center">
                <Trophy className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
                <p className="text-3xl font-black text-emerald-700">
                  {formatScore(currentAttempt.score)}
                </p>
                <p className="text-xs font-bold text-slate-500">
                  {currentAttempt.correctCount}/{currentAttempt.totalQuestions} benar
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={submitQuiz} className="space-y-4">
          {quiz.questions.map((question, questionIndex) => {
            const attemptAnswer = answerMap.get(question.id);
            return (
              <Card
                key={question.id}
                className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]"
              >
                <CardHeader>
                  <CardTitle className="text-base font-extrabold text-slate-950">
                    Soal {questionIndex + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-line text-sm font-bold leading-7 text-slate-950">
                    {question.prompt}
                  </p>
                  <div className="grid gap-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = currentAttempt
                        ? attemptAnswer?.selectedOptionIndex === optionIndex
                        : answers[question.id] === optionIndex;
                      const correct = currentAttempt && question.correctOptionIndex === optionIndex;
                      return (
                        <button
                          key={optionIndex}
                          type="button"
                          disabled={Boolean(currentAttempt)}
                          onClick={() =>
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: optionIndex,
                            }))
                          }
                          className={`flex items-start gap-3 rounded-2xl border p-4 text-left text-sm transition ${
                            correct
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : selected
                                ? "border-blue-300 bg-emerald-50 text-emerald-800"
                                : "border-slate-100 bg-slate-50 text-slate-700 hover:border-emerald-200"
                          }`}
                        >
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white text-xs font-black">
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span className="leading-6">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                  {currentAttempt && question.explanation ? (
                    <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                      {question.explanation}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}

          {!currentAttempt ? (
            <Button
              type="submit"
              disabled={
                saving ||
                quiz.questions.some((question) => answers[question.id] === undefined)
              }
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Kumpulkan Quiz
            </Button>
          ) : null}
        </form>
      </div>
    </StudentShell>
  );
}
