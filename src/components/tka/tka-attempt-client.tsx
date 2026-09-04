"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, CheckCircle2, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Question = { id: string; type: string; stimulus: string | null; prompt: string; options: string[] };
type ReviewItem = { questionId: string; prompt: string; options: string[]; correctAnswers: number[]; selectedAnswers: number[]; explanation: string | null };
type Result = { status: string; score: number; correctCount: number; totalQuestions: number; review?: ReviewItem[] };

export function TkaAttemptClient({ packageId, title, durationMinutes, questions, initialAttempt, initialAnswers, completedResult }: {
  packageId: string; title: string; durationMinutes: number; questions: Question[];
  initialAttempt: { id: string; expiresAt: string } | null;
  initialAnswers: Record<string, number[]>;
  completedResult: Result | null;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(initialAttempt);
  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(completedResult);
  const [busy, setBusy] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState(() => initialAttempt ? Math.max(0, Math.ceil((new Date(initialAttempt.expiresAt).getTime() - Date.now()) / 1000)) : durationMinutes * 60);
  const answeredCount = useMemo(() => Object.values(answers).filter((value) => value.length > 0).length, [answers]);

  useEffect(() => {
    if (!attempt || result) return;
    const timer = window.setInterval(() => setRemaining((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [attempt, result]);

  useEffect(() => {
    if (attempt && remaining === 0 && !result && !busy) void submit();
    // submit is intentionally triggered only at the timer boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, attempt, result]);

  async function start() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/student/tka/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId }) });
      const data = await response.json();
      if (response.ok) { setAttempt({ id: data.attempt.id, expiresAt: data.attempt.expiresAt }); setRemaining(Math.max(0, Math.ceil((new Date(data.attempt.expiresAt).getTime() - Date.now()) / 1000))); }
      else setMessage(data.error || "Gagal memulai simulasi.");
    } catch { setMessage("Koneksi terputus saat memulai simulasi. Coba kembali."); }
    finally { setBusy(false); }
  }

  async function choose(question: Question, option: number) {
    if (!attempt || busy || savingQuestionId) return;
    const current = answers[question.id] ?? [];
    const selected = question.type === "SINGLE_CHOICE" ? [option] : current.includes(option) ? current.filter((item) => item !== option) : [...current, option].sort((a, b) => a - b);
    setAnswers((state) => ({ ...state, [question.id]: selected }));
    setSavingQuestionId(question.id);
    try {
      const response = await fetch(`/api/student/tka/attempts/${attempt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SAVE", questionId: question.id, selectedAnswers: selected }) });
      if (!response.ok) { const data = await response.json(); setAnswers((state) => ({ ...state, [question.id]: current })); setMessage(data.error || "Jawaban belum tersimpan."); }
    } catch { setAnswers((state) => ({ ...state, [question.id]: current })); setMessage("Koneksi terputus. Jawaban terakhir belum tersimpan."); }
    finally { setSavingQuestionId(null); }
  }

  async function submit() {
    if (!attempt || busy) return;
    if (remaining > 0 && answeredCount < questions.length && !window.confirm(`Baru ${answeredCount} dari ${questions.length} soal dijawab. Tetap kumpulkan?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/student/tka/attempts/${attempt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SUBMIT" }) });
      const data = await response.json();
      if (response.ok) setResult(data.result); else setMessage(data.error || "Gagal mengumpulkan jawaban.");
    } catch { setMessage("Koneksi terputus saat mengumpulkan. Jawaban yang telah tersimpan tetap aman."); }
    finally { setBusy(false); }
  }

  if (result) return <div className="space-y-5"><Card className="rounded-[30px] border-emerald-200 bg-emerald-50"><CardContent className="p-8 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /><p className="mt-4 text-sm font-extrabold uppercase tracking-widest text-emerald-700">Simulasi selesai</p><h1 className="mt-2 text-4xl font-black text-emerald-950">{result.score.toFixed(1)}</h1><p className="mt-2 text-sm text-emerald-900">{result.correctCount} benar dari {result.totalQuestions} soal. Nilai ini hasil simulasi, bukan nilai TKA resmi.</p><Button className="mt-6 rounded-xl" onClick={() => router.push("/student/tka")}>Kembali ke TKA</Button></CardContent></Card>{result.review?.length ? <Card className="rounded-[28px]"><CardContent className="space-y-4 p-6"><h2 className="text-xl font-black">Pembahasan jawaban</h2>{result.review.map((item, itemIndex) => <div key={item.questionId} className="rounded-2xl border p-4"><p className="font-bold">{itemIndex + 1}. {item.prompt}</p><div className="mt-3 space-y-2">{item.options.map((option, optionIndex) => { const correct = item.correctAnswers.includes(optionIndex); const selected = item.selectedAnswers.includes(optionIndex); return <div key={optionIndex} className={cn("rounded-xl px-3 py-2 text-sm", correct ? "bg-emerald-50 text-emerald-900" : selected ? "bg-rose-50 text-rose-900" : "bg-slate-50 text-slate-600")}><b>{String.fromCharCode(65 + optionIndex)}.</b> {option}{correct ? " · Kunci" : selected ? " · Jawabanmu" : ""}</div>; })}</div>{item.explanation ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-900"><b>Pembahasan:</b> {item.explanation}</p> : null}</div>)}</CardContent></Card> : null}</div>;

  if (!attempt) return <Card className="rounded-[30px]"><CardContent className="p-8 text-center"><AlarmClock className="mx-auto h-12 w-12 text-emerald-600" /><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-2 text-sm text-slate-600">{questions.length} soal · {durationMinutes} menit · jawaban tersimpan otomatis</p>{message && <p className="mt-4 text-sm font-bold text-red-600">{message}</p>}<Button size="lg" disabled={busy} onClick={start} className="mt-6 rounded-xl">Mulai simulasi</Button></CardContent></Card>;

  const question = questions[index];
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-white"><div><p className="text-xs text-slate-300">{title}</p><p className="font-black">Soal {index + 1} dari {questions.length}{savingQuestionId ? " · menyimpan…" : ""}</p></div><div className={cn("rounded-xl px-4 py-2 font-mono text-lg font-black", remaining < 300 ? "bg-red-600" : "bg-white/10")}><AlarmClock className="mr-2 inline h-5 w-5" />{minutes}:{seconds}</div></div>{message && <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{message}</div>}
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]"><Card className="h-fit rounded-[24px]"><CardContent className="p-4"><p className="mb-3 text-xs font-extrabold uppercase text-slate-500">Navigasi soal</p><div className="grid grid-cols-5 gap-2">{questions.map((item, number) => <button key={item.id} onClick={() => setIndex(number)} className={cn("h-9 rounded-lg text-xs font-black", number === index ? "bg-emerald-600 text-white" : (answers[item.id]?.length ?? 0) > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>{number + 1}</button>)}</div><p className="mt-4 text-xs font-bold text-slate-500">{answeredCount}/{questions.length} terjawab</p></CardContent></Card>
    <Card className="rounded-[28px]"><CardContent className="p-6 sm:p-8">{question.stimulus && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-7 text-slate-700">{question.stimulus}</div>}<h2 className="text-lg font-black leading-7 text-slate-950">{question.prompt}</h2><p className="mt-2 text-xs font-bold text-emerald-700">{question.type === "MULTIPLE_CHOICE" ? "Pilih semua jawaban yang benar." : "Pilih satu jawaban yang benar."}</p><div className="mt-5 space-y-3">{question.options.map((option, optionIndex) => { const checked = (answers[question.id] ?? []).includes(optionIndex); return <button type="button" key={optionIndex} onClick={() => choose(question, optionIndex)} className={cn("flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-sm font-semibold transition", checked ? "border-blue-600 bg-emerald-50 text-emerald-950 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-300")}><span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black", checked ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600")}>{String.fromCharCode(65 + optionIndex)}</span><span className="pt-1">{option}</span></button>; })}</div><div className="mt-7 flex items-center justify-between gap-3"><Button variant="outline" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ChevronLeft /> Sebelumnya</Button>{index < questions.length - 1 ? <Button onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}>Berikutnya <ChevronRight /></Button> : <Button disabled={busy} onClick={submit} className="bg-emerald-600 hover:bg-emerald-700"><Send /> Kumpulkan</Button>}</div></CardContent></Card></div>
  </div>;
}
