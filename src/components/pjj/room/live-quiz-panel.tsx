"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { ClipboardList, Loader2, Plus, Rocket, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { encodeRoomData } from "@/components/pjj/room/live-room-data";
import { readResponseJson } from "@/lib/http-json";
import { normalizeMcqOptions } from "@/lib/mcq-options";

type QuizQuestion = {
  id?: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  points: number;
};

type QuizSummary = {
  id: string;
  title: string;
  status: string;
  durationSec: number;
  launchedAt?: string | null;
  questions: QuizQuestion[];
  submittedCount?: number;
};

type QuizResult = {
  studentName: string;
  score: number;
  status: string;
};

type DraftQuestion = {
  prompt: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  points: number;
};

function emptyQuestion(): DraftQuestion {
  return {
    prompt: "",
    options: ["", "", "", ""],
    correctOptionIndex: 0,
    points: 1,
  };
}

export function LiveQuizPanel({
  liveSessionId,
  isModerator,
  onActiveQuizChange,
}: {
  liveSessionId: string;
  isModerator: boolean;
  onActiveQuizChange?: (quiz: QuizSummary | null) => void;
}) {
  const room = useRoomContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizSummary | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [title, setTitle] = useState("Kuis cepat");
  const [durationSec, setDurationSec] = useState(120);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([
    emptyQuestion(),
  ]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/quizzes`, {
        cache: "no-store",
      });
      const data = await readResponseJson<{
        quizzes?: QuizSummary[];
        activeQuiz?: QuizSummary | null;
      }>(response);
      if (!response.ok) throw new Error(data.error || "Gagal memuat kuis.");
      setQuizzes(data.quizzes || []);
      setActiveQuiz(data.activeQuiz || null);
      onActiveQuizChange?.(data.activeQuiz || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat kuis.");
    } finally {
      setLoading(false);
    }
  }, [liveSessionId, onActiveQuizChange]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function publishQuizEvent(
    type: "quiz:launch" | "quiz:close" | "quiz:update",
    quizId: string
  ) {
    try {
      await room.localParticipant.publishData(
        encodeRoomData({ type, quizId }),
        { reliable: true }
      );
    } catch {
      // ignore
    }
  }

  async function createQuiz() {
    setBusy(true);
    setMessage(null);
    try {
      const questions = draftQuestions
        .map((item) => {
          const normalized = normalizeMcqOptions(item.options, item.correctOptionIndex);
          if (!normalized || !item.prompt.trim()) return null;
          return {
            prompt: item.prompt.trim(),
            options: normalized.options,
            correctOptionIndex: normalized.correctOptionIndex,
            points: item.points,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      if (questions.length === 0) {
        throw new Error("Minimal satu soal dengan 2 opsi.");
      }
      for (const question of questions) {
        if (question.correctOptionIndex >= question.options.length) {
          throw new Error("Index jawaban benar tidak valid.");
        }
      }
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/quizzes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, durationSec, questions }),
      });
      const data = await readResponseJson(response);
      if (!response.ok) throw new Error(data.error || "Gagal membuat kuis.");
      setTitle("Kuis cepat");
      setDraftQuestions([emptyQuestion()]);
      setMessage("Draft kuis disimpan.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat kuis.");
    } finally {
      setBusy(false);
    }
  }

  async function launchQuiz(quizId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/pjj/sessions/${liveSessionId}/quizzes/${quizId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "launch" }),
        }
      );
      const data = await readResponseJson(response);
      if (!response.ok) throw new Error(data.error || "Gagal meluncurkan kuis.");
      await publishQuizEvent("quiz:launch", quizId);
      setMessage("Kuis diluncurkan ke peserta.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal meluncurkan.");
    } finally {
      setBusy(false);
    }
  }

  async function closeQuiz(quizId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/pjj/sessions/${liveSessionId}/quizzes/${quizId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "close" }),
        }
      );
      const data = await readResponseJson(response);
      if (!response.ok) throw new Error(data.error || "Gagal menutup kuis.");
      await publishQuizEvent("quiz:close", quizId);
      setMessage("Kuis ditutup.");
      await load();
      await loadResults(quizId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menutup kuis.");
    } finally {
      setBusy(false);
    }
  }

  async function loadResults(quizId: string) {
    try {
      const response = await fetch(
        `/api/pjj/sessions/${liveSessionId}/quizzes/${quizId}/results`,
        { cache: "no-store" }
      );
      const data = await readResponseJson<{ results?: QuizResult[] }>(response);
      if (!response.ok) throw new Error(data.error || "Gagal memuat rekap.");
      setResults(
        (data.results || []).map(
          (item) => ({
            studentName: item.studentName,
            score: item.score,
            status: item.status,
          })
        )
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat rekap.");
    }
  }

  const liveSubmitted = activeQuiz?.submittedCount ?? 0;

  if (!isModerator) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
        Kuis live dikontrol oleh guru. Overlay muncul otomatis saat diluncurkan.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-10 text-slate-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">Kuis berpoin</p>
          <p className="text-[11px] text-slate-400">MCQ in-live · skor 0–100</p>
        </div>
        {activeQuiz ? (
          <Badge className="bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/20">
            LIVE · {liveSubmitted} submit
          </Badge>
        ) : null}
      </div>

      {message ? (
        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200">
          {message}
        </div>
      ) : null}

      {activeQuiz ? (
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-3">
          <p className="text-sm font-bold text-white">{activeQuiz.title}</p>
          <p className="mt-1 text-xs text-cyan-100">
            {activeQuiz.questions.length} soal · {activeQuiz.durationSec}s ·{" "}
            {liveSubmitted} sudah submit
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white"
              disabled={busy}
              onClick={() => void loadResults(activeQuiz.id)}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Refresh rekap
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white"
              disabled={busy}
              onClick={() => void closeQuiz(activeQuiz.id)}
            >
              <Square className="h-3.5 w-3.5" />
              Tutup kuis
            </Button>
          </div>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
            Rekap skor
          </p>
          {results.map((item) => (
            <div
              key={`${item.studentName}-${item.score}`}
              className="flex items-center justify-between text-sm text-white"
            >
              <span className="truncate">{item.studentName}</span>
              <span className="font-bold">{item.score}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/80 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
          Buat kuis baru
        </p>
        <div className="space-y-2">
          <Label htmlFor="quizTitle" className="text-slate-200">
            Judul
          </Label>
          <Input
            id="quizTitle"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="border-white/15 bg-slate-950 text-white placeholder:text-slate-500 sm:bg-slate-950 sm:text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quizDuration" className="text-slate-200">
            Durasi (detik)
          </Label>
          <Input
            id="quizDuration"
            type="number"
            min={15}
            max={3600}
            value={durationSec}
            onChange={(event) => setDurationSec(Number(event.target.value) || 120)}
            className="border-white/15 bg-slate-950 text-white placeholder:text-slate-500 sm:bg-slate-950 sm:text-white"
          />
        </div>
        {draftQuestions.map((question, index) => (
          <div
            key={`draft-${index}`}
            className="space-y-2 rounded-xl border border-white/10 bg-slate-950/50 p-3"
          >
            <Label className="text-slate-200">Soal {index + 1}</Label>
            <Textarea
              value={question.prompt}
              onChange={(event) =>
                setDraftQuestions((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, prompt: event.target.value } : item
                  )
                )
              }
              rows={2}
              className="border-white/15 bg-slate-950 text-white placeholder:text-slate-500 sm:bg-slate-950 sm:text-white"
            />
            {question.options.map((option, optionIndex) => (
              <div key={`opt-${index}-${optionIndex}`} className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={
                    question.correctOptionIndex === optionIndex
                      ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-50 hover:bg-cyan-400/30 hover:text-white"
                      : "border-white/15 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
                  }
                  onClick={() =>
                    setDraftQuestions((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, correctOptionIndex: optionIndex }
                          : item
                      )
                    )
                  }
                >
                  {String.fromCharCode(65 + optionIndex)}
                </Button>
                <Input
                  value={option}
                  placeholder={`Opsi ${optionIndex + 1}`}
                  onChange={(event) =>
                    setDraftQuestions((current) =>
                      current.map((item, i) => {
                        if (i !== index) return item;
                        const options = [...item.options] as DraftQuestion["options"];
                        options[optionIndex] = event.target.value;
                        return { ...item, options };
                      })
                    )
                  }
                  className="border-white/15 bg-slate-950 text-white placeholder:text-slate-500 sm:bg-slate-950 sm:text-white"
                />
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white"
            onClick={() =>
              setDraftQuestions((current) => [...current, emptyQuestion()])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah soal
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void createQuiz()}>
            Simpan draft
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
          Draft tersimpan
        </p>
        {quizzes.length === 0 ? (
          <p className="text-xs text-slate-400">Belum ada kuis.</p>
        ) : (
          quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{quiz.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {quiz.status} · {quiz.questions.length} soal · {quiz.durationSec}s
                  </p>
                </div>
                {quiz.status === "DRAFT" || quiz.status === "CLOSED" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || Boolean(activeQuiz)}
                    onClick={() => void launchQuiz(quiz.id)}
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    Luncurkan
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function LiveStudentQuizOverlay({
  liveSessionId,
  activeQuiz,
  onDismissed,
}: {
  liveSessionId: string;
  activeQuiz: {
    id: string;
    title: string;
    durationSec: number;
    launchedAt?: string | null;
    questions: Array<{
      id: string;
      prompt: string;
      options: string[];
      points: number;
    }>;
    myAttempt?: { status: string; score: number } | null;
  } | null;
  onDismissed?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<number | null>(
    activeQuiz?.myAttempt?.status === "SUBMITTED"
      ? activeQuiz.myAttempt.score
      : null
  );
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setAnswers({});
    setScore(
      activeQuiz?.myAttempt?.status === "SUBMITTED"
        ? activeQuiz.myAttempt.score
        : null
    );
    setError(null);
  }, [activeQuiz?.id, activeQuiz?.myAttempt?.status, activeQuiz?.myAttempt?.score]);

  const remainingSec = useMemo(() => {
    if (!activeQuiz?.launchedAt) return activeQuiz?.durationSec ?? 0;
    const ends =
      new Date(activeQuiz.launchedAt).getTime() + activeQuiz.durationSec * 1000;
    return Math.max(0, Math.ceil((ends - now) / 1000));
  }, [activeQuiz, now]);

  if (!activeQuiz) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await fetch(
        `/api/pjj/sessions/${liveSessionId}/quizzes/${activeQuiz!.id}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        }
      );
      const payload = {
        action: "submit",
        answers: activeQuiz!.questions.map((question) => ({
          questionId: question.id,
          selectedIndex: answers[question.id] ?? 0,
        })),
      };
      const response = await fetch(
        `/api/pjj/sessions/${liveSessionId}/quizzes/${activeQuiz!.id}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await readResponseJson<{ attempt?: { score: number } }>(response);
      if (!response.ok) throw new Error(data.error || "Gagal mengirim jawaban.");
      setScore(data.attempt?.score ?? 0);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Gagal mengirim."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-400/30 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">
              Kuis live
            </p>
            <h2 className="mt-1 text-xl font-black text-white">{activeQuiz.title}</h2>
          </div>
          <Badge className="bg-amber-500/20 text-amber-100 hover:bg-amber-500/20">
            {remainingSec}s
          </Badge>
        </div>

        {score !== null ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-center">
            <p className="text-sm text-emerald-100">Skor Anda</p>
            <p className="mt-2 text-4xl font-black text-white">{score}</p>
            <Button
              type="button"
              className="mt-4"
              variant="secondary"
              onClick={() => onDismissed?.()}
            >
              Tutup
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {activeQuiz.questions.map((question, index) => (
              <div
                key={question.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="text-sm font-bold text-white">
                  {index + 1}. {question.prompt}
                </p>
                <div className="mt-3 space-y-2">
                  {(question.options || []).map((option, optionIndex) => {
                    const selected = answers[question.id] === optionIndex;
                    return (
                      <button
                        key={`${question.id}-${optionIndex}`}
                        type="button"
                        className={`flex w-full rounded-xl border px-3 py-2 text-left text-sm ${
                          selected
                            ? "border-cyan-300 bg-cyan-400/20 text-white"
                            : "border-white/10 bg-slate-950/40 text-slate-200"
                        }`}
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: optionIndex,
                          }))
                        }
                      >
                        <span className="mr-2 font-bold">
                          {String.fromCharCode(65 + optionIndex)}.
                        </span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <Button
              type="button"
              className="w-full"
              disabled={busy || remainingSec <= 0}
              onClick={() => void submit()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Kirim jawaban
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
