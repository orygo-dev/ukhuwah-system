"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  ClipboardList,
  Loader2,
  Plus,
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
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { JENJANG_OPTIONS } from "@/lib/curriculum";
import { currentTahunAjaran } from "@/lib/teacher-profile";
import { formatDateId, todayDateString } from "@/lib/attendance";
import { readResponseJson } from "@/lib/http-json";

type ClassRoom = {
  id: string;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  _count: { students: number; sessions: number };
};

type Session = {
  id: string;
  date: string;
  mapel: string;
  jamKe: number;
  classRoom: { id: string; name: string };
  records: { status: string }[];
};

export function AttendanceOverviewClient() {
  const { data: session } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    jenjang: "smp",
    tahunAjaran: currentTahunAjaran(),
  });

  const load = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        fetch("/api/attendance/classes"),
        fetch(`/api/attendance/sessions?date=${todayDateString()}`),
      ]);
      const cData = await readResponseJson<{ classes?: ClassRoom[] }>(cRes);
      const sData = await readResponseJson<{ sessions?: Session[] }>(sRes);
      if (cRes.ok) setClasses(cData.classes || []);
      else setError(cData.error || "Gagal memuat kelas");
      if (sRes.ok) setTodaySessions(sData.sessions || []);
      else setError(sData.error || "Gagal memuat absensi hari ini");
    } catch {
      setError("Gagal memuat data absensi.");
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
      const data = await readResponseJson<{ classRoom: ClassRoom }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat kelas");
      setShowForm(false);
      setForm({ name: "", jenjang: "smp", tahunAjaran: currentTahunAjaran() });
      router.push(`/dashboard/absensi/kelas/${data.classRoom.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat kelas");
    } finally {
      setCreating(false);
    }
  };

  const startAttendance = async (classRoomId: string) => {
    setStarting(classRoomId);
    setError("");
    try {
      const res = await fetch("/api/attendance/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classRoomId }),
      });
      const data = await readResponseJson<{ session: { id: string } }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memulai absensi");
      router.push(`/dashboard/absensi/sesi/${data.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai absensi");
    } finally {
      setStarting(null);
    }
  };

  return (
    <DashboardShell
      activePath="/dashboard/absensi"
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
            <h1 className="text-2xl font-bold tracking-tight">Absensi Siswa</h1>
            <p className="mt-1 text-muted-foreground">
              Kelola kelas, catat kehadiran harian, dan lihat rekap.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/absensi/rekap">Rekap Absensi</Link>
            </Button>
            <Button variant="brand" onClick={() => setShowForm((v) => !v)}>
              <Plus className="mr-1 h-4 w-4" />
              Kelas Baru
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {showForm && (
          <Card>
            <CardContent className="p-5">
              <form onSubmit={createClass} className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nama Kelas</Label>
                  <Input
                    placeholder="8A"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jenjang</Label>
                  <Select
                    value={form.jenjang}
                    onValueChange={(v) => setForm((f) => ({ ...f, jenjang: v }))}
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
                  <Label>Tahun Ajaran</Label>
                  <Input
                    value={form.tahunAjaran}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tahunAjaran: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-3 flex gap-2">
                  <Button type="submit" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Buat Kelas
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Batal
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <section>
              <div className="mb-3 flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">
                  Absensi Hari Ini — {formatDateId(todayDateString())}
                </h2>
              </div>
              {todaySessions.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Belum ada sesi absensi hari ini. Pilih kelas di bawah untuk memulai.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {todaySessions.map((s) => (
                    <Link key={s.id} href={`/dashboard/absensi/sesi/${s.id}`}>
                      <Card className="transition-colors hover:border-primary/40">
                        <CardContent className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium">{s.classRoom.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {s.mapel || "Umum"}
                              {s.jamKe > 0 ? ` · Jam ke-${s.jamKe}` : ""}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {s.records.length} siswa
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Kelas Tersedia</h2>
              </div>
              {classes.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Belum ada kelas</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Buat kelas terlebih dahulu, lalu tambahkan daftar siswa.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {classes.map((c) => (
                    <Card key={c.id}>
                      <CardContent className="p-5">
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{c.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {c.tahunAjaran} · {c._count.students} siswa
                            </p>
                          </div>
                          <Badge variant="outline">{c._count.sessions} sesi</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="brand" asChild>
                            <Link href={`/dashboard/absensi/kelas/${c.id}`}>
                              Kelola
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={c._count.students === 0 || starting === c.id}
                            onClick={() => startAttendance(c.id)}
                          >
                            {starting === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Absen Hari Ini"
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
