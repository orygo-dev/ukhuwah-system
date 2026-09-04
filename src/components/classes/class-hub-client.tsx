"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  Loader2,
  Newspaper,
  PenLine,
  Plus,
  KeyRound,
  Trash2,
  UserPlus,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StudentImportTools } from "@/components/classes/student-import-tools";
import { StudentAccountActions } from "@/components/school/student-account-actions";
import { BulkStudentAccountActions } from "@/components/school/bulk-student-account-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { formatDateId } from "@/lib/attendance";
import { readResponseJson } from "@/lib/http-json";
import { journalStatusLabel } from "@/lib/daily-journal";

type Student = {
  id: string;
  nis: string | null;
  name: string;
  gender: string | null;
  parentAccessEnabled?: boolean;
  user?: { email: string } | null;
};

type Journal = {
  id: string;
  date: string;
  mapel: string;
  materi: string;
  status: string;
};

type ClassRoom = {
  id: string;
  teacherId: string;
  schoolId?: string | null;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  teacher?: { id: string; name: string } | null;
  students: Student[];
  sessions: {
    id: string;
    date: string;
    mapel: string;
    jamKe: number;
    _count: { records: number };
  }[];
};

export function ClassHubClient({ classId }: { classId: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [classRoom, setClassRoom] = useState<ClassRoom | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [single, setSingle] = useState({ nis: "", name: "", gender: "" });
  const [parentCode, setParentCode] = useState<string | null>(null);
  const [codeStudent, setCodeStudent] = useState("");
  const [actingStudentId, setActingStudentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cRes, jRes] = await Promise.all([
        fetch(`/api/attendance/classes/${classId}`),
        fetch(`/api/journals?classRoomId=${classId}&limit=5&scope=mine`),
      ]);
      const cData = await readResponseJson<{ classRoom: ClassRoom }>(cRes);
      const jData = await readResponseJson<{ journals?: Journal[] }>(jRes);
      if (cRes.ok) setClassRoom(cData.classRoom);
      else setError(cData.error || "Kelas tidak ditemukan");
      if (jRes.ok) setJournals(jData.journals || []);
    } catch {
      setError("Gagal memuat data kelas.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/attendance/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nis: single.nis || undefined,
          name: single.name,
          gender: single.gender || undefined,
        }),
      });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal menambah siswa");
      setSingle({ nis: "", name: "", gender: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah siswa");
    } finally {
      setSaving(false);
    }
  };

  const removeStudent = async (id: string) => {
    if (!confirm("Hapus siswa dari daftar kelas?")) return;
    setActingStudentId(id);
    setError("");
    try {
      const res = await fetch(`/api/attendance/students/${id}`, { method: "DELETE" });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus siswa");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus siswa");
    } finally {
      setActingStudentId(null);
    }
  };

  const generateParentCode = async (studentId: string, studentName: string) => {
    setActingStudentId(studentId);
    setError("");
    setCodeStudent(studentName);
    setParentCode(null);
    try {
      const res = await fetch(`/api/students/${studentId}/parent-code`, {
        method: "POST",
      });
      const data = await readResponseJson<{ code: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat kode");
      setParentCode(data.code);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat kode");
    } finally {
      setActingStudentId(null);
    }
  };

  const revokeParentCode = async (studentId: string) => {
    if (!confirm("Nonaktifkan kode akses orang tua?")) return;
    setActingStudentId(studentId);
    setError("");
    setParentCode(null);
    try {
      const res = await fetch(`/api/students/${studentId}/parent-code`, { method: "DELETE" });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal mencabut kode");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencabut kode");
    } finally {
      setActingStudentId(null);
    }
  };

  const startAttendance = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/attendance/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classRoomId: classId }),
      });
      const data = await readResponseJson<{ session: { id: string } }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memulai absensi");
      router.push(`/dashboard/absensi/sesi/${data.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai absensi");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/kelas">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (!classRoom) {
    return (
      <DashboardShell activePath="/dashboard/kelas">
        <p className="text-destructive">{error || "Kelas tidak ditemukan"}</p>
        <Button variant="link" asChild className="mt-4 px-0">
          <Link href="/dashboard/kelas">Kembali</Link>
        </Button>
      </DashboardShell>
    );
  }

  const canManageRoster =
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "SCHOOL_ADMIN" ||
    classRoom.teacherId === session?.user?.id;
  const ownedByMe = classRoom.teacherId === session?.user?.id;
  const schoolShared = Boolean(classRoom.schoolId);
  const studentsWithoutAccounts = classRoom.students
    .filter((student) => !student.user)
    .map((student) => ({
      id: student.id,
      name: student.name,
      nis: student.nis,
      className: classRoom.name,
    }));
  const defaultStudentDomain = session?.user?.email?.includes("@")
    ? session.user.email.split("@")[1]
    : "";

  return (
    <DashboardShell
      activePath="/dashboard/kelas"
      user={
        session?.user
          ? {
              name: session.user.name || "",
              email: session.user.email || "",
              credits: session.user.creditsRemaining,
            }
          : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link href="/dashboard/kelas">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Semua Kelas
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Kelas {classRoom.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge
                variant={ownedByMe ? "default" : "secondary"}
                className={
                  ownedByMe
                    ? "bg-emerald-600 text-white"
                    : schoolShared
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                      : ""
                }
              >
                {ownedByMe ? "Dikelola saya" : schoolShared ? "Kelas sekolah" : "Kelas pribadi"}
              </Badge>
              {!canManageRoster ? (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  Roster siswa dikunci
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground">
              {classRoom.tahunAjaran} · {classRoom.students.length} siswa aktif
            </p>
            {classRoom.teacher?.name ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Pengelola kelas: {classRoom.teacher.name}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/penilaian?classRoomId=${classId}`}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Penilaian
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/mading?classRoomId=${classId}`}>
                <Newspaper className="mr-2 h-4 w-4" />
                Mading
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/spotlight-siswa?classRoomId=${classId}`}>
                <Clapperboard className="mr-2 h-4 w-4" />
                Zona Kreasi Siswa
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/jurnal/baru?classRoomId=${classId}`}>
                <PenLine className="mr-2 h-4 w-4" />
                Tulis Jurnal
              </Link>
            </Button>
            <Button
              disabled={classRoom.students.length === 0 || starting}
              onClick={startAttendance}
            >
              {starting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="mr-2 h-4 w-4" />
              )}
              Absen Hari Ini
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!canManageRoster ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            Kelas ini berasal dari roster sekolah bersama. Anda dapat memakai data
            siswa untuk absensi, jurnal, dan penilaian, sementara perubahan siswa
            dilakukan oleh guru pengelola atau admin sekolah.
          </div>
        ) : null}

        {parentCode && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Kode akses orang tua — {codeStudent}</p>
            <p className="mt-2 font-mono text-2xl tracking-widest">{parentCode}</p>
            <p className="mt-2 text-emerald-800">
              Bagikan ke orang tua. Minta orang tua membuka Navalogi, pilih{" "}
              <Link href="/orangtua" className="underline">
                Portal Orang Tua
              </Link>
              , lalu masukkan kode ini. Kode tidak ditampilkan lagi setelah ditutup.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setParentCode(null)}
            >
              Tutup
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classRoom.students.length}</p>
                <p className="text-xs text-muted-foreground">Siswa aktif</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <ClipboardCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classRoom.sessions.length}</p>
                <p className="text-xs text-muted-foreground">Sesi absensi</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <BookOpen className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{journals.length}</p>
                <p className="text-xs text-muted-foreground">Jurnal terbaru</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {canManageRoster ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="h-4 w-4" />
                  Tambah Siswa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={addStudent} className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>NIS (opsional)</Label>
                    <Input
                      value={single.nis}
                      onChange={(e) =>
                        setSingle((s) => ({ ...s, nis: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nama Siswa</Label>
                    <Input
                      value={single.name}
                      onChange={(e) =>
                        setSingle((s) => ({ ...s, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <Button type="submit" disabled={saving} className="sm:col-span-3">
                    <Plus className="mr-1 h-4 w-4" />
                    Tambah
                  </Button>
                </form>

                <div className="border-t pt-4">
                  <StudentImportTools
                    classId={classId}
                    saving={saving}
                    setSaving={setSaving}
                    setError={setError}
                    onImported={load}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5">
                <p className="font-semibold text-slate-950">Roster sekolah bersama</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Daftar siswa dikelola oleh {classRoom.teacher?.name || "guru pengelola"} atau
                  admin sekolah. Anda tetap bisa memakai kelas ini untuk absensi,
                  jurnal, dan penilaian tanpa import ulang.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Jurnal Terbaru</CardTitle>
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/dashboard/jurnal?classRoomId=${classId}`}>
                  Lihat semua
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {journals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada jurnal untuk kelas ini.
                </p>
              ) : (
                journals.map((j) => (
                  <Link
                    key={j.id}
                    href={`/dashboard/jurnal/${j.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/50"
                  >
                    <div>
                      <p className="font-medium">{j.mapel}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateId(j.date)} · {j.materi.slice(0, 40)}
                        {j.materi.length > 40 ? "…" : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {journalStatusLabel(j.status as "DRAFT" | "FINAL")}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daftar Siswa</CardTitle>
          </CardHeader>
          <CardContent>
            {classRoom.students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {canManageRoster
                  ? "Belum ada siswa. Tambahkan minimal satu siswa sebelum absensi."
                  : "Belum ada siswa di roster sekolah ini. Hubungi guru pengelola atau admin sekolah."}
              </p>
            ) : (
              <div className="divide-y">
                {classRoom.students.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        {s.nis && (
                          <p className="text-xs text-muted-foreground">
                            NIS {s.nis}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManageRoster ? (
                        <StudentAccountActions
                          studentId={s.id}
                          studentName={s.name}
                          hasAccount={Boolean(s.user)}
                          accountEmail={s.user?.email}
                          onChanged={load}
                        />
                      ) : (
                        <Badge variant={s.user ? "default" : "secondary"}>
                          {s.user ? "Login aktif" : "Belum aktif"}
                        </Badge>
                      )}
                      {canManageRoster ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={actingStudentId === s.id}
                          title={
                            s.parentAccessEnabled
                              ? "Buat ulang kode orang tua"
                              : "Buat kode orang tua"
                          }
                          onClick={() => generateParentCode(s.id, s.name)}
                        >
                          {actingStudentId === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <KeyRound
                              className={`h-4 w-4 ${s.parentAccessEnabled ? "text-primary" : "text-muted-foreground"}`}
                            />
                          )}
                        </Button>
                      ) : null}
                      {canManageRoster && s.parentAccessEnabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground"
                          disabled={actingStudentId === s.id}
                          onClick={() => revokeParentCode(s.id)}
                        >
                          Cabut
                        </Button>
                      )}
                      {canManageRoster ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={actingStudentId === s.id}
                          onClick={() => removeStudent(s.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {canManageRoster ? (
          <BulkStudentAccountActions
            students={studentsWithoutAccounts}
            defaultDomain={defaultStudentDomain}
            onChanged={load}
          />
        ) : null}

      </div>
    </DashboardShell>
  );
}
