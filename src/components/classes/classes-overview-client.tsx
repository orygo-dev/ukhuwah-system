"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Loader2,
  KeyRound,
  Lock,
  PenLine,
  Plus,
  School,
  Users,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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
import { readResponseJson } from "@/lib/http-json";
import { Badge } from "@/components/ui/badge";
import { useDashboardUser } from "@/hooks/use-dashboard-user";
import { JENJANG_OPTIONS } from "@/lib/curriculum";
import { currentTahunAjaran } from "@/lib/teacher-profile";

type ClassRoom = {
  id: string;
  teacherId: string;
  schoolId?: string | null;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  teacher?: { id: string; name: string } | null;
  _count: { students: number; sessions: number };
};

export function ClassesOverviewClient() {
  const dashboardUser = useDashboardUser();
  const { data: session } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [todayJournalCount, setTodayJournalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    jenjang: "smp",
    tahunAjaran: currentTahunAjaran(),
  });

  const load = useCallback(async () => {
    try {
      const [cRes, jRes] = await Promise.all([
        fetch("/api/attendance/classes"),
        fetch("/api/journals?limit=1&scope=mine"),
      ]);
      const cData = await readResponseJson<{ classes?: ClassRoom[] }>(cRes);
      const jData = await readResponseJson<{ todayCount?: number }>(jRes);
      if (cRes.ok) setClasses(cData.classes || []);
      else setError(cData.error || "Gagal memuat kelas");
      if (jRes.ok) setTodayJournalCount(jData.todayCount ?? 0);
    } catch {
      setError("Gagal memuat data kelas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/attendance/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await readResponseJson<{ classRoom: { id: string } }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat kelas");
      setShowForm(false);
      setForm({ name: "", jenjang: "smp", tahunAjaran: currentTahunAjaran() });
      router.push(`/dashboard/kelas/${data.classRoom.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat kelas");
    } finally {
      setCreating(false);
    }
  };

  const jenjangLabel = (v: string) =>
    JENJANG_OPTIONS.find((o) => o.value === v)?.label ?? v;
  const sessionUserId = session?.user?.id;
  const sharedSchoolClasses = classes.filter(
    (cls) => cls.schoolId && cls.teacherId !== sessionUserId
  );
  const totalStudents = classes.reduce(
    (total, cls) => total + cls._count.students,
    0
  );

  return (
    <DashboardShell activePath="/dashboard/kelas" user={dashboardUser}>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_20px_65px_rgba(15,76,129,0.08)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                Kelas & Siswa
              </Badge>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                Roster sekolah untuk aktivitas mengajar
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Kelas yang dibuat guru pertama atau admin sekolah akan muncul
                sebagai data sekolah bersama. Anda cukup memakai kelas yang sudah
                tersedia untuk absensi, jurnal, tugas, quiz, ujian, dan penilaian.
              </p>
            </div>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="rounded-xl"
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Kelas
            </Button>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-emerald-100 bg-emerald-50/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-emerald-700 ring-1 ring-blue-100">
                <School className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-950">
                  {classes.length}
                </p>
                <p className="text-xs font-bold uppercase text-slate-500">
                  Kelas sekolah
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 bg-emerald-50/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-100">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-950">
                  {totalStudents}
                </p>
                <p className="text-xs font-bold uppercase text-slate-500">
                  Siswa aktif
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-100 bg-amber-50/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-amber-700 ring-1 ring-amber-100">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-950">
                  {sharedSchoolClasses.length}
                </p>
                <p className="text-xs font-bold uppercase text-slate-500">
                  Roster bersama
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {sharedSchoolClasses.length > 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            <span className="font-extrabold">Ada kelas sekolah bersama.</span>{" "}
            Anda dapat memakai kelas tersebut untuk aktivitas mengajar tanpa
            import siswa ulang. Perubahan roster dilakukan oleh guru pengelola
            atau admin sekolah.
          </div>
        ) : null}

        {!showForm && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {todayJournalCount === 0 && classes.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Belum ada jurnal hari ini</p>
            <p className="mt-1 text-amber-800">
              Catat kegiatan mengajar Anda agar dokumentasi KBM lengkap.
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/dashboard/jurnal/baru">
                <PenLine className="mr-1 h-4 w-4" />
                Tulis Jurnal
              </Link>
            </Button>
          </div>
        )}

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-900">
                Jika sekolah belum menyiapkan kelas resmi, guru tetap bisa
                membuat kelas dari sini. Kelas akan terhubung ke sekolah Anda
                dan dapat dilihat admin sekolah ketika akun admin sekolah sudah
                aktif.
              </div>
              <form onSubmit={createClass} className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Kelas Sekolah</Label>
                  <Input
                    id="name"
                    placeholder="Contoh: X IPA 1"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jenjang</Label>
                  <Select
                    value={form.jenjang}
                    onValueChange={(v) => setForm({ ...form, jenjang: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JENJANG_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tahun">Tahun Ajaran</Label>
                  <Input
                    id="tahun"
                    value={form.tahunAjaran}
                    onChange={(e) =>
                      setForm({ ...form, tahunAjaran: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="flex gap-2 sm:col-span-3">
                  <Button type="submit" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan Kelas Sekolah
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Batal
                  </Button>
                </div>
              </form>
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : classes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-semibold">Belum ada kelas</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Kelas dari admin sekolah akan muncul otomatis di sini. Anda juga
                tetap bisa membuat kelas sendiri jika sekolah belum menyiapkan roster.
              </p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Buat Kelas Pertama
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => {
              const ownedByMe = cls.teacherId === sessionUserId;
              const schoolShared = Boolean(cls.schoolId);
              const canManageRoster =
                dashboardUser?.role === "SUPER_ADMIN" ||
                dashboardUser?.role === "SCHOOL_ADMIN" ||
                ownedByMe;

              return (
              <Card
                key={cls.id}
                className={`transition-shadow hover:shadow-md ${
                  ownedByMe ? "border-emerald-200" : schoolShared ? "border-emerald-200" : ""
                }`}
              >
                <CardContent className="pt-6">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-1.5">
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
                            Roster terkunci
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="text-lg font-semibold">{cls.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {jenjangLabel(cls.jenjang)} · {cls.tahunAjaran}
                      </p>
                      {cls.teacher?.name ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Pengelola: {cls.teacher.name}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="secondary">
                      {cls._count.students} siswa
                    </Badge>
                  </div>
                  <p className="mb-4 text-xs text-muted-foreground">
                    {canManageRoster
                      ? `${cls._count.sessions} sesi absensi tercatat`
                      : "Anda bisa memakai kelas ini tanpa mengubah roster siswa."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" asChild>
                      <Link href={`/dashboard/kelas/${cls.id}`}>
                        {canManageRoster ? "Kelola" : "Buka"}
                      </Link>
                    </Button>
                    {canManageRoster ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/akun-siswa?classRoomId=${cls.id}`}>
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          Akun Siswa
                        </Link>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/absensi/kelas/${cls.id}`}>
                        <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                        Absensi
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/penilaian?classRoomId=${cls.id}`}>
                        <ClipboardList className="mr-1 h-3.5 w-3.5" />
                        Nilai
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/tugas?classRoomId=${cls.id}`}>
                        <BookOpen className="mr-1 h-3.5 w-3.5" />
                        Tugas
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/exam?classRoomId=${cls.id}`}>
                        <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                        Ujian
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`/dashboard/jurnal/baru?classRoomId=${cls.id}`}
                      >
                        <BookOpen className="mr-1 h-3.5 w-3.5" />
                        Jurnal
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
