"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  GraduationCap,
  Plus,
  RadioTower,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readResponseJson } from "@/lib/http-json";

type Teacher = { id: string; name: string; email: string };
type ProgramLink = {
  id: string;
  role: "INDUK" | "MITRA";
  program: { id: string; name: string; province: string; schoolYear: string; status: string };
};
type Enrollment = {
  id: string;
  status: string;
  programId: string;
  accessBarrier?: string | null;
  learningCenterName?: string | null;
  joinedAt?: string | null;
};
type PjjClass = {
  id: string;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  deliveryMode: string;
  pjjProgram?: { id: string; name: string; status: string } | null;
  teacher: { id: string; name: string };
  teacherAssignments: Array<{ id: string; subject: string; role: string; teacher: Teacher }>;
  students: Array<{
    id: string;
    name: string;
    nis?: string | null;
    userId?: string | null;
    pjjEnrollments: Enrollment[];
  }>;
  liveClassSessions: Array<{
    id: string;
    title: string;
    scheduledStart: string;
    status: string;
    _count: { participants: number };
  }>;
};

type EnrollmentDraft = {
  status: string;
  accessBarrier: string;
  learningCenterName: string;
};

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  href?: string;
  cta?: string;
};

const ENROLLMENT_STATUSES = ["PENDING", "ACTIVE", "AT_RISK", "WITHDRAWN", "COMPLETED"] as const;
const GUIDE_STEPS = [
  "Pastikan Dinas menambahkan sekolah Anda sebagai Induk pada program PJJ.",
  "Buat kelas PJJ dan pilih guru koordinator.",
  "Isi roster siswa lewat Kelola roster.",
  "Kembali ke halaman ini dan aktifkan roster PJJ.",
  "Guru jadwalkan sesi dan masuk live di /dashboard/pjj.",
];

function isActiveEnrollment(status: string) {
  return status === "ACTIVE" || status === "AT_RISK";
}

function enrolledCount(room: PjjClass) {
  return room.students.filter((student) =>
    student.pjjEnrollments.some(
      (item) => item.programId === room.pjjProgram?.id && isActiveEnrollment(item.status)
    )
  ).length;
}

