"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ArrowDown,
  ArrowUp,
  FilePlus2,
  Download,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { formatDateId } from "@/lib/attendance";
import { formatAssignmentDueAt } from "@/lib/assignment-time";
import { getClassMapelOptions } from "@/lib/curriculum";
import { apiError, readResponseJson } from "@/lib/http-json";
import { distributeAssignmentPoints } from "@/lib/assignment-engine";

type ClassRoom = {
  id: string;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  _count: { students: number; sessions: number };
  allowedSubjects?: string[] | null;
};

type Assignment = {
  id: string;
  title: string;
  mapel: string;
  description: string;
  dueDate: string | null;
  dueAt: string | null;
  submissionClosedAt: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  classRoom: { id: string; name: string; jenjang: string };
  teacher: { id: string; name: string | null };
  _count?: { submissions: number };
  mode: "LEGACY_TEXT" | "QUESTION_SET";
  maxScore: number;
  allowLate: boolean;
  allowResubmit: boolean;
  questions?: QuestionDraft[];
};

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
type QuestionOption = { text: string; imageUrl: string | null };
type QuestionDraft = {
  clientId: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  options: QuestionOption[];
  correctAnswer: number | number[] | string | string[] | null;
  points: number;
  required: boolean;
  explanation: string;
};

function newQuestion(points = 100): QuestionDraft {
  return { clientId: crypto.randomUUID(), type: "SINGLE_CHOICE", prompt: "", imageUrl: null, options: [{ text: "", imageUrl: null }, { text: "", imageUrl: null }], correctAnswer: 0, points, required: true, explanation: "" };
}

function normalizedOption(value: unknown): QuestionOption {
  if (typeof value === "string") return { text: value, imageUrl: null };
  if (value && typeof value === "object") {
    const option = value as { text?: unknown; imageUrl?: unknown };
    return { text: typeof option.text === "string" ? option.text : "", imageUrl: typeof option.imageUrl === "string" ? option.imageUrl : null };
  }
  return { text: "", imageUrl: null };
}

