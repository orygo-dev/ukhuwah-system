"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, CalendarClock, CheckCircle2, ListChecks, Loader2, Send } from "lucide-react";
import { StudentShell } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Assignment = {
  id: string;
  title: string;
  mapel: string;
  description: string;
  dueAt: string | null;
  submissionClosedAt: string | null;
  acceptsSubmission: boolean;
  isLate: boolean;
  teacherName: string;
  mode: "LEGACY_TEXT" | "QUESTION_SET";
  maxScore: number;
  allowLate: boolean;
  allowResubmit: boolean;
  questions: Array<{
    id: string;
    type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
    prompt: string;
    imageUrl: string | null;
    options: unknown;
    points: number;
    required: boolean;
    explanation: string | null;
    correctAnswer: unknown;
  }>;
};

type Submission = {
  id: string;
  answer: string;
  status: "SUBMITTED" | "LATE" | "GRADED" | "RETURNED";
  submittedAt: string;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
  version: number;
  answers: Array<{ questionId: string; response: unknown; score: number | null; feedback: string | null; autoGraded: boolean }>;
};

type Props = {
  student: {
    name: string;
    className: string;
    jenjang: string;
    tahunAjaran: string;
  };
  assignment: Assignment;
  submission: Submission | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).format(new Date(value));
}

function assignmentOption(value: unknown) {
  if (typeof value === "string") return { text: value, imageUrl: null as string | null };
  const option = value && typeof value === "object" ? value as { text?: unknown; imageUrl?: unknown } : {};
  return { text: typeof option.text === "string" ? option.text : "", imageUrl: typeof option.imageUrl === "string" ? option.imageUrl : null };
}

function submissionLabel(status: Submission["status"]) {
  if (status === "LATE") return "Terlambat";
  if (status === "GRADED") return "Sudah dinilai";
  if (status === "RETURNED") return "Dikembalikan";
  return "Sudah dikumpulkan";
}

