"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, CheckCircle2, GraduationCap, Loader2, Plus, School, Trash2, UserPlus, Users } from "lucide-react";
import { StudentAccountActions } from "@/components/school/student-account-actions";
import { StudentParentAccessActions } from "@/components/school/student-parent-access-actions";
import { StudentImportTools } from "@/components/classes/student-import-tools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JENJANG_OPTIONS } from "@/lib/curriculum";
import { currentTahunAjaran } from "@/lib/teacher-profile";

type TeacherOption = {
  id: string;
  name: string;
  email: string;
};

type StudentRow = {
  id: string;
  nis: string | null;
  name: string;
  gender: string | null;
  parentAccessEnabled: boolean;
  user: { email: string } | null;
  _count: { records: number; gradeRecords: number };
};

type ClassRow = {
  id: string;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  teacher: { id: string; name: string; email: string } | null;
  students: StudentRow[];
  _count: { students: number; sessions: number };
};

type Props = {
  schoolName: string;
  teachers: TeacherOption[];
  initialClasses: ClassRow[];
};

function jenjangLabel(value: string) {
  return JENJANG_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function SchoolClassesClient({ schoolName, teachers, initialClasses }: Props) {
  const searchParams = useSearchParams();
  const focusClassId = searchParams.get("classRoomId") || "";
  const initialSelected =
    (focusClassId && initialClasses.some((item) => item.id === focusClassId) ? focusClassId : null) ||
    initialClasses[0]?.id ||
    "";
  const [classes, setClasses] = useState(initialClasses);
  const [selectedClassId, setSelectedClassId] = useState(initialSelected);
  const [showCreate, setShowCreate] = useState(initialClasses.length === 0);
  const [creating, setCreating] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const [actingStudentId, setActingStudentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    focusClassId && initialClasses.some((item) => item.id === focusClassId)
      ? "Kelas dari PJJ dipilih. Tambahkan siswa di sini, lalu kembali ke menu PJJ untuk mengaktifkan roster."
      : ""
  );
  const [form, setForm] = useState({
    name: "",
    jenjang: "smp",
    tahunAjaran: currentTahunAjaran(),
    teacherId: teachers[0]?.id ?? "",
  });
  const [studentForm, setStudentForm] = useState({ nis: "", name: "", gender: "" });

  useEffect(() => {
    if (!focusClassId) return;
    if (!classes.some((item) => item.id === focusClassId)) return;
    setSelectedClassId(focusClassId);
  }, [classes, focusClassId]);

  const selectedClass = useMemo(
    () => classes.find((classRoom) => classRoom.id === selectedClassId) ?? classes[0] ?? null,
    [classes, selectedClassId]
  );
  const totalStudents = classes.reduce((sum, classRoom) => sum + classRoom.students.length, 0);

  const reloadClass = async (classId = selectedClass?.id) => {
    if (!classId) return;
    const res = await fetch(`/api/attendance/classes/${classId}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || "Gagal memuat ulang kelas.");
      return;
    }
    setClasses((current) =>
      current.map((classRoom) =>
        classRoom.id === classId
          ? {
              ...classRoom,
              ...data.classRoom,
              students: data.classRoom.students ?? [],
              _count: data.classRoom._count,
            }
          : classRoom
      )
    );
  };

  const createClass = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/attendance/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat kelas");
      const teacher = teachers.find((item) => item.id === form.teacherId) ?? null;
      const nextClass: ClassRow = {
        ...data.classRoom,
        teacher,
        students: [],
        _count: data.classRoom._count ?? { students: 0, sessions: 0 },
      };
      setClasses((current) => [...current, nextClass].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedClassId(nextClass.id);
      setShowCreate(false);
      setForm({
        name: "",
        jenjang: "smp",
        tahunAjaran: currentTahunAjaran(),
        teacherId: teachers[0]?.id ?? "",
      });
      setNotice("Kelas berhasil dibuat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat kelas");
    } finally {
      setCreating(false);
    }
  };

  const addStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClass) return;
    setSavingStudent(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/attendance/classes/${selectedClass.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nis: studentForm.nis || undefined,
          name: studentForm.name,
          gender: studentForm.gender || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah siswa");
      setStudentForm({ nis: "", name: "", gender: "" });
      setNotice("Siswa berhasil ditambahkan.");
      await reloadClass(selectedClass.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah siswa");
    } finally {
      setSavingStudent(false);
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!selectedClass || !confirm("Hapus siswa dari roster kelas?")) return;
    setActingStudentId(studentId);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/attendance/students/${studentId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus siswa");
      setNotice("Siswa berhasil dihapus dari roster aktif.");
      await reloadClass(selectedClass.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus siswa");
    } finally {
      setActingStudentId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_20px_65px_rgba(15,76,129,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge className="bg-emerald-600 text-white">Manajemen Kelas</Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">
              Kelas & Roster Siswa
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Kelola kelas resmi {schoolName}. Kelas yang dibuat di sini langsung
              dapat dipakai guru pengelola untuk absensi, jurnal, dan penilaian.
              Jika sebelumnya guru pertama sudah membuat kelas dan import siswa,
              data tersebut tetap muncul di panel sekolah selama terhubung ke
              sekolah yang sama.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                Satu roster sekolah
              </Badge>
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                Guru pengelola tetap jelas
              </Badge>
            </div>
          </div>
          <Button
            type="button"
            variant="brand"
            className="rounded-xl"
            onClick={() => setShowCreate((value) => !value)}
          >
            <Plus className="h-4 w-4" />
            Tambah Kelas
          </Button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[22px] border border-emerald-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,76,129,0.05)]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-950">{teachers.length}</p>
              <p className="text-xs font-extrabold uppercase text-slate-500">Guru terhubung</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Guru harus terhubung ke sekolah sebelum bisa dipilih sebagai pengelola kelas.
          </p>
        </div>
        <div className="rounded-[22px] border border-emerald-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,76,129,0.05)]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <School className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-950">{classes.length}</p>
              <p className="text-xs font-extrabold uppercase text-slate-500">Kelas resmi</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Kelas di panel ini menjadi roster bersama untuk guru dan portal siswa.
          </p>
        </div>
        <div className="rounded-[22px] border border-emerald-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,76,129,0.05)]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-950">{totalStudents}</p>
              <p className="text-xs font-extrabold uppercase text-slate-500">Siswa aktif</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Data siswa cukup dibuat sekali, lalu dipakai guru yang terhubung ke kelas.
          </p>
        </div>
      </div>

      {teachers.length === 0 ? (
        <Card className="rounded-[24px] border-amber-100 bg-amber-50/80 shadow-[0_14px_34px_rgba(146,64,14,0.06)]">
          <CardContent className="flex gap-3 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-amber-700 ring-1 ring-amber-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-extrabold text-amber-950">
                Belum ada guru yang terhubung ke {schoolName}
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-900">
                Buat atau edit akun guru dari Super Admin, lalu pilih sekolah ini
                pada data pengguna. Setelah itu admin sekolah bisa membuat kelas
                resmi dan memilih guru pengelola.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showCreate ? (
        <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
          <CardHeader>
            <CardTitle className="text-base font-extrabold">Tambah kelas sekolah</CardTitle>
          </CardHeader>
          <CardContent>
            {teachers.length === 0 ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                Belum ada guru yang terhubung ke sekolah ini. Hubungkan akun guru
                terlebih dahulu melalui Super Admin sebelum membuat kelas.
              </div>
            ) : (
              <form onSubmit={createClass} className="grid gap-4 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Nama Kelas</Label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                    placeholder="Contoh: X IPA 1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jenjang</Label>
                  <Select
                    value={form.jenjang}
                    onValueChange={(value) => setForm((state) => ({ ...state, jenjang: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JENJANG_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tahun Ajaran</Label>
                  <Input
                    value={form.tahunAjaran}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, tahunAjaran: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Guru Pengelola</Label>
                  <Select
                    value={form.teacherId}
                    onValueChange={(value) => setForm((state) => ({ ...state, teacherId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih guru" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 lg:col-span-4">
                  <Button type="submit" disabled={creating || !form.teacherId}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Simpan Kelas
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                    Batal
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
          <CardHeader>
            <CardTitle className="text-base font-extrabold">Daftar Kelas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {classes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-emerald-100 p-5 text-center">
                <School className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-bold">Belum ada kelas</p>
                <p className="mt-1 text-sm text-slate-500">
                  Tambahkan kelas pertama setelah guru pengelola tersedia.
                </p>
              </div>
            ) : (
              classes.map((classRoom) => {
                const active = selectedClass?.id === classRoom.id;
                return (
                  <button
                    key={classRoom.id}
                    type="button"
                    onClick={() => setSelectedClassId(classRoom.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      active
                        ? "border-blue-600 bg-emerald-50"
                        : "border-emerald-100 bg-white hover:bg-emerald-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-slate-950">{classRoom.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {jenjangLabel(classRoom.jenjang)} · {classRoom.tahunAjaran}
                        </p>
                      </div>
                      <Badge variant="secondary">{classRoom.students.length} siswa</Badge>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Pengelola: {classRoom.teacher?.name || "Belum terhubung"}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {selectedClass ? (
            <>
              <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
                <CardContent className="grid gap-4 p-5 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <p className="text-sm font-bold text-emerald-700">Kelas aktif</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">
                      {selectedClass.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {jenjangLabel(selectedClass.jenjang)} · {selectedClass.tahunAjaran}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <Users className="h-5 w-5 text-emerald-700" />
                    <p className="mt-3 text-2xl font-black">{selectedClass.students.length}</p>
                    <p className="text-xs font-bold text-slate-500">Siswa aktif</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <BookOpen className="h-5 w-5 text-emerald-700" />
                    <p className="mt-3 text-2xl font-black">{selectedClass._count.sessions}</p>
                    <p className="text-xs font-bold text-slate-500">Sesi absensi</p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-extrabold">
                      <UserPlus className="h-4 w-4" />
                      Tambah Siswa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={addStudent} className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>NIS</Label>
                        <Input
                          value={studentForm.nis}
                          onChange={(event) =>
                            setStudentForm((state) => ({ ...state, nis: event.target.value }))
                          }
                          placeholder="Opsional"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Nama Siswa</Label>
                        <Input
                          value={studentForm.name}
                          onChange={(event) =>
                            setStudentForm((state) => ({ ...state, name: event.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Gender</Label>
                        <Select
                          value={studentForm.gender || "none"}
                          onValueChange={(value) =>
                            setStudentForm((state) => ({
                              ...state,
                              gender: value === "none" ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Opsional</SelectItem>
                            <SelectItem value="L">Laki-laki</SelectItem>
                            <SelectItem value="P">Perempuan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end sm:col-span-2">
                        <Button type="submit" disabled={savingStudent} className="w-full">
                          {savingStudent ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Tambah Siswa
                        </Button>
                      </div>
                    </form>

                    <StudentImportTools
                      classId={selectedClass.id}
                      saving={savingStudent}
                      setSaving={setSavingStudent}
                      setError={setError}
                      onImported={() => reloadClass(selectedClass.id)}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
                  <CardHeader>
                    <CardTitle className="text-base font-extrabold">Guru Pengelola</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-emerald-700 ring-1 ring-blue-100">
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-950">
                            {selectedClass.teacher?.name || "Belum ada guru"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {selectedClass.teacher?.email || "Hubungkan guru melalui Super Admin"}
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        Guru pengelola dapat memakai kelas ini dari dashboard guru untuk
                        absensi, jurnal, penilaian, dan dokumen pembelajaran.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
                <CardHeader className="border-b border-blue-50 bg-slate-50/70">
                  <CardTitle className="text-base font-extrabold">Roster Siswa</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  {selectedClass.students.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-3 font-semibold text-slate-950">Belum ada siswa</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Tambahkan siswa satu per satu atau upload memakai template CSV.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr className="border-b bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-3 font-bold">Siswa</th>
                          <th className="px-5 py-3 font-bold">Akun Login</th>
                          <th className="px-5 py-3 font-bold">Orang Tua</th>
                          <th className="px-5 py-3 font-bold">Absensi</th>
                          <th className="px-5 py-3 font-bold">Nilai</th>
                          <th className="px-5 py-3 font-bold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClass.students.map((student) => (
                          <tr key={student.id} className="border-b last:border-0">
                            <td className="px-5 py-4">
                              <p className="font-bold text-slate-950">{student.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {student.nis ? `NIS ${student.nis}` : "NIS belum diisi"}
                                {student.gender ? ` · ${student.gender}` : ""}
                              </p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <StudentAccountActions
                                studentId={student.id}
                                studentName={student.name}
                                hasAccount={Boolean(student.user)}
                                accountEmail={student.user?.email}
                                onChanged={() => reloadClass(selectedClass.id)}
                              />
                            </td>
                            <td className="px-5 py-4 align-top">
                              <StudentParentAccessActions
                                studentId={student.id}
                                studentName={student.name}
                                enabled={student.parentAccessEnabled}
                                onChanged={() => reloadClass(selectedClass.id)}
                              />
                            </td>
                            <td className="px-5 py-4 font-semibold">{student._count.records}</td>
                            <td className="px-5 py-4 font-semibold">
                              {student._count.gradeRecords}
                            </td>
                            <td className="px-5 py-4">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={actingStudentId === student.id}
                                onClick={() => removeStudent(student.id)}
                              >
                                {actingStudentId === student.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
              <CardContent className="p-8 text-center">
                <School className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-4 font-extrabold text-slate-950">Pilih atau buat kelas</p>
                <p className="mt-2 text-sm text-slate-500">
                  Setelah kelas dipilih, roster siswa dan akun login siswa bisa dikelola
                  dari panel ini.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