function toJakartaInput(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

const initialForm = {
  classRoomId: "",
  title: "",
  mapel: "",
  dueDate: "",
  dueTime: "23:59",
  description: "",
  mode: "LEGACY_TEXT" as "LEGACY_TEXT" | "QUESTION_SET",
  status: "PUBLISHED" as "DRAFT" | "PUBLISHED",
  allowLate: true,
  allowResubmit: true,
  questions: [] as QuestionDraft[],
};

function statusLabel(status: Assignment["status"]) {
  if (status === "DRAFT") return "Draft";
  if (status === "ARCHIVED") return "Diarsipkan";
  return "Terbit";
}

function jakartaDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function dueTone(dueDate: string | null) {
  if (!dueDate) return "border-slate-200 bg-slate-50 text-slate-600";
  const today = jakartaDateKey();
  const due = jakartaDateKey(new Date(dueDate));
  if (due < today) return "border-red-200 bg-red-50 text-red-700";
  if (due === today) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function AssignmentsOverviewClient() {
  const dashboardUser = useDashboardUser();
  const searchParams = useSearchParams();
  const initialClassId = searchParams.get("classRoomId") || "";
  const initialEditId = searchParams.get("edit") || "";
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHasSubmissions, setEditingHasSubmissions] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingUploadUrls, setPendingUploadUrls] = useState<string[]>([]);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
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
  const filteredAssignments = useMemo(
    () =>
      selectedClassId
        ? assignments.filter((assignment) => assignment.classRoom.id === selectedClassId)
        : assignments,
    [assignments, selectedClassId]
  );
  const publishedCount = assignments.filter((item) => item.status === "PUBLISHED").length;
  const dueTodayCount = assignments.filter(
    (item) => Boolean((item.dueAt ?? item.dueDate) && jakartaDateKey(new Date((item.dueAt ?? item.dueDate)!)) === jakartaDateKey())
  ).length;

  const totalPoints = form.questions.reduce((sum, question) => sum + Number(question.points || 0), 0);

  const updateQuestion = (index: number, patch: Partial<QuestionDraft>) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question
      ),
    }));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.questions.length) return current;
      const questions = [...current.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...current, questions };
    });
  };

  const setQuestionCount = (count: number) => {
    if (!Number.isInteger(count) || count < 1 || count > 100) return;
    setForm((current) => {
      if (count < current.questions.length && !window.confirm(`${current.questions.length - count} soal terakhir akan dihapus. Lanjutkan?`)) return current;
      const points = distributeAssignmentPoints(count);
      const questions = Array.from({ length: count }, (_, index) => current.questions[index] ? { ...current.questions[index], points: points[index] } : newQuestion(points[index]));
      return { ...current, questions };
    });
  };

  const equalizePoints = () => setForm((current) => {
    const points = distributeAssignmentPoints(current.questions.length);
    return { ...current, questions: current.questions.map((question, index) => ({ ...question, points: points[index] })) };
  });

  const uploadImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const payload = new FormData();
      payload.set("file", file);
      const response = await fetch("/api/assignments/media", { method: "POST", body: payload });
      const data = await readResponseJson<{ url?: string }>(response);
      if (!response.ok || !data.url) throw new Error(apiError(data, "Gagal mengunggah gambar"));
      setPendingUploadUrls((current) => [...current, data.url!]);
      return data.url;
    } finally {
      setUploadingImage(false);
    }
  };

  const cleanupPendingUploads = async () => {
    const urls = [...pendingUploadUrls];
    setPendingUploadUrls([]);
    await Promise.all(urls.map((url) => fetch(`/api/assignments/media?url=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => undefined)));
  };

  const importTemplate = async (file: File) => {
    setImporting(true);
    setError("");
    setImportErrors([]);
    try {
      const payload = new FormData();
      payload.set("file", file);
      const response = await fetch("/api/assignments/import", { method: "POST", body: payload });
      const data = await readResponseJson<{ questions?: Omit<QuestionDraft, "clientId">[]; errors?: Array<{ row: number; message: string }>; uploadedUrls?: string[] }>(response);
      if (!response.ok) {
        setImportErrors(data.errors ?? []);
        const details = data.errors?.map((item) => `Baris ${item.row}: ${item.message}`).join(" · ");
        throw new Error(details || apiError(data, "Template tidak valid"));
      }
      const questions = (data.questions ?? []).map((question) => ({ ...question, clientId: crypto.randomUUID(), options: (question.options ?? []).map(normalizedOption) }));
      setPendingUploadUrls((current) => [...current, ...(data.uploadedUrls ?? [])]);
      setForm((current) => ({ ...current, mode: "QUESTION_SET", questions }));
      setSuccess(`${questions.length} soal berhasil dibaca. Periksa preview lalu simpan tugas.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengimpor soal.");
    } finally {
      setImporting(false);
    }
  };

  const downloadImportErrors = () => {
    const csv = ["Baris,Masalah", ...importErrors.map((item) => `${item.row},"${item.message.replaceAll('"', '""')}"`)].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hasil-validasi-impor-soal.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const editAssignment = useCallback((assignment: Assignment) => {
    const deadlineInput = assignment.dueAt ? toJakartaInput(assignment.dueAt) : assignment.dueDate ? `${assignment.dueDate.slice(0, 10)}T23:59` : "";
    setEditingId(assignment.id);
    setForm({
      classRoomId: assignment.classRoom.id,
      title: assignment.title,
      mapel: assignment.mapel,
      dueDate: deadlineInput.slice(0, 10),
      dueTime: deadlineInput.slice(11, 16) || "23:59",
      description: assignment.description,
      mode: assignment.mode,
      status: assignment.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
      allowLate: assignment.allowLate,
      allowResubmit: assignment.allowResubmit,
      questions: (assignment.questions ?? []).map((question) => ({ ...question, imageUrl: question.imageUrl ?? null, clientId: crypto.randomUUID(), options: Array.isArray(question.options) ? question.options.map(normalizedOption) : [] })),
    });
    setEditingHasSubmissions(Boolean(assignment._count?.submissions));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classRes, assignmentRes] = await Promise.all([
        fetch("/api/attendance/classes"),
        fetch(`/api/assignments${showArchived ? "?includeArchived=true" : ""}`),
      ]);
      const classData = await readResponseJson<{ classes?: ClassRoom[] }>(classRes);
      const assignmentData = await readResponseJson<{ assignments?: Assignment[] }>(
        assignmentRes
      );
      if (!classRes.ok) throw new Error(apiError(classData, "Gagal memuat kelas"));
      if (!assignmentRes.ok) {
        throw new Error(apiError(assignmentData, "Gagal memuat tugas"));
      }
      const loadedClasses = classData.classes || [];
      setClasses(loadedClasses);
      setAssignments(assignmentData.assignments || []);
      if (initialClassId && loadedClasses.some((item: ClassRoom) => item.id === initialClassId)) {
        setForm((current) => ({ ...current, classRoomId: initialClassId }));
        setShowForm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat tugas.");
    } finally {
      setLoading(false);
    }
  }, [initialClassId, showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!initialEditId || editingId) return;
    const assignment = assignments.find((item) => item.id === initialEditId);
    if (assignment) editAssignment(assignment);
  }, [assignments, editAssignment, editingId, initialEditId]);

  const createAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(editingId ? `/api/assignments/${editingId}` : "/api/assignments", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classRoomId: form.classRoomId,
          title: form.title,
          mapel: form.mapel,
          dueAt: form.dueDate ? `${form.dueDate}T${form.dueTime || "23:59"}` : null,
          description: form.description,
          mode: form.mode,
          status: form.status,
          allowLate: form.allowLate,
          allowResubmit: form.allowResubmit,
          questions: form.mode === "QUESTION_SET"
            ? form.questions.map((question) => ({
                type: question.type,
                prompt: question.prompt,
                imageUrl: question.imageUrl,
                options: question.type === "TRUE_FALSE" || question.type === "ESSAY" || question.type === "SHORT_ANSWER" ? undefined : question.options,
                correctAnswer: question.type === "ESSAY" ? undefined : question.correctAnswer,
                points: question.points,
                required: question.required,
                explanation: question.explanation || undefined,
              }))
            : undefined,
        }),
      });
      const data = await readResponseJson<{ assignment?: Assignment }>(res);
      if (!res.ok) throw new Error(apiError(data, "Gagal membuat tugas"));
      if (!data.assignment) throw new Error("Respons tugas tidak valid.");
      setAssignments((current) => editingId
        ? current.map((item) => item.id === editingId ? data.assignment! : item)
        : [data.assignment!, ...current]);
      setForm(initialForm);
      setEditingId(null);
      setEditingHasSubmissions(false);
      setPendingUploadUrls([]);
      setShowForm(false);
      setSuccess(form.status === "DRAFT" ? "Draft tugas berhasil disimpan." : "Tugas berhasil diterbitkan dan tampil di portal siswa.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat tugas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell activePath="/dashboard/tugas" user={dashboardUser}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_22px_60px_rgba(15,76,129,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 lg:p-7">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                Ruang Tugas
              </Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                Tugas / PR Kelas
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Buat instruksi tugas terstruktur untuk kelas sekolah. Siswa dapat
                melihat tugas, mengirim jawaban, lalu guru memantau dan memberi nilai
                dari halaman rekap pengumpulan.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => setShowForm((value) => !value)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Tugas
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
                <Button variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived((value) => !value)}>
                  {showArchived ? "Sembunyikan Arsip" : "Tampilkan Arsip"}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 border-t border-blue-50 bg-emerald-50/60 p-5 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:p-6">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <ClipboardList className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-2xl font-black text-slate-950">{assignments.length}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Total tugas</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-2xl font-black text-slate-950">{publishedCount}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Terbit</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <CalendarClock className="mb-3 h-5 w-5 text-amber-600" />
                <p className="text-2xl font-black text-slate-950">{dueTodayCount}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Hari ini</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
            {importErrors.length ? <div className="mt-3"><Button type="button" size="sm" variant="outline" onClick={downloadImportErrors}><Download className="mr-2 h-4 w-4" />Download Hasil Validasi</Button></div> : null}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {success}
          </div>
        ) : null}

        {showForm ? (
          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <form onSubmit={createAssignment} className="grid gap-4 lg:grid-cols-4">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Kelas Tujuan</Label>
                  <Select
                    value={form.classRoomId}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, classRoomId: value, mapel: "" }))
                    }
                    disabled={Boolean(editingId)}
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
                    onValueChange={(value) => setForm((current) => ({ ...current, mapel: value }))}
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
                  <Label>Format Tugas</Label>
                  <Select value={form.mode} onValueChange={(value: "LEGACY_TEXT" | "QUESTION_SET") => setForm((current) => ({ ...current, mode: value, questions: value === "QUESTION_SET" && current.questions.length === 0 ? [newQuestion()] : current.questions }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEGACY_TEXT">Jawaban uraian tunggal</SelectItem>
                      <SelectItem value="QUESTION_SET">Paket soal terstruktur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Status Awal</Label>
                   <Select value={form.status} disabled={Boolean(editingId && form.status === "PUBLISHED")} onValueChange={(value: "DRAFT" | "PUBLISHED") => setForm((current) => ({ ...current, status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Simpan sebagai draft</SelectItem>
                      <SelectItem value="PUBLISHED">Terbitkan ke siswa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-3">
                  <Label>Judul Tugas</Label>
                  <Input
                    placeholder="Contoh: Latihan refleksi materi ekosistem"
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deadline (WIB)</Label>
                  <div className="grid grid-cols-[1fr_110px] gap-2"><Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /><Input type="time" value={form.dueTime} disabled={!form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueTime: event.target.value }))} /></div>
                  <p className="text-xs leading-5 text-slate-500">Jam otomatis 23.59 WIB dan dapat diubah guru.</p>
                </div>
                <div className="space-y-2 lg:col-span-4">
                  <Label>Instruksi Tugas</Label>
                  <Textarea
                    rows={5}
                    placeholder="Tuliskan apa yang harus dikerjakan siswa, format jawaban, dan batas pengumpulan."
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 lg:col-span-4">
                  <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={form.allowLate} onChange={(event) => setForm((current) => ({ ...current, allowLate: event.target.checked }))} />
                    Izinkan pengumpulan terlambat
                  </label>
                  <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={form.allowResubmit} onChange={(event) => setForm((current) => ({ ...current, allowResubmit: event.target.checked }))} />
                    Izinkan siswa memperbarui jawaban
                  </label>
                  {form.mode === "QUESTION_SET" ? <div className="space-y-1"><Label htmlFor="question-count">Jumlah soal</Label><Input id="question-count" type="number" min="1" max="100" value={form.questions.length} disabled={editingHasSubmissions} onChange={(event) => setQuestionCount(Number(event.target.value))} /></div> : null}
                </div>
                {form.mode === "QUESTION_SET" ? (
                  <div className="space-y-4 lg:col-span-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-black text-slate-950"><ListChecks className="h-5 w-5 text-emerald-600" /> Susun Soal</p>
                        <p className={`mt-1 text-xs font-semibold ${Math.abs(totalPoints - 100) < 0.001 ? "text-emerald-600" : "text-amber-700"}`}>Bobot total {totalPoints.toFixed(2)} poin {Math.abs(totalPoints - 100) < 0.001 ? "· valid" : "· harus tepat 100"}.</p>
                        {editingHasSubmissions ? <p className="mt-1 text-xs font-semibold text-amber-700">Struktur soal dikunci karena jawaban siswa sudah masuk. Informasi dan deadline tetap dapat diubah.</p> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" disabled={editingHasSubmissions} onClick={equalizePoints}>Ratakan Bobot</Button>
                        <Button type="button" variant="outline" asChild><a href="/templates/template-soal-tugas-genpro.xlsx" download><Download className="mr-2 h-4 w-4" />Download Template</a></Button>
                        <Button type="button" variant="outline" disabled={importing || editingHasSubmissions} asChild><label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />{importing ? "Membaca..." : "Upload Template"}<input className="sr-only" type="file" accept=".xlsx,.zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importTemplate(file); event.target.value = ""; }} /></label></Button>
                        <Button type="button" variant="outline" disabled={editingHasSubmissions || form.questions.length >= 100} onClick={() => setQuestionCount(form.questions.length + 1)}><Plus className="mr-2 h-4 w-4" />Tambah Soal</Button>
                      </div>
                    </div>
                    <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Untuk gambar massal: isi nama file gambar pada template, letakkan file di folder <strong>images</strong>, lalu ZIP file XLSX bersama folder tersebut sebelum diunggah.</p>
                    {form.questions.map((question, index) => (
                      <fieldset key={question.clientId} disabled={editingHasSubmissions} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 disabled:opacity-70">
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <p className="font-black text-slate-900">Soal {index + 1}</p>
                          <div className="flex gap-1">
                            <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => moveQuestion(index, -1)} aria-label="Naikkan soal"><ArrowUp className="h-4 w-4" /></Button>
                            <Button type="button" size="icon" variant="ghost" disabled={index === form.questions.length - 1} onClick={() => moveQuestion(index, 1)} aria-label="Turunkan soal"><ArrowDown className="h-4 w-4" /></Button>
                            <Button type="button" size="icon" variant="ghost" className="text-red-600" onClick={() => setForm((current) => ({ ...current, questions: current.questions.filter((_, questionIndex) => questionIndex !== index) }))} aria-label="Hapus soal"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-[1fr_150px]">
                          <div className="space-y-2"><Label>Pertanyaan</Label><Textarea rows={3} value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="Tuliskan pertanyaan" /></div>
                          <div className="space-y-2"><Label>Bobot</Label><Input type="number" min="0.1" max="1000" step="0.1" value={question.points} onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })} /></div>
                          <div className="space-y-2"><Label>Jenis Soal</Label><Select value={question.type} onValueChange={(value: QuestionType) => updateQuestion(index, { type: value, options: value === "TRUE_FALSE" ? [{ text: "Benar", imageUrl: null }, { text: "Salah", imageUrl: null }] : value === "SINGLE_CHOICE" || value === "MULTIPLE_CHOICE" ? question.options.length >= 2 ? question.options : [{ text: "", imageUrl: null }, { text: "", imageUrl: null }] : [], correctAnswer: value === "MULTIPLE_CHOICE" ? [] : value === "ESSAY" ? null : value === "SHORT_ANSWER" ? "" : 0 })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SINGLE_CHOICE">Pilihan tunggal</SelectItem><SelectItem value="MULTIPLE_CHOICE">Pilihan ganda kompleks</SelectItem><SelectItem value="TRUE_FALSE">Benar / salah</SelectItem><SelectItem value="SHORT_ANSWER">Jawaban singkat</SelectItem><SelectItem value="ESSAY">Esai</SelectItem></SelectContent></Select></div>
                          <label className="flex items-end gap-3 pb-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} />Wajib dijawab</label>
                        </div>
                        <div className="mt-4 space-y-2"><Label>Gambar soal (opsional)</Label>{question.imageUrl ? <div className="flex flex-wrap items-start gap-3"><Image src={question.imageUrl} alt={`Gambar soal ${index + 1}`} width={240} height={160} unoptimized className="max-h-40 w-auto rounded-xl border object-contain" /><Button type="button" size="sm" variant="outline" onClick={() => updateQuestion(index, { imageUrl: null })}>Hapus gambar</Button></div> : <Button type="button" size="sm" variant="outline" disabled={uploadingImage} asChild><label className="cursor-pointer"><ImageIcon className="mr-2 h-4 w-4" />Pilih Gambar<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { try { updateQuestion(index, { imageUrl: await uploadImage(file) }); } catch (caught) { setError(caught instanceof Error ? caught.message : "Gagal mengunggah gambar"); } } event.target.value = ""; }} /></label></Button>}</div>
                        {(question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") ? (
                          <div className="mt-4 space-y-3"><Label>Opsi dan kunci jawaban</Label>{question.options.map((option, optionIndex) => { const multipleKeys = Array.isArray(question.correctAnswer) ? question.correctAnswer.map(Number) : []; return <div key={optionIndex} className="grid gap-2 rounded-xl border border-emerald-100 bg-white p-3 sm:grid-cols-[24px_1fr_auto]"><input className="mt-3" type={question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"} name={`correct-${question.clientId}`} checked={question.type === "MULTIPLE_CHOICE" ? multipleKeys.includes(optionIndex) : Number(question.correctAnswer) === optionIndex} onChange={(event) => updateQuestion(index, { correctAnswer: question.type === "MULTIPLE_CHOICE" ? event.target.checked ? [...multipleKeys, optionIndex] : multipleKeys.filter((value) => value !== optionIndex) : optionIndex })} /><div className="space-y-2"><Input value={option.text} placeholder={`Teks opsi ${optionIndex + 1} (boleh kosong jika memakai gambar)`} onChange={(event) => updateQuestion(index, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? { ...item, text: event.target.value } : item) })} />{option.imageUrl ? <div className="flex items-start gap-2"><Image src={option.imageUrl} alt={`Gambar opsi ${optionIndex + 1}`} width={160} height={100} unoptimized className="max-h-28 w-auto rounded-lg border object-contain" /><Button type="button" size="sm" variant="ghost" onClick={() => updateQuestion(index, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? { ...item, imageUrl: null } : item) })}>Hapus gambar</Button></div> : <Button type="button" size="sm" variant="outline" asChild><label className="cursor-pointer"><ImageIcon className="mr-2 h-4 w-4" />Gambar Opsi<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { try { const url = await uploadImage(file); updateQuestion(index, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? { ...item, imageUrl: url } : item) }); } catch (caught) { setError(caught instanceof Error ? caught.message : "Gagal mengunggah gambar"); } } event.target.value = ""; }} /></label></Button>}</div><Button type="button" size="icon" variant="ghost" disabled={question.options.length <= 2} onClick={() => updateQuestion(index, { options: question.options.filter((_, itemIndex) => itemIndex !== optionIndex), correctAnswer: question.type === "MULTIPLE_CHOICE" ? multipleKeys.filter((value) => value !== optionIndex).map((value) => value > optionIndex ? value - 1 : value) : 0 })}><Trash2 className="h-4 w-4" /></Button></div>; })}<Button type="button" size="sm" variant="outline" disabled={question.options.length >= 10} onClick={() => updateQuestion(index, { options: [...question.options, { text: "", imageUrl: null }] })}>Tambah Opsi</Button></div>
                        ) : null}
                        {question.type === "TRUE_FALSE" ? <div className="mt-4 space-y-2"><Label>Kunci Jawaban</Label><Select value={String(question.correctAnswer ?? 0)} onValueChange={(value) => updateQuestion(index, { correctAnswer: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Benar</SelectItem><SelectItem value="1">Salah</SelectItem></SelectContent></Select></div> : null}
                        {question.type === "SHORT_ANSWER" ? <div className="mt-4 space-y-2"><Label>Kunci jawaban singkat</Label><Input value={String(question.correctAnswer ?? "")} onChange={(event) => updateQuestion(index, { correctAnswer: event.target.value })} placeholder="Jawaban yang diterima" /></div> : null}
                        <div className="mt-4 space-y-2"><Label>Pembahasan (opsional)</Label><Textarea rows={2} value={question.explanation} onChange={(event) => updateQuestion(index, { explanation: event.target.value })} placeholder="Ditampilkan setelah tugas dinilai" /></div>
                      </fieldset>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2 lg:col-span-4">
                  <Button type="submit" disabled={saving || uploadingImage || classes.length === 0 || (form.mode === "QUESTION_SET" && Math.abs(totalPoints - 100) >= 0.001)}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingId ? "Simpan Perubahan" : form.status === "DRAFT" ? "Simpan Draft" : "Terbitkan Tugas"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { void cleanupPendingUploads(); setShowForm(false); setEditingId(null); setEditingHasSubmissions(false); setForm(initialForm); }}>
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
          ) : filteredAssignments.length === 0 ? (
            <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.06)]">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <FilePlus2 className="mb-4 h-12 w-12 text-blue-300" />
                <h3 className="font-extrabold text-slate-950">Belum ada tugas</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Buat tugas pertama untuk kelas agar siswa bisa melihat instruksi
                  dan mengirim jawaban dari portal siswa.
                </p>
                <Button className="mt-5" onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Tugas
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAssignments.map((assignment) => (
                <Card
                  key={assignment.id}
                  className="rounded-[22px] border-emerald-100 bg-white shadow-[0_16px_40px_rgba(15,76,129,0.055)] transition hover:border-emerald-200 hover:shadow-[0_20px_50px_rgba(15,76,129,0.09)]"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                            {assignment.classRoom.name}
                          </Badge>
                          <Badge variant="outline" className={dueTone(assignment.dueAt ?? assignment.dueDate)}>
                            {assignment.dueAt || assignment.dueDate
                              ? `Deadline ${assignment.dueAt ? formatAssignmentDueAt(assignment.dueAt) : formatDateId(assignment.dueDate!)}`
                              : "Tanpa deadline"}
                          </Badge>
                          <Badge variant="secondary">{statusLabel(assignment.status)}</Badge>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-slate-950">
                          {assignment.title}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          {assignment.mapel}
                        </p>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                          {assignment.description}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" asChild>
                            <Link href={`/dashboard/tugas/${assignment.id}`}>
                              Lihat Pengumpulan
                            </Link>
                          </Button>
                          {assignment.status !== "ARCHIVED" ? <Button size="sm" variant="outline" onClick={() => editAssignment(assignment)}>{assignment.status === "DRAFT" ? "Edit Draft" : "Kelola Tugas"}</Button> : null}
                          <Badge variant="outline" className="rounded-xl px-3 py-1.5">
                            {assignment._count?.submissions ?? 0} jawaban masuk
                          </Badge>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <p className="font-bold text-slate-950">
                          {assignment.teacher.name || "Guru"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Dibuat {formatDateId(assignment.createdAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