export function SchoolPjjClient({ hasSchool }: { hasSchool: boolean }) {
  const [links, setLinks] = useState<ProgramLink[]>([]);
  const [classes, setClasses] = useState<PjjClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [highlightClassId, setHighlightClassId] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({
    programId: "",
    name: "PJJ Kelas X",
    jenjang: "Kelas X",
    schoolYear: "2026/2027",
    coordinatorId: "",
  });
  const [teacherForm, setTeacherForm] = useState({
    classRoomId: "",
    teacherId: "",
    subject: "",
    role: "SUBJECT_TEACHER",
  });
  const [enrollmentDrafts, setEnrollmentDrafts] = useState<Record<string, EnrollmentDraft>>({});

  const load = useCallback(async () => {
    if (!hasSchool) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/school/pjj");
      const data = await readResponseJson<{
        programLinks: ProgramLink[];
        classes: PjjClass[];
        teachers: Teacher[];
      }>(response);
      if (!response.ok) throw new Error(data.error || "Gagal memuat kelas PJJ.");
      setLinks(data.programLinks);
      setClasses(data.classes);
      setTeachers(data.teachers);
      const drafts: Record<string, EnrollmentDraft> = {};
      for (const room of data.classes as PjjClass[]) {
        for (const student of room.students) {
          const enrollment =
            student.pjjEnrollments.find((item) => item.programId === room.pjjProgram?.id) ||
            student.pjjEnrollments[0];
          if (!enrollment) continue;
          drafts[enrollment.id] = {
            status: enrollment.status,
            accessBarrier: enrollment.accessBarrier || "",
            learningCenterName: enrollment.learningCenterName || "",
          };
        }
      }
      setEnrollmentDrafts(drafts);
      setClassForm((current) => ({
        ...current,
        programId:
          current.programId ||
          data.programLinks.find((link: ProgramLink) => link.role === "INDUK")?.program.id ||
          "",
        coordinatorId: current.coordinatorId || data.teachers[0]?.id || "",
      }));
      setTeacherForm((current) => ({
        ...current,
        classRoomId: current.classRoomId || data.classes[0]?.id || "",
        teacherId: current.teacherId || data.teachers[0]?.id || "",
      }));
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [hasSchool]);

  useEffect(() => {
    void load();
  }, [load]);

  const indukPrograms = useMemo(
    () => links.filter((link) => link.role === "INDUK" && ["DRAFT", "ACTIVE"].includes(link.program.status)),
    [links]
  );
  const mitraOnly = links.length > 0 && indukPrograms.length === 0 && links.every((link) => link.role === "MITRA");
  const totalStudents = classes.reduce((sum, room) => sum + room.students.length, 0);
  const totalEnrolled = classes.reduce((sum, room) => sum + enrolledCount(room), 0);
  const totalSessions = classes.reduce((sum, room) => sum + room.liveClassSessions.length, 0);

  const checklist: ChecklistItem[] = useMemo(() => {
    const hasInduk = indukPrograms.length > 0;
    const hasTeachers = teachers.length > 0;
    const hasClasses = classes.length > 0;
    const hasRoster = totalStudents > 0;
    const hasEnroll = totalEnrolled > 0;
    const hasSessions = totalSessions > 0;
    return [
      {
        id: "link",
        label: "Terhubung program Dinas",
        done: links.length > 0,
        detail:
          links.length > 0
            ? `${links.length} program tertaut (${indukPrograms.length} Induk).`
            : "Belum ada program. Minta Dinas menambahkan sekolah Anda.",
      },
      {
        id: "induk",
        label: "Peran sekolah Induk aktif",
        done: hasInduk,
        detail: hasInduk
          ? `${indukPrograms.length} program Induk siap dipakai.`
          : mitraOnly
            ? "Sekolah hanya Mitra — hanya Induk yang dapat membuat kelas."
            : "Minta Dinas menetapkan sekolah Anda sebagai Induk (status DRAFT/ACTIVE).",
      },
      {
        id: "teachers",
        label: "Minimal 1 guru di sekolah",
        done: hasTeachers,
        detail: hasTeachers
          ? `${teachers.length} guru tersedia sebagai koordinator.`
          : "Tambahkan guru terlebih dahulu agar bisa memilih koordinator.",
        href: "/school/teachers",
        cta: "Kelola guru",
      },
      {
        id: "classes",
        label: "Kelas PJJ dibuat",
        done: hasClasses,
        detail: hasClasses ? `${classes.length} kelas PJJ.` : "Buat kelas lewat formulir di bawah.",
      },
      {
        id: "roster",
        label: "Roster siswa terisi",
        done: hasRoster,
        detail: hasRoster
          ? `${totalStudents} siswa di kelas PJJ.`
          : "Tambah siswa lewat Kelola roster untuk setiap kelas.",
        href: classes[0] ? `/school/classes?classRoomId=${classes[0].id}` : "/school/classes",
        cta: "Kelola roster",
      },
      {
        id: "enroll",
        label: "Roster PJJ diaktifkan",
        done: hasEnroll,
        detail: hasEnroll
          ? `${totalEnrolled} siswa aktif/terpantau di program.`
          : "Setelah roster terisi, klik Aktifkan roster PJJ pada kartu kelas.",
      },
      {
        id: "sessions",
        label: "Sesi live terjadwal",
        done: hasSessions,
        detail: hasSessions
          ? `${totalSessions} sesi tercatat.`
          : "Guru menjadwalkan dan masuk live di dashboard PJJ.",
        href: "/dashboard/pjj",
        cta: "Buka dashboard guru",
      },
    ];
  }, [
    classes,
    indukPrograms.length,
    links.length,
    mitraOnly,
    teachers.length,
    totalEnrolled,
    totalSessions,
    totalStudents,
  ]);

  function validateCreateClass() {
    const next: Record<string, string> = {};
    if (indukPrograms.length === 0) {
      next.programId = mitraOnly
        ? "Sekolah Mitra tidak dapat membuat kelas. Minta Dinas mengubah peran menjadi Induk."
        : "Belum ada program Induk. Minta Dinas menambahkan sekolah Anda sebagai Induk.";
    } else if (!classForm.programId) {
      next.programId = "Pilih program terlebih dahulu.";
    }
    if (teachers.length === 0) {
      next.coordinatorId = "Belum ada guru di sekolah. Tambahkan guru di menu Guru.";
    } else if (!classForm.coordinatorId) {
      next.coordinatorId = "Pilih guru koordinator.";
    }
    if (!classForm.name.trim() || classForm.name.trim().length < 2) {
      next.name = "Nama kelas minimal 2 karakter.";
    }
    if (!classForm.jenjang.trim()) {
      next.jenjang = "Isi tingkat kelas.";
    }
    if (!classForm.schoolYear.trim() || classForm.schoolYear.trim().length < 4) {
      next.schoolYear = "Isi tahun ajaran (contoh 2026/2027).";
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(payload: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/school/pjj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readResponseJson<{
        nextStep?: string;
        classRoom?: { id: string };
        enrolled?: number;
      }>(response);
      if (!response.ok) throw new Error(data.error || "Operasi gagal.");
      const nextStep = typeof data.nextStep === "string" ? data.nextStep : "";
      const createdId = data.classRoom?.id;
      if (createdId) setHighlightClassId(createdId);
      setMessageTone("success");
      setMessage(
        [successMessage.replace("{count}", String(data.enrolled ?? "")), nextStep].filter(Boolean).join(" ")
      );
      await load();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Operasi gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function createClass() {
    if (!validateCreateClass()) {
      setMessageTone("error");
      setMessage("Lengkapi formulir sebelum membuat kelas.");
      return;
    }
    await submit(
      { action: "createClass", ...classForm, name: classForm.name.trim(), jenjang: classForm.jenjang.trim() },
      "Kelas PJJ berhasil dibuat."
    );
  }

  async function saveEnrollment(enrollmentId: string) {
    const draft = enrollmentDrafts[enrollmentId];
    if (!draft) return;
    await submit(
      {
        action: "updateEnrollment",
        enrollmentId,
        status: draft.status,
        accessBarrier: draft.accessBarrier.trim() || null,
        learningCenterName: draft.learningCenterName.trim() || null,
      },
      "Status pendaftaran siswa diperbarui."
    );
  }

  if (!hasSchool) {
    return (
      <Card className="rounded-[24px] border-amber-200 bg-amber-50">
        <CardContent className="p-6">
          <h1 className="text-xl font-black text-amber-950">Akun belum terhubung ke sekolah</h1>
          <p className="mt-2 text-sm text-amber-800">
            Hubungkan akun melalui Super Admin sebelum mengelola PJJ.
          </p>
        </CardContent>
      </Card>
    );
  }

  const canCreate = indukPrograms.length > 0 && teachers.length > 0;
  const messageClass =
    messageTone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : messageTone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-emerald-100 bg-white text-emerald-800";

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm lg:p-8">
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
          <RadioTower className="mr-1 h-3.5 w-3.5" />
          Operasional Sekolah
        </Badge>
        <h1 className="mt-4 text-3xl font-black">Kelas PJJ</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Alur singkat: program Induk dari Dinas → buat kelas + koordinator → isi roster siswa → aktifkan
          roster PJJ → guru jadwalkan & masuk live di dashboard PJJ.
        </p>
        <ol className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
          {GUIDE_STEPS.map((step, index) => (
            <li key={step} className="rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2">
              <span className="mr-1 text-emerald-700">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      {message ? (
        <div role="status" className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${messageClass}`}>
          {message}
        </div>
      ) : null}

      <Card className="rounded-[24px] border-emerald-100">
        <CardHeader>
          <CardTitle className="text-lg">Checklist siap operasional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklist.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {item.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">{item.detail}</p>
                </div>
              </div>
              {!item.done && item.href && item.cta ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={item.href}>{item.cta}</Link>
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="rounded-[24px] border-emerald-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-emerald-700" />
              Buat kelas PJJ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {indukPrograms.length === 0 ? (
              <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  {mitraOnly ? (
                    <p>
                      Sekolah Anda terdaftar sebagai <strong>Mitra</strong>. Mitra tidak membuat kelas;
                      minta Dinas mengubah peran menjadi <strong>Induk</strong> jika sekolah Anda yang
                      mengoperasikan kelas.
                    </p>
                  ) : (
                    <p>
                      Belum ada program Induk aktif. Minta Dinas menambahkan sekolah Anda sebagai{" "}
                      <strong>Induk</strong> pada program berstatus DRAFT atau ACTIVE.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
            {teachers.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <span>Belum ada guru di sekolah. Koordinator wajib dipilih dari daftar guru.</span>
                <Button asChild size="sm" variant="outline">
                  <Link href="/school/teachers">Tambah guru</Link>
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="schoolProgram">Program</Label>
              <select
                id="schoolProgram"
                value={classForm.programId}
                onChange={(event) => {
                  setClassForm((current) => ({ ...current, programId: event.target.value }));
                  setFormErrors((current) => ({ ...current, programId: "" }));
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Pilih program</option>
                {indukPrograms.map((link) => (
                  <option key={link.id} value={link.program.id}>
                    {link.program.name} · {link.program.schoolYear}
                  </option>
                ))}
              </select>
              {formErrors.programId ? (
                <p className="text-xs font-semibold text-rose-600">{formErrors.programId}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="className">Nama kelas</Label>
                <Input
                  id="className"
                  value={classForm.name}
                  onChange={(event) => {
                    setClassForm((current) => ({ ...current, name: event.target.value }));
                    setFormErrors((current) => ({ ...current, name: "" }));
                  }}
                />
                {formErrors.name ? (
                  <p className="text-xs font-semibold text-rose-600">{formErrors.name}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Tingkat</Label>
                <Input
                  id="level"
                  value={classForm.jenjang}
                  onChange={(event) => {
                    setClassForm((current) => ({ ...current, jenjang: event.target.value }));
                    setFormErrors((current) => ({ ...current, jenjang: "" }));
                  }}
                />
                {formErrors.jenjang ? (
                  <p className="text-xs font-semibold text-rose-600">{formErrors.jenjang}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="year">Tahun ajaran</Label>
                <Input
                  id="year"
                  value={classForm.schoolYear}
                  onChange={(event) => {
                    setClassForm((current) => ({ ...current, schoolYear: event.target.value }));
                    setFormErrors((current) => ({ ...current, schoolYear: "" }));
                  }}
                />
                {formErrors.schoolYear ? (
                  <p className="text-xs font-semibold text-rose-600">{formErrors.schoolYear}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="coordinator">Koordinator</Label>
                <select
                  id="coordinator"
                  value={classForm.coordinatorId}
                  onChange={(event) => {
                    setClassForm((current) => ({ ...current, coordinatorId: event.target.value }));
                    setFormErrors((current) => ({ ...current, coordinatorId: "" }));
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Pilih guru</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                {formErrors.coordinatorId ? (
                  <p className="text-xs font-semibold text-rose-600">{formErrors.coordinatorId}</p>
                ) : null}
              </div>
            </div>

            <Button disabled={busy} onClick={() => void createClass()}>
              <Plus className="h-4 w-4" />
              Buat Kelas
            </Button>
            {!canCreate ? (
              <p className="text-xs text-slate-500">
                Tombol tetap bisa diklik agar Anda melihat pesan yang perlu dilengkapi (program Induk
                dan/atau guru).
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-emerald-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-emerald-700" />
              Tugaskan guru
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignClass">Kelas</Label>
              <select
                id="assignClass"
                value={teacherForm.classRoomId}
                onChange={(event) =>
                  setTeacherForm((current) => ({ ...current, classRoomId: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Pilih kelas</option>
                {classes.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignTeacher">Guru</Label>
              <select
                id="assignTeacher"
                value={teacherForm.teacherId}
                onChange={(event) =>
                  setTeacherForm((current) => ({ ...current, teacherId: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Pilih guru</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subject">Mata pelajaran</Label>
                <Input
                  id="subject"
                  placeholder="Matematika"
                  value={teacherForm.subject}
                  onChange={(event) =>
                    setTeacherForm((current) => ({ ...current, subject: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacherRole">Peran</Label>
                <select
                  id="teacherRole"
                  value={teacherForm.role}
                  onChange={(event) =>
                    setTeacherForm((current) => ({ ...current, role: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="SUBJECT_TEACHER">Guru Mata Pelajaran</option>
                  <option value="TUTOR">Tutor</option>
                  <option value="COUNSELOR">Pendamping/BK</option>
                  <option value="SUBSTITUTE">Guru Pengganti</option>
                  <option value="COORDINATOR">Koordinator</option>
                </select>
              </div>
            </div>
            <Button
              disabled={
                busy || !teacherForm.classRoomId || !teacherForm.teacherId || !teacherForm.subject.trim()
              }
              onClick={() =>
                void submit({ action: "assignTeacher", ...teacherForm }, "Guru berhasil ditugaskan.")
              }
            >
              <UserPlus className="h-4 w-4" />
              Simpan Penugasan
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">Daftar kelas</h2>
        <Button asChild variant="outline">
          <Link href="/school/classes">
            <Users className="h-4 w-4" />
            Kelola roster
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat kelas...</p>
      ) : classes.length === 0 ? (
        <Card className="rounded-[24px] border-dashed">
          <CardContent className="space-y-3 p-8 text-center text-sm text-slate-500">
            <p>Belum ada kelas PJJ.</p>
            <p className="text-xs">
              Setelah program Induk dan guru tersedia, buat kelas lewat formulir di atas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {classes.map((room) => {
            const enrolled = enrolledCount(room);
            const rosterHref = `/school/classes?classRoomId=${room.id}`;
            const needsRoster = room.students.length === 0;
            const needsEnroll = room.students.length > 0 && enrolled === 0;
            const isHighlight = highlightClassId === room.id;

            return (
              <Card
                key={room.id}
                className={`rounded-[24px] border-emerald-100 ${isHighlight ? "ring-2 ring-emerald-400" : ""}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{room.name}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {room.jenjang} · {room.tahunAjaran}
                      </p>
                    </div>
                    <Badge>{room.deliveryMode}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-emerald-700">{room.pjjProgram?.name}</p>

                  {isHighlight ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                      Langkah berikutnya: tambah siswa di roster, lalu aktifkan roster PJJ di kartu ini.
                    </div>
                  ) : null}
                  {needsRoster ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Belum ada siswa. Tambahkan siswa ke kelas ini lewat Kelola roster, lalu kembali ke
                      sini untuk mengaktifkan roster PJJ.
                    </div>
                  ) : null}
                  {needsEnroll ? (
                    <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                      Ada {room.students.length} siswa di roster, tetapi belum aktif di program PJJ. Klik
                      Aktifkan roster PJJ di bawah.
                    </div>
                  ) : null}
                  {enrolled > 0 ? (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800">
                      {enrolled} siswa terdaftar aktif/terpantau pada program PJJ.
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <GraduationCap className="h-4 w-4 text-emerald-600" />
                      <p className="mt-2 text-lg font-black">{room.teacherAssignments.length}</p>
                      <p className="text-[11px] text-slate-500">Guru</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <Users className="h-4 w-4 text-emerald-600" />
                      <p className="mt-2 text-lg font-black">
                        {enrolled}/{room.students.length}
                      </p>
                      <p className="text-[11px] text-slate-500">Terdaftar</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <CalendarClock className="h-4 w-4 text-violet-600" />
                      <p className="mt-2 text-lg font-black">{room.liveClassSessions.length}</p>
                      <p className="text-[11px] text-slate-500">Sesi</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {room.teacherAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs"
                      >
                        <span className="font-bold">{assignment.teacher.name}</span>
                        <span className="text-slate-500">
                          {assignment.subject} · {assignment.role.replaceAll("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Siswa & status PJJ
                    </p>
                    {room.students.length === 0 ? (
                      <div className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-slate-500">
                        <p>Belum ada siswa di kelas ini.</p>
                        <Button asChild size="sm" variant="outline" className="mt-3">
                          <Link href={rosterHref}>Tambah siswa ke kelas ini</Link>
                        </Button>
                      </div>
                    ) : (
                      room.students.map((student) => {
                        const enrollment =
                          student.pjjEnrollments.find((item) => item.programId === room.pjjProgram?.id) ||
                          student.pjjEnrollments[0];
                        if (!enrollment) {
                          return (
                            <div key={student.id} className="rounded-xl border px-3 py-2 text-xs">
                              <span className="font-bold">{student.name}</span>
                              <span className="ml-2 text-slate-500">Belum terdaftar PJJ</span>
                            </div>
                          );
                        }
                        const draft = enrollmentDrafts[enrollment.id] || {
                          status: enrollment.status,
                          accessBarrier: enrollment.accessBarrier || "",
                          learningCenterName: enrollment.learningCenterName || "",
                        };
                        const active = isActiveEnrollment(draft.status);
                        return (
                          <div
                            key={student.id}
                            className={`space-y-2 rounded-xl border px-3 py-3 ${
                              active ? "border-emerald-200 bg-emerald-50/40" : ""
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold">{student.name}</p>
                                <p className="text-[11px] text-slate-500">{student.nis || "Tanpa NIS"}</p>
                              </div>
                              <select
                                value={draft.status}
                                onChange={(event) =>
                                  setEnrollmentDrafts((current) => ({
                                    ...current,
                                    [enrollment.id]: { ...draft, status: event.target.value },
                                  }))
                                }
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                              >
                                {ENROLLMENT_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status.replaceAll("_", " ")}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <Input
                              placeholder="Hambatan akses (opsional)"
                              value={draft.accessBarrier}
                              onChange={(event) =>
                                setEnrollmentDrafts((current) => ({
                                  ...current,
                                  [enrollment.id]: { ...draft, accessBarrier: event.target.value },
                                }))
                              }
                              className="h-8 text-xs"
                            />
                            <Input
                              placeholder="Pusat belajar (opsional)"
                              value={draft.learningCenterName}
                              onChange={(event) =>
                                setEnrollmentDrafts((current) => ({
                                  ...current,
                                  [enrollment.id]: { ...draft, learningCenterName: event.target.value },
                                }))
                              }
                              className="h-8 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void saveEnrollment(enrollment.id)}
                            >
                              Simpan
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={rosterHref}>
                        <Users className="h-4 w-4" />
                        Tambah siswa ke kelas ini
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant={needsEnroll ? "default" : "outline"}
                      disabled={busy || room.students.length === 0}
                      onClick={() =>
                        void submit(
                          { action: "enrollRoster", classRoomId: room.id },
                          "{count} siswa berhasil diaktifkan pada program PJJ. Guru dapat menjadwalkan sesi live."
                        )
                      }
                    >
                      <BookOpenCheck className="h-4 w-4" />
                      Aktifkan roster PJJ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