export function StudentAssignmentDetailClient({ student, assignment, submission }: Props) {
  const [answer, setAnswer] = useState(submission?.answer ?? "");
  const [currentSubmission, setCurrentSubmission] = useState(submission);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() =>
    Object.fromEntries((submission?.answers ?? []).map((item) => [item.questionId, item.response]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isGraded = currentSubmission?.status === "GRADED";
  const isAutoGraded = Boolean(currentSubmission?.answers.length && currentSubmission.answers.every((answer) => answer.autoGraded));
  const isLocked = !assignment.acceptsSubmission || (isGraded && !(assignment.allowResubmit && isAutoGraded)) || Boolean(currentSubmission && currentSubmission.status !== "RETURNED" && !assignment.allowResubmit);

  const submitAnswer = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/student/assignments/${assignment.id}/submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          assignment.mode === "QUESTION_SET"
            ? {
                answers: assignment.questions.map((question) => ({ questionId: question.id, response: answers[question.id] })),
                version: currentSubmission?.version,
              }
            : { answer, version: currentSubmission?.version }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengumpulkan tugas");
      setCurrentSubmission({
        id: data.submission.id,
        answer: data.submission.answer,
        status: data.submission.status,
        submittedAt: data.submission.submittedAt,
        score: data.submission.score,
        feedback: data.submission.feedback,
        gradedAt: data.submission.gradedAt,
        version: data.submission.version,
        answers: data.submission.answers || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengumpulkan tugas");
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
                {assignment.mapel}
              </Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                {assignment.title}
              </h1>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                {assignment.description}
              </p>
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
                  <p className="mt-2 text-xl font-black">{assignment.teacherName}</p>
                </div>
                <div className="rounded-3xl bg-white/15 p-4 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    <p className="text-sm font-bold">
                      {assignment.dueAt
                        ? `Deadline ${formatDeadline(assignment.dueAt)}`
                        : "Tanpa deadline"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-extrabold text-slate-950">
                Jawaban Saya
              </CardTitle>
              {currentSubmission ? (
                <Badge className="w-fit bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  {submissionLabel(currentSubmission.status)}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {currentSubmission ? (
              <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                Jawaban terakhir tersimpan pada {formatDate(currentSubmission.submittedAt)}.
                {isGraded
                  ? " Tugas sudah dinilai guru, sehingga jawaban tidak dapat diperbarui."
                  : assignment.allowResubmit || currentSubmission.status === "RETURNED"
                    ? " Anda masih bisa memperbarui jawaban selama tugas masih tersedia."
                    : " Tugas ini hanya dapat dikumpulkan satu kali."}
              </div>
            ) : null}
            {!assignment.acceptsSubmission ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Pengumpulan tugas sudah ditutup. Jawaban yang tersimpan tetap dapat dilihat.</div> : assignment.isLate ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Deadline telah lewat. Jawaban masih diterima dan akan ditandai terlambat.</div> : null}
            {currentSubmission?.status === "GRADED" ? (
              <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-900">
                  Nilai: {currentSubmission.score ?? "-"} / {assignment.maxScore}
                </p>
                {currentSubmission.gradedAt ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    Dinilai pada {formatDate(currentSubmission.gradedAt)}
                  </p>
                ) : null}
                {currentSubmission.feedback ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-emerald-800">
                    {currentSubmission.feedback}
                  </p>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}
            <form onSubmit={submitAnswer} className="space-y-5">
              {assignment.mode === "QUESTION_SET" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm font-black text-slate-800"><ListChecks className="h-4 w-4 text-emerald-600" /> Soal Tugas</span>
                    <Badge variant="outline">{assignment.questions.length} soal · {assignment.maxScore} poin</Badge>
                  </div>
                  {assignment.questions.map((question, index) => {
                    const options = Array.isArray(question.options) ? question.options.map(assignmentOption) : [];
                    const saved = currentSubmission?.answers.find((item) => item.questionId === question.id);
                    return (
                      <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <Label className="leading-6">{index + 1}. {question.prompt}{question.required ? " *" : ""}</Label>
                          <Badge variant="secondary">{question.points} poin</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {question.imageUrl ? <Image src={question.imageUrl} alt={`Gambar soal ${index + 1}`} width={720} height={420} unoptimized className="max-h-[420px] w-auto max-w-full rounded-xl border object-contain" /> : null}
                          {(question.type === "SINGLE_CHOICE" || question.type === "TRUE_FALSE") && options.map((option, optionIndex) => (
                            <label key={optionIndex} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
                              <input type="radio" name={question.id} checked={Number(answers[question.id]) === optionIndex} disabled={isLocked} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} />
                              <span className="space-y-2">{option.imageUrl ? <Image src={option.imageUrl} alt={`Pilihan ${optionIndex + 1}`} width={300} height={180} unoptimized className="max-h-44 w-auto max-w-full rounded-lg object-contain" /> : null}{option.text ? <span className="block">{option.text}</span> : null}</span>
                            </label>
                          ))}
                          {question.type === "MULTIPLE_CHOICE" && options.map((option, optionIndex) => {
                            const values = Array.isArray(answers[question.id]) ? (answers[question.id] as unknown[]).map(Number) : [];
                            return (
                              <label key={optionIndex} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm">
                                <input type="checkbox" checked={values.includes(optionIndex)} disabled={isLocked} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.checked ? [...values, optionIndex] : values.filter((value) => value !== optionIndex) }))} />
                                <span className="space-y-2">{option.imageUrl ? <Image src={option.imageUrl} alt={`Pilihan ${optionIndex + 1}`} width={300} height={180} unoptimized className="max-h-44 w-auto max-w-full rounded-lg object-contain" /> : null}{option.text ? <span className="block">{option.text}</span> : null}</span>
                              </label>
                            );
                          })}
                          {question.type === "SHORT_ANSWER" ? <Input value={String(answers[question.id] ?? "")} disabled={isLocked} placeholder="Tulis jawaban singkat" onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /> : null}
                          {question.type === "ESSAY" ? <Textarea rows={6} value={String(answers[question.id] ?? "")} disabled={isLocked} placeholder="Tuliskan jawaban lengkap" onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /> : null}
                        </div>
                        {isGraded && saved ? <p className="mt-3 text-xs font-bold text-emerald-700">Nilai butir: {saved.score ?? "Menunggu koreksi"} / {question.points}</p> : null}
                        {isGraded && question.explanation ? <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">Pembahasan: {question.explanation}</p> : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Isi Jawaban</Label>
                  <Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={9} placeholder="Tulis jawaban tugas di sini..." disabled={isLocked} required />
                </div>
              )}
              {!isLocked ? (
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {currentSubmission ? "Kumpulkan Revisi" : "Kumpulkan Tugas"}
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </StudentShell>
  );
}
