"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
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
import { todayDateString } from "@/lib/attendance";
import { readResponseJson } from "@/lib/http-json";

type ClassRoom = { id: string; name: string };

type ReportRow = {
  studentId: string;
  nis: string | null;
  name: string;
  average: number | null;
  gradedCount: number;
  totalAssessments: number;
  scores: { title: string; score: number | null; maxScore: number }[];
};

type AssessmentCol = {
  id: string;
  title: string;
  maxScore: number;
};

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "kelas"
  );
}

export function GradingReportClient() {
  const dashboardUser = useDashboardUser();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classRoomId, setClassRoomId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayDateString());
  const [report, setReport] = useState<ReportRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentCol[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(false);
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

  const loadReport = useCallback(async () => {
    if (!classRoomId) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ classRoomId });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const res = await fetch(`/api/grading/report?${params}`);
      const data = await readResponseJson<{
        report?: ReportRow[];
        assessments?: AssessmentCol[];
        classRoom?: { name?: string };
        error?: string;
      }>(res);
      if (res.ok) {
        setReport(data.report || []);
        setAssessments(data.assessments || []);
        setClassName(data.classRoom?.name || "");
      } else {
        setReport([]);
        setAssessments([]);
        setError(data.error || "Gagal memuat rekap");
      }
    } catch {
      setReport([]);
      setAssessments([]);
      setError("Gagal memuat rekap");
    } finally {
      setLoading(false);
    }
  }, [classRoomId, from, to]);

  useEffect(() => {
    if (classRoomId) loadReport();
  }, [classRoomId, loadReport]);

  const exportCsv = () => {
    if (!report.length) return;
    const headers = [
      "NIS",
      "Nama",
      ...assessments.map((a) => a.title),
      "Rata-rata %",
    ];
    const rows = report.map((r) => [
      r.nis || "",
      r.name,
      ...r.scores.map((s) => (s.score != null ? String(s.score) : "")),
      r.average != null ? String(r.average) : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-nilai-${safeFileName(className || "kelas")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          <h1 className="text-2xl font-bold">Rekap Nilai per Kelas</h1>
          <p className="text-muted-foreground">
            Ringkasan nilai semua siswa dalam satu kelas.
          </p>
        </div>

        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
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
              <Label>Dari</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sampai</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={loadReport} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Muat
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={!report.length}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : report.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada data penilaian untuk kelas ini.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  <th className="p-3 text-left font-medium">Nama</th>
                  {assessments.map((a) => (
                    <th key={a.id} className="p-3 text-center font-medium">
                      {a.title}
                      <span className="block text-xs font-normal text-muted-foreground">
                        /{a.maxScore}
                      </span>
                    </th>
                  ))}
                  <th className="p-3 text-center font-medium">Rata-rata %</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.studentId} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="font-medium">{r.name}</p>
                      {r.nis && (
                        <p className="text-xs text-muted-foreground">{r.nis}</p>
                      )}
                    </td>
                    {r.scores.map((s, i) => (
                      <td key={i} className="p-3 text-center">
                        {s.score != null ? s.score : "—"}
                      </td>
                    ))}
                    <td className="p-3 text-center font-semibold">
                      {r.average != null ? `${r.average}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
