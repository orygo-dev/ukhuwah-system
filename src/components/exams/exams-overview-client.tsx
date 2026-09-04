"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readResponseJson } from "@/lib/http-json";
import { normalizeMcqOptions } from "@/lib/mcq-options";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardUser } from "@/hooks/use-dashboard-user";
import { getClassMapelOptions } from "@/lib/curriculum";

type ClassRoom = {
  id: string;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  _count: { students: number; sessions: number };
  allowedSubjects?: string[] | null;
};

type Exam = {
  id: string;
  title: string;
  mapel: string;
  instructions: string | null;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  classRoom: { id: string; name: string; jenjang: string; tahunAjaran: string };
  teacher: { id: string; name: string | null };
  _count: { questions: number; attempts: number };
};

type QuestionForm = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
};

const emptyQuestion = (): QuestionForm => ({
  prompt: "",
  options: ["", "", "", ""],
  correctOptionIndex: 0,
  explanation: "",
});

function localDateTimeValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function examStatus(exam: Exam) {
  const now = Date.now();
  const start = new Date(exam.startAt).getTime();
  const end = new Date(exam.endAt).getTime();
  if (now < start) return { label: "Terjadwal", className: "bg-amber-50 text-amber-700" };
  if (now > end) return { label: "Ditutup", className: "bg-slate-100 text-slate-600" };
  return { label: "Aktif", className: "bg-emerald-50 text-emerald-700" };
}

const initialForm = {
  classRoomId: "",
  title: "",
  mapel: "",
  instructions: "",
  startAt: localDateTimeValue(new Date()),
  endAt: localDateTimeValue(new Date(Date.now() + 2 * 60 * 60 * 1000)),
  durationMinutes: "60",
  questions: [emptyQuestion()],
};

