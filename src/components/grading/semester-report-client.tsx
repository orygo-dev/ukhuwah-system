"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
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
import { useDashboardUser } from "@/hooks/use-dashboard-user";
import { currentTahunAjaran } from "@/lib/teacher-profile";
import type { Semester } from "@/lib/semester";
import { currentSemester, SEMESTER_OPTIONS } from "@/lib/semester";
import { readResponseJson } from "@/lib/http-json";

type ClassRoom = { id: string; name: string };
type ReportRow = {
  studentId: string;
  name: string;
  nis: string | null;
  average: number | null;
  gradedCount: number;
  totalAssessments: number;
};

export function SemesterReportClient() {
  const dashboardUser = useDashboardUser();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classRoomId, setClassRoomId] = useState("");
  const [semester, setSemester] = useState<Semester>(() => currentSemester());
  const [tahunAjaran, setTahunAjaran] = useState(currentTahunAjaran());
  const [report, setReport] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/attendance/classes")
      .then(async (r) => readResponseJson<{ classes?: ClassRoom[] }>(r))
      .then((d) => {
        const list = d.classes || [];
        setClasses(list);
        if (list[0]) setClassRoomId(list[0].id);
      })
      .catch(() => {
        setError("Gagal memuat daftar kelas.");
      });
  }, []);

  const load = useCallback(async () => {
    if (!classRoomId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        classRoomId,
        semester,
        tahunAjaran,
      });
      const res = await fetch(`/api/grading/report?${params}`);
      const data = await readResponseJson<{ report?: ReportRow[]; error?: string }>(res);
      if (res.ok) {
        setReport(data.report || []);
      } else {
        setReport([]);
        setError(data.error || "Gagal memuat rapor semester.");
      }
    } catch {
      setReport([]);
      setError("Gagal memuat rapor semester.");
    } finally {
      setLoading(false);
    }
  }, [classRoomId, semester, tahunAjaran]);

  useEffect(() => {
    if (classRoomId) load();
  }, [classRoomId, load]);

  const downloadPdf = async (studentId?: string) => {
    setExporting(studentId || "class");
    try {
      const params = new URLSearchParams({
        classRoomId,
        semester,
        tahunAjaran,
      });
      if (studentId) params.set("studentId", studentId);
      const res = await fetch(`/api/grading/report/pdf?${params}`);
      if (!res.ok) {
        const data = await readResponseJson<{ error?: string }>(res);
        throw new Error(data.error || "Gagal mengunduh PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = studentId ? `rapor-siswa.pdf` : `rapor-kelas.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh PDF");
    } finally {
      setExporting(null);
    }
  };

  return (
    <DashboardShell activePath="/dashboard/penilaian" user={dashboardUser}>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/dashboard/penilaian">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Penilaian
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Rapor Semester</h1>
          <p className="text-muted-foreground">
            Rekap nilai per semester terhubung ke penilaian — unduh PDF per siswa
            atau seluruh kelas.
          </p>
        </div>

        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Select value={classRoomId} onValueChange={setClassRoomId}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Semester</Label>
              <Select
                value={semester}
                onValueChange={(v) => setSemester(v as Semester)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTER_OPTIONS.map((o) => (
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
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={load} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Muat
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadPdf()}
                disabled={!report.length || exporting === "class"}
              >
                {exporting === "class" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                PDF Kelas
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-xl border bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Portal Orang Tua</p>
          <p className="mt-1">
            Bagikan kode akses dari halaman Kelas & Siswa agar orang tua bisa
            melihat nilai dan unduh rapor. Orang tua cukup membuka Navalogi lalu
            memilih{" "}
            <Link href="/orangtua" className="underline">
              Portal Orang Tua
            </Link>
            .
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : report.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada penilaian final pada semester ini.
          </p>
        ) : (
          <div className="space-y-2">
            {report.map((r) => (
              <div
                key={r.studentId}
                className="flex items-center justify-between rounded-xl border bg-card p-4"
              >
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.gradedCount}/{r.totalAssessments} penilaian · Rata-rata{" "}
                    {r.average != null ? `${r.average}%` : "—"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadPdf(r.studentId)}
                  disabled={exporting === r.studentId}
                >
                  {exporting === r.studentId ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-1 h-4 w-4" />
                  )}
                  PDF
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
