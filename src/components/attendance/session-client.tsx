"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, Loader2, Save } from "lucide-react";
import type { AttendanceStatus } from "@prisma/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import {
  ATTENDANCE_STATUS_OPTIONS,
  attendanceStatusShort,
  formatDateId,
  summarizeStatuses,
} from "@/lib/attendance";
import { readResponseJson } from "@/lib/http-json";
import { cn } from "@/lib/utils";

type RecordRow = {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  note: string | null;
  student: { id: string; name: string; nis: string | null };
};

type SessionData = {
  id: string;
  teacherId: string;
  date: string;
  mapel: string;
  jamKe: number;
  classRoom: { id: string; name: string };
  records: RecordRow[];
};

export function AttendanceSessionClient({ sessionId }: { sessionId: string }) {
  const { data: session } = useSession();
  const [data, setData] = useState<SessionData | null>(null);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/sessions/${sessionId}`);
      const json = await readResponseJson<{ session: SessionData }>(res);
      if (res.ok) {
        setData(json.session);
        const map: Record<string, AttendanceStatus> = {};
        for (const r of json.session.records) {
          map[r.studentId] = r.status;
        }
        setRecords(map);
      } else {
        setError(json.error || "Sesi tidak ditemukan");
      }
    } catch {
      setError("Gagal memuat sesi absensi.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
  };

  const markAllPresent = () => {
    if (!data) return;
    const map: Record<string, AttendanceStatus> = {};
    for (const r of data.records) map[r.studentId] = "PRESENT";
    setRecords(map);
    setSaved(false);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/attendance/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: data.records.map((r) => ({
            studentId: r.studentId,
            status: records[r.studentId] || "PRESENT",
          })),
        }),
      });
      const json = await readResponseJson<{ session: SessionData }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      setData(json.session);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const summary = summarizeStatuses(Object.values(records));

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/absensi">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (!data) {
    return (
      <DashboardShell activePath="/dashboard/absensi">
        <p className="text-destructive">{error}</p>
      </DashboardShell>
    );
  }

  const canEdit = data.teacherId === session?.user?.id;

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
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/dashboard/absensi">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Kembali
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Absensi — {data.classRoom.name}</h1>
          <p className="text-muted-foreground">
            {formatDateId(data.date)}
            {data.mapel ? ` · ${data.mapel}` : ""}
            {data.jamKe > 0 ? ` · Jam ke-${data.jamKe}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
            <Badge key={opt.value} variant="secondary" className={opt.color}>
              {opt.short}:{" "}
              {opt.value === "PRESENT"
                ? summary.present
                : opt.value === "EXCUSED"
                  ? summary.excused
                  : opt.value === "SICK"
                    ? summary.sick
                    : summary.absent}
            </Badge>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllPresent}
              disabled={data.records.length === 0}
            >
              Tandai Semua Hadir
            </Button>
            <Button
              variant="brand"
              size="sm"
              onClick={save}
              disabled={saving || data.records.length === 0}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saved ? "Tersimpan!" : "Simpan Absensi"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/dashboard/jurnal/baru?classRoomId=${data.classRoom.id}&attendanceSessionId=${data.id}&date=${data.date.slice(0, 10)}&mapel=${encodeURIComponent(data.mapel)}&jamKe=${data.jamKe}`}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Tulis Jurnal
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Sesi absensi ini dibuat oleh guru lain di sekolah Anda. Anda dapat melihat
            rekap kehadiran, tetapi tidak dapat mengubah status siswa.
          </div>
        )}

        <Card>
          <CardContent className="divide-y p-0">
            {data.records.map((r, i) => {
              const status = records[r.studentId] || "PRESENT";
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium">{r.student.name}</p>
                      {r.student.nis && (
                        <p className="text-xs text-muted-foreground">NIS {r.student.nis}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ATTENDANCE_STATUS_OPTIONS.map((opt) => {
                      const active = status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(r.studentId, opt.value)}
                          disabled={!canEdit}
                          className={cn(
                            "flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-secondary",
                            !canEdit && "cursor-not-allowed opacity-70 hover:bg-transparent"
                          )}
                          title={opt.label}
                        >
                          {active ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            opt.short
                          )}
                        </button>
                      );
                    })}
                    <span className="ml-1 self-center text-xs text-muted-foreground">
                      {attendanceStatusShort(status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
