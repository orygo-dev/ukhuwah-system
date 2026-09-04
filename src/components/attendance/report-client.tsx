"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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
import { useSession } from "next-auth/react";
import { todayDateString } from "@/lib/attendance";
import { readResponseJson } from "@/lib/http-json";

type ClassRoom = { id: string; name: string };

type ReportRow = {
  studentId: string;
  nis: string | null;
  name: string;
  present: number;
  excused: number;
  sick: number;
  absent: number;
  total: number;
  attendancePercent: number;
};

function csvValue(value: string | number | null) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "kelas"
  );
}

export function AttendanceReportClient() {
  const { data: session } = useSession();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classRoomId, setClassRoomId] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return todayDateString(d);
  });
  const [to, setTo] = useState(todayDateString());
  const [report, setReport] = useState<ReportRow[]>([]);
  const [meta, setMeta] = useState({ sessionCount: 0, className: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/attendance/classes");
        const d = await readResponseJson<{ classes?: ClassRoom[] }>(res);
        const list = d.classes || [];
        setClasses(list);
        if (list[0]) setClassRoomId(list[0].id);
      } catch {
        setError("Gagal memuat daftar kelas.");
      }
    })();
  }, []);

  const loadReport = useCallback(async () => {
    if (!classRoomId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ classRoomId, from, to });
      const res = await fetch(`/api/attendance/report?${params}`);
      const data = await readResponseJson<{
        report?: ReportRow[];
        sessionCount?: number;
        classRoom?: ClassRoom;
      }>(res);
      if (res.ok) {
        setReport(data.report || []);
        setMeta({
          sessionCount: data.sessionCount || 0,
          className: data.classRoom?.name || "",
        });
      } else {
        setReport([]);
        setMeta((prev) => ({ ...prev, sessionCount: 0 }));
        setError(data.error || "Gagal memuat rekap absensi.");
      }
    } catch {
      setReport([]);
      setMeta((prev) => ({ ...prev, sessionCount: 0 }));
      setError("Gagal memuat rekap absensi.");
    } finally {
      setLoading(false);
    }
  }, [classRoomId, from, to]);

  useEffect(() => {
    if (classRoomId) loadReport();
  }, [classRoomId, from, to, loadReport]);

  const exportCsv = () => {
    const header = ["NIS", "Nama", "H", "I", "S", "A", "Total", "% Hadir"]
      .map(csvValue)
      .join(",");
    const rows = report
      .map(
        (r) =>
          [
            r.nis,
            r.name,
            r.present,
            r.excused,
            r.sick,
            r.absent,
            r.total,
            r.attendancePercent,
          ]
            .map(csvValue)
            .join(",")
      )
      .join("\n");
    const blob = new Blob([`\uFEFF${header}\n${rows}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-absensi-${safeFileName(meta.className)}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/dashboard/absensi">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Kembali
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Rekap Absensi</h1>
          <p className="text-muted-foreground">
            Ringkasan kehadiran siswa per periode.
          </p>
        </div>

        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Select value={classRoomId} onValueChange={setClassRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dari tanggal</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sampai tanggal</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={exportCsv} disabled={!report.length}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {meta.className || "—"} · {meta.sessionCount} sesi absensi
            </CardTitle>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {report.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada data absensi pada periode ini.
              </p>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Nama</th>
                    <th className="pb-2 pr-2">H</th>
                    <th className="pb-2 pr-2">I</th>
                    <th className="pb-2 pr-2">S</th>
                    <th className="pb-2 pr-2">A</th>
                    <th className="pb-2 pr-2">Total</th>
                    <th className="pb-2">% Hadir</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.studentId} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium">{r.name}</td>
                      <td className="py-2.5 pr-2">{r.present}</td>
                      <td className="py-2.5 pr-2">{r.excused}</td>
                      <td className="py-2.5 pr-2">{r.sick}</td>
                      <td className="py-2.5 pr-2">{r.absent}</td>
                      <td className="py-2.5 pr-2">{r.total}</td>
                      <td className="py-2.5">{r.attendancePercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