export function ExamsOverviewClient() {
  const dashboardUser = useDashboardUser();
  const searchParams = useSearchParams();
  const initialClassId = searchParams.get("classRoomId") || "";
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(initialForm);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === form.classRoomId),
    [classes, form.classRoomId]
  );
  const mapelOptions = useMemo(
    () => getClassMapelOptions(selectedClass),
    [selectedClass]
  );
  const filteredExams = useMemo(
    () =>
      selectedClassId
        ? exams.filter((exam) => exam.classRoom.id === selectedClassId)
        : exams,
    [exams, selectedClassId]
  );
  const activeCount = exams.filter((exam) => examStatus(exam).label === "Aktif").length;
  const totalAttempts = exams.reduce((sum, exam) => sum + exam._count.attempts, 0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classRes, examRes] = await Promise.all([
        fetch("/api/attendance/classes"),
        fetch("/api/exams"),
      ]);
      const classData = await readResponseJson<{ classes?: ClassRoom[] }>(classRes);
      const examData = await readResponseJson<{ exams?: Exam[] }>(examRes);
      if (!classRes.ok) throw new Error(classData.error || "Gagal memuat kelas");
      if (!examRes.ok) throw new Error(examData.error || "Gagal memuat ujian");
      const loadedClasses = classData.classes || [];
      setClasses(loadedClasses);
      setExams(examData.exams || []);
      if (initialClassId && loadedClasses.some((item: ClassRoom) => item.id === initialClassId)) {
        setForm((current) => ({ ...current, classRoomId: initialClassId }));
        setShowForm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat ujian.");
    } finally {
      setLoading(false);
    }
  }, [initialClassId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateQuestion = (
    index: number,
    updater: (question: QuestionForm) => QuestionForm
  ) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, qIndex) =>
        qIndex === index ? updater(question) : question
      ),
    }));
  };

  const createExam = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classRoomId: form.classRoomId,
          title: form.title,
          mapel: form.mapel,
          instructions: form.instructions || undefined,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          durationMinutes: form.durationMinutes,
          questions: form.questions.map((question) => {
            const normalized = normalizeMcqOptions(question.options, question.correctOptionIndex);
            if (!normalized) {
              throw new Error("Setiap soal harus punya minimal 2 opsi dan jawaban benar yang valid.");
            }
            return {
              prompt: question.prompt,
              options: normalized.options,
              correctOptionIndex: normalized.correctOptionIndex,
              explanation: question.explanation || undefined,
            };
          }),
        }),
      });
      const data = await readResponseJson<{ error?: string; exam?: unknown }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat ujian");
      setExams((current) => [data.exam as (typeof current)[number], ...current]);
      setForm(initialForm);
      setShowForm(false);
      setSuccess("Ujian berhasil diterbitkan sesuai jadwal.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat ujian");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell activePath="/dashboard/exam" user={dashboardUser}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_22px_60px_rgba(15,76,129,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 lg:p-7">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                Ujian Online
              </Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                Exam Terjadwal
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Buat ujian formal dengan jadwal aktif, durasi pengerjaan, soal pilihan
                ganda, dan nilai otomatis.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => setShowForm((value) => !value)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Ujian
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedClassId("");
                    setShowForm(false);
                  }}
                >
                  Semua Kelas
                </Button>
              </div>
            </div>
            <div className="grid gap-3 border-t border-blue-50 bg-emerald-50/60 p-5 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:p-6">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <ClipboardList className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-2xl font-black text-slate-950">{exams.length}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Total ujian</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <CalendarClock className="mb-3 h-5 w-5 text-amber-600" />
                <p className="text-2xl font-black text-slate-950">{activeCount}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Aktif</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-2xl font-black text-slate-950">{totalAttempts}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Dikerjakan</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {success}
          </div>
        ) : null}

        {showForm ? (
          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="space-y-5 p-5">
              <form onSubmit={createExam} className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Kelas Tujuan</Label>
                    <Select
                      value={form.classRoomId}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, classRoomId: value, mapel: "" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} · {item.tahunAjaran}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Mata Pelajaran</Label>
                    <Select
                      value={form.mapel}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, mapel: value }))
                      }
                      disabled={!form.classRoomId || mapelOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={mapelOptions.length ? "Pilih mapel" : "Mapel kelas belum tersedia"} />
                      </SelectTrigger>
                      <SelectContent>
                        {mapelOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Judul Ujian</Label>
                    <Input
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Contoh: Ujian harian ekosistem"
                      required
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Durasi Menit</Label>
                    <Input
                      type="number"
                      min="5"
                      max="300"
                      value={form.durationMinutes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          durationMinutes: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Mulai</Label>
                    <Input
                      type="datetime-local"
                      value={form.startAt}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, startAt: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Selesai</Label>
                    <Input
                      type="datetime-local"
                      value={form.endAt}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, endAt: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-4">
                    <Label>Instruksi Ujian</Label>
                    <Textarea
                      value={form.instructions}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          instructions: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Tulis instruksi ujian, aturan pengerjaan, atau catatan untuk siswa"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {form.questions.map((question, questionIndex) => (
                    <div
                      key={questionIndex}
                      className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="font-extrabold text-slate-950">
                          Soal {questionIndex + 1}
                        </p>
                        {form.questions.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                questions: current.questions.filter(
                                  (_, index) => index !== questionIndex
                                ),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="space-y-3">
                        <Textarea
                          value={question.prompt}
                          onChange={(event) =>
                            updateQuestion(questionIndex, (current) => ({
                              ...current,
                              prompt: event.target.value,
                            }))
                          }
                          rows={3}
                          placeholder="Tulis pertanyaan ujian"
                          required
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          {question.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="space-y-1.5">
                              <Label className="text-xs font-bold text-slate-600">
                                Opsi {String.fromCharCode(65 + optionIndex)}
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  value={option}
                                  onChange={(event) =>
                                    updateQuestion(questionIndex, (current) => ({
                                      ...current,
                                      options: current.options.map((item, index) =>
                                        index === optionIndex ? event.target.value : item
                                      ),
                                    }))
                                  }
                                  required={optionIndex < 2}
                                />
                                <Button
                                  type="button"
                                  variant={
                                    question.correctOptionIndex === optionIndex
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() =>
                                    updateQuestion(questionIndex, (current) => ({
                                      ...current,
                                      correctOptionIndex: optionIndex,
                                    }))
                                  }
                                >
                                  Kunci
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Input
                          value={question.explanation}
                          onChange={(event) =>
                            updateQuestion(questionIndex, (current) => ({
                              ...current,
                              explanation: event.target.value,
                            }))
                          }
                          placeholder="Pembahasan setelah ujian selesai (opsional)"
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        questions: [...current.questions, emptyQuestion()],
                      }))
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Soal
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || classes.length === 0}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Terbitkan Ujian
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Batal
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.06)]">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-extrabold text-slate-950">Filter Kelas</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedClassId("")}
                  className={`w-full rounded-2xl border px-3 py-3 text-left text-sm font-bold transition ${
                    selectedClassId === ""
                      ? "border-blue-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-100 bg-slate-50 text-slate-700 hover:border-emerald-200"
                  }`}
                >
                  Semua kelas
                </button>
                {classes.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedClassId(item.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedClassId === item.id
                        ? "border-blue-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-100 bg-slate-50 text-slate-700 hover:border-emerald-200"
                    }`}
                  >
                    <span className="block text-sm font-extrabold">{item.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {item._count.students} siswa · {item.tahunAjaran}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredExams.length === 0 ? (
            <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.06)]">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <FileQuestion className="mb-4 h-12 w-12 text-blue-300" />
                <h3 className="font-extrabold text-slate-950">Belum ada ujian</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Buat ujian online pertama untuk kelas terpilih.
                </p>
                <Button className="mt-5" onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Ujian
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredExams.map((exam) => {
                const status = examStatus(exam);
                return (
                  <Card
                    key={exam.id}
                    className="rounded-[22px] border-emerald-100 bg-white shadow-[0_16px_40px_rgba(15,76,129,0.055)] transition hover:border-emerald-200 hover:shadow-[0_20px_50px_rgba(15,76,129,0.09)]"
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                              {exam.classRoom.name}
                            </Badge>
                            <Badge className={`${status.className} hover:${status.className}`}>
                              {status.label}
                            </Badge>
                            <Badge variant="outline">{exam._count.questions} soal</Badge>
                          </div>
                          <h3 className="mt-3 text-lg font-black text-slate-950">
                            {exam.title}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-emerald-700">
                            {exam.mapel}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {formatDateTime(exam.startAt)} - {formatDateTime(exam.endAt)}
                            {" · "}
                            Durasi {exam.durationMinutes} menit
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" asChild>
                              <Link href={`/dashboard/exam/${exam.id}`}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Lihat Rekap
                              </Link>
                            </Button>
                            <Badge variant="outline" className="rounded-xl px-3 py-1.5">
                              {exam._count.attempts} siswa mengerjakan
                            </Badge>
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                          <p className="font-bold text-slate-950">
                            {exam.teacher.name || "Guru"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Status {exam.status === "PUBLISHED" ? "Terbit" : "Draft"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
