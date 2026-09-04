"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StudentImportTools } from "@/components/classes/student-import-tools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { formatDateId } from "@/lib/attendance";
import { readResponseJson } from "@/lib/http-json";

type Student = {
  id: string;
  nis: string | null;
  name: string;
  gender: string | null;
};

type ClassRoom = {
  id: string;
  teacherId: string;
  schoolId?: string | null;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  students: Student[];
  sessions: {
    id: string;
    date: string;
    mapel: string;
    jamKe: number;
    _count: { records: number };
  }[];
};

export function ClassDetailClient({ classId }: { classId: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [classRoom, setClassRoom] = useState<ClassRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [single, setSingle] = useState({ nis: "", name: "", gender: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/classes/${classId}`);
      const data = await readResponseJson<{ classRoom: ClassRoom }>(res);
      if (res.ok) setClassRoom(data.classRoom);
      else setError(data.error || "Kelas tidak ditemukan");
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
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/attendance/students/${id}`, { method: "DELETE" });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus siswa");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus siswa");
    } finally {
      setSaving(false);
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
      <DashboardShell activePath="/dashboard/absensi">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (!classRoom) {
    return (
      <DashboardShell activePath="/dashboard/absensi">
        <p className="text-destructive">{error || "Kelas tidak ditemukan"}</p>
        <Button variant="link" asChild className="mt-4 px-0">
          <Link href="/dashboard/absensi">Kembali</Link>
        </Button>
      </DashboardShell>
    );
  }

  const canManageRoster =
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "SCHOOL_ADMIN" ||
    classRoom.teacherId === session?.user?.id;

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
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link href="/dashboard/absensi">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Kembali
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Kelas {classRoom.name}</h1>
            <p className="text-muted-foreground">
              {classRoom.tahunAjaran} · {classRoom.students.length} siswa aktif
            </p>
          </div>
          <Button
            variant="brand"
            disabled={classRoom.students.length === 0 || starting}
            onClick={startAttendance}
          >
            {starting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Absen Hari Ini
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {canManageRoster ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
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
                      onChange={(e) => setSingle((s) => ({ ...s, nis: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nama Siswa</Label>
                    <Input
                      value={single.name}
                      onChange={(e) => setSingle((s) => ({ ...s, name: e.target.value }))}
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
                  Daftar siswa dikelola oleh pengelola kelas atau admin sekolah. Anda
                  tetap bisa memakai kelas ini untuk absensi dan melihat rekap.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Sesi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {classRoom.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada sesi absensi.</p>
              ) : (
                classRoom.sessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/dashboard/absensi/sesi/${s.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/50"
                  >
                    <span>{formatDateId(s.date)}</span>
                    <Badge variant="secondary">{s._count.records} siswa</Badge>
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
                    className="flex items-center justify-between gap-3 py-3 first:pt-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        {s.nis && (
                          <p className="text-xs text-muted-foreground">NIS {s.nis}</p>
                        )}
                      </div>
                    </div>
                    {canManageRoster ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={saving}
                        onClick={() => removeStudent(s.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
