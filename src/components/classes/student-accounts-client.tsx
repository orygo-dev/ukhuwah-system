"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  Search,
  School,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BulkStudentAccountActions } from "@/components/school/bulk-student-account-actions";
import { StudentAccountActions } from "@/components/school/student-account-actions";
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
import { useDashboardUser } from "@/hooks/use-dashboard-user";
import { JENJANG_OPTIONS } from "@/lib/curriculum";
import { currentTahunAjaran } from "@/lib/teacher-profile";

type ManagedClass = {
  id: string;
  teacherId: string;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  teacher?: { id: string; name: string } | null;
  _count: { students: number };
};

type Student = {
  id: string;
  nis: string | null;
  name: string;
  gender: string | null;
  user?: { email: string } | null;
};

type ClassDetail = ManagedClass & { students: Student[] };

export function StudentAccountsClient() {
  const dashboardUser = useDashboardUser();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const requestedClassId = searchParams.get("classRoomId") || "";
  const [classes, setClasses] = useState<ManagedClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classRoom, setClassRoom] = useState<ClassDetail | null>(null);
  const [query, setQuery] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [creatingClass, setCreatingClass] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [classForm, setClassForm] = useState({
    name: "",
    jenjang: "sma",
    tahunAjaran: currentTahunAjaran(),
  });
  const [studentForm, setStudentForm] = useState({
    name: "",
    nis: "",
    gender: "",
    createAccount: false,
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    setError("");
    try {
      const response = await fetch("/api/attendance/classes", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat kelas.");

      const available = (data.classes || []).filter((item: ManagedClass) =>
        session?.user?.role === "TEACHER"
          ? item.teacherId === session.user.id
          : true
      );
      setClasses(available);
      setSelectedClassId((current) =>
        current && available.some((item: ManagedClass) => item.id === current)
          ? current
          : requestedClassId &&
              available.some((item: ManagedClass) => item.id === requestedClassId)
            ? requestedClassId
          : available[0]?.id || ""
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat kelas.");
    } finally {
      setLoadingClasses(false);
    }
  }, [requestedClassId, session?.user?.id, session?.user?.role]);

  const loadStudents = useCallback(async () => {
    if (!selectedClassId) {
      setClassRoom(null);
      return;
    }

    setLoadingStudents(true);
    setError("");
    try {
      const response = await fetch(`/api/attendance/classes/${selectedClassId}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat siswa.");
      setClassRoom(data.classRoom);
    } catch (err) {
      setClassRoom(null);
      setError(err instanceof Error ? err.message : "Gagal memuat siswa.");
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClassId]);

  const createManagedClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creatingClass) return;
    setCreatingClass(true);
    setError("");
    try {
      const response = await fetch("/api/attendance/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuat kelas.");
      const classId = data.classRoom?.id as string | undefined;
      if (!classId) throw new Error("Kelas berhasil dibuat tetapi tidak dapat dibuka.");
      setClassForm({
        name: "",
        jenjang: "sma",
        tahunAjaran: currentTahunAjaran(),
      });
      await loadClasses();
      setSelectedClassId(classId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat kelas.");
    } finally {
      setCreatingClass(false);
    }
  };

  const addStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClassId || addingStudent) return;
    if (studentForm.createAccount) {
      const email = studentForm.email.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        setError("Email siswa wajib diisi untuk membuat akun login.");
        return;
      }
      if (studentForm.password.length < 8) {
        setError("Password akun siswa minimal 8 karakter.");
        return;
      }
    }
    setAddingStudent(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        `/api/attendance/classes/${selectedClassId}/students`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: studentForm.name,
            nis: studentForm.nis || undefined,
            gender: studentForm.gender || undefined,
            ...(studentForm.createAccount
              ? {
                  email: studentForm.email.trim().toLowerCase(),
                  password: studentForm.password,
                }
              : {}),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menambahkan siswa.");
      setStudentForm({
        name: "",
        nis: "",
        gender: "",
        createAccount: studentForm.createAccount,
        email: "",
        password: "",
      });
      setSuccess(
        data.accountCreated
          ? "Siswa ditambahkan dan akun login berhasil dibuat."
          : "Siswa berhasil ditambahkan ke kelas."
      );
      await loadStudents();
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan siswa.");
    } finally {
      setAddingStudent(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) void loadClasses();
  }, [loadClasses, session?.user?.id]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const students = useMemo(() => classRoom?.students || [], [classRoom]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredStudents = useMemo(
    () =>
      normalizedQuery
        ? students.filter(
            (student) =>
              student.name.toLowerCase().includes(normalizedQuery) ||
              student.nis?.toLowerCase().includes(normalizedQuery) ||
              student.user?.email.toLowerCase().includes(normalizedQuery)
          )
        : students,
    [normalizedQuery, students]
  );
  const activeAccounts = students.reduce(
    (total, student) => total + (student.user ? 1 : 0),
    0
  );
  const studentsWithoutAccounts = students
    .filter((student) => !student.user)
    .map((student) => ({
      id: student.id,
      name: student.name,
      nis: student.nis,
      className: classRoom?.name || "Kelas",
    }));
  const defaultDomain = session?.user?.email?.includes("@")
    ? session.user.email.split("@")[1]
    : "";

  return (
    <DashboardShell
      activePath="/dashboard/akun-siswa"
      user={dashboardUser}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#065f46,#10b981)] p-5 text-white shadow-[0_24px_70px_rgba(5,150,105,0.22)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="border-white/15 bg-white/15 text-white hover:bg-white/15">
                <KeyRound className="mr-1 h-3.5 w-3.5" />
                Akses Login Siswa
              </Badge>
              <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                Kelola akun siswa dari satu tempat
              </h1>
              <p className="mt-2 text-sm leading-6 text-emerald-50 sm:text-base">
                Aktifkan akun, lihat status login, dan reset password siswa pada
                kelas yang menjadi tanggung jawab Anda.
              </p>
            </div>
            <div className="grid min-w-[250px] grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/15">
                <p className="text-2xl font-black">{students.length}</p>
                <p className="mt-1 text-xs font-bold text-emerald-100">Siswa di kelas</p>
              </div>
              <div className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/15">
                <p className="text-2xl font-black">{activeAccounts}</p>
                <p className="mt-1 text-xs font-bold text-emerald-100">Login aktif</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        ) : null}

        {loadingClasses ? (
          <Card className="rounded-[24px] border-emerald-100">
            <CardContent className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
            </CardContent>
          </Card>
        ) : classes.length === 0 ? (
          <Card className="rounded-[24px] border-amber-100 bg-amber-50/70">
            <CardContent className="p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                  <School className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Siapkan kelas pertama Anda
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Belum ada kelas yang tercatat atas nama Anda. Buat kelas di
                    bawah ini; kelas akan otomatis menjadi tanggung jawab Anda
                    sehingga akun login siswa dapat langsung dikelola.
                  </p>
                </div>
              </div>
              <form
                onSubmit={createManagedClass}
                className="mt-6 grid gap-4 rounded-2xl border border-amber-200 bg-white p-4 sm:grid-cols-3"
              >
                <div className="space-y-2">
                  <Label htmlFor="setup-class-name">Nama kelas</Label>
                  <Input
                    id="setup-class-name"
                    placeholder="Contoh: X IPA 1"
                    value={classForm.name}
                    onChange={(event) =>
                      setClassForm((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-class-level">Jenjang</Label>
                  <select
                    id="setup-class-level"
                    value={classForm.jenjang}
                    onChange={(event) =>
                      setClassForm((current) => ({ ...current, jenjang: event.target.value }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {JENJANG_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-school-year">Tahun ajaran</Label>
                  <Input
                    id="setup-school-year"
                    value={classForm.tahunAjaran}
                    onChange={(event) =>
                      setClassForm((current) => ({
                        ...current,
                        tahunAjaran: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={creatingClass} className="rounded-xl">
                    {creatingClass ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Buat dan Gunakan Kelas
                  </Button>
                  <span className="text-xs font-semibold text-slate-500">
                    Langkah 1 dari 3: kelas → siswa → akun login
                  </span>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="rounded-[24px] border-emerald-100 shadow-sm">
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(260px,380px)_1fr] lg:items-end">
                <div className="space-y-2">
                  <Label htmlFor="managed-class">Kelas yang dikelola</Label>
                  <Select
                    value={selectedClassId}
                    onValueChange={(value) => {
                      setSelectedClassId(value);
                      setQuery("");
                    }}
                  >
                    <SelectTrigger id="managed-class" className="h-11 rounded-xl">
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · {item._count.students} siswa
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari nama, NIS, atau email siswa..."
                    className="h-11 rounded-xl pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {loadingStudents ? (
              <Card className="rounded-[24px] border-emerald-100">
                <CardContent className="flex justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                </CardContent>
              </Card>
            ) : classRoom ? (
              <>
                <Card className="rounded-[24px] border-cyan-100 bg-cyan-50/60 shadow-sm">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-700">
                        <UserRoundPlus className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="font-black text-slate-950">
                          Tambahkan siswa ke {classRoom.name}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Isi data siswa. Opsional: buat akun login sekaligus agar
                          siswa langsung bisa masuk portal.
                        </p>
                      </div>
                    </div>
                    <form
                      onSubmit={addStudent}
                      className="mt-5 grid gap-3 rounded-2xl border border-cyan-100 bg-white p-4 sm:grid-cols-3"
                    >
                      <Input
                        aria-label="Nama siswa"
                        placeholder="Nama lengkap siswa"
                        value={studentForm.name}
                        onChange={(event) =>
                          setStudentForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        required
                      />
                      <Input
                        aria-label="NIS siswa"
                        placeholder="NIS (opsional)"
                        value={studentForm.nis}
                        onChange={(event) =>
                          setStudentForm((current) => ({
                            ...current,
                            nis: event.target.value,
                          }))
                        }
                      />
                      <select
                        aria-label="Jenis kelamin siswa"
                        value={studentForm.gender}
                        onChange={(event) =>
                          setStudentForm((current) => ({
                            ...current,
                            gender: event.target.value,
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Jenis kelamin (opsional)</option>
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                      </select>

                      <label className="sm:col-span-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={studentForm.createAccount}
                          onChange={(event) =>
                            setStudentForm((current) => ({
                              ...current,
                              createAccount: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-emerald-200 text-emerald-600"
                        />
                        Buat akun login sekaligus
                      </label>

                      {studentForm.createAccount ? (
                        <>
                          <Input
                            aria-label="Email akun siswa"
                            type="email"
                            placeholder="siswa@sekolah.sch.id"
                            value={studentForm.email}
                            onChange={(event) =>
                              setStudentForm((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            required
                          />
                          <Input
                            aria-label="Password awal siswa"
                            type="password"
                            placeholder="Password awal (min. 8)"
                            value={studentForm.password}
                            onChange={(event) =>
                              setStudentForm((current) => ({
                                ...current,
                                password: event.target.value,
                              }))
                            }
                            required
                            minLength={8}
                            className="sm:col-span-2"
                          />
                        </>
                      ) : null}

                      <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
                        <Button type="submit" disabled={addingStudent} className="rounded-xl">
                          {addingStudent ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <UserRoundPlus className="mr-2 h-4 w-4" />
                          )}
                          {studentForm.createAccount
                            ? "Tambah Siswa + Akun"
                            : "Tambahkan Siswa"}
                        </Button>
                        <Button variant="outline" className="rounded-xl" asChild>
                          <Link href={`/dashboard/kelas/${classRoom.id}`}>
                            Impor banyak siswa
                          </Link>
                        </Button>
                        <span className="text-xs font-semibold text-slate-500">
                          {students.length === 0
                            ? "Langkah 2 dari 3"
                            : "Bisa ditambah kapan saja"}
                        </span>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card className="rounded-[24px] border-emerald-100 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3 border-b border-blue-50 pb-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black text-slate-950">
                            {classRoom.name}
                          </h2>
                          <Badge variant="secondary">
                            {filteredStudents.length} siswa
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {classRoom.teacher?.name
                            ? `Guru pengelola: ${classRoom.teacher.name}`
                            : "Kelas yang Anda kelola"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-bold">
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                          {activeAccounts} aktif
                        </span>
                        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
                          {students.length - activeAccounts} belum aktif
                        </span>
                      </div>
                    </div>

                    {filteredStudents.length === 0 ? (
                      <div className="flex flex-col items-center py-12 text-center">
                        <Search className="h-10 w-10 text-slate-300" />
                        <p className="mt-3 font-extrabold text-slate-800">
                          {students.length === 0
                            ? "Belum ada siswa di kelas ini"
                            : "Siswa tidak ditemukan"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {students.length === 0
                            ? "Tambahkan siswa lewat formulir di atas."
                            : "Periksa kata pencarian atau pilih kelas lain."}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-blue-50">
                        {filteredStudents.map((student) => (
                          <div
                            key={student.id}
                            className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                                {student.user ? (
                                  <ShieldCheck className="h-5 w-5" />
                                ) : (
                                  <UserRoundPlus className="h-5 w-5" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-extrabold text-slate-950">
                                  {student.name}
                                </p>
                                <p className="mt-1 truncate text-xs text-slate-500">
                                  {student.nis ? `NIS ${student.nis}` : "NIS belum diisi"}
                                </p>
                              </div>
                            </div>
                            <StudentAccountActions
                              studentId={student.id}
                              studentName={student.name}
                              hasAccount={Boolean(student.user)}
                              accountEmail={student.user?.email}
                              onChanged={loadStudents}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <BulkStudentAccountActions
                  students={studentsWithoutAccounts}
                  defaultDomain={defaultDomain}
                  onChanged={loadStudents}
                />

                <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Setiap perubahan dibatasi hanya untuk kelas yang boleh Anda kelola.
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
