"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardCheck,
  Download,
  Loader2,
  LogOut,
} from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppDisplay } from "@/hooks/use-app-display";
import { scoreToPredikat } from "@/lib/grading";

type DashboardData = {
  student: {
    name: string;
    nis: string | null;
    className: string;
    schoolName: string;
    teacherName: string;
  };
  semester: { label: string; tahunAjaran: string };
  attendance: {
    present: number;
    total: number;
    attendancePercent: number | null;
  };
  grades: {
    scores: {
      title: string;
      mapel?: string;
      score: number | null;
      maxScore: number;
    }[];
    average: number | null;
    gradedCount: number;
    totalAssessments: number;
  } | null;
};

export function ParentPortalClient() {
  const router = useRouter();
  const { data: appDisplay } = useAppDisplay();
  const branding = appDisplay.branding;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/parent/dashboard", { cache: "no-store" });
      if (res.status === 401 || res.status === 404) {
        router.replace("/orangtua");
        return;
      }
      const json = await res.json();
      if (res.ok) setData(json);
      else setError(json.error || "Gagal memuat data");
    } catch {
      setError("Gagal memuat data portal orang tua");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const logout = async () => {
    await fetch("/api/parent/verify", { method: "DELETE" });
    router.replace("/orangtua");
  };

  const downloadPdf = async () => {
    setExporting(true);
    setDownloadError("");
    try {
      const res = await fetch("/api/parent/report/pdf");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Gagal mengunduh rapor PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapor-${data?.student.name || "siswa"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Gagal mengunduh rapor PDF"
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-destructive">{error || "Data tidak tersedia"}</p>
        <Button asChild>
          <Link href="/orangtua">Kembali</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f8ff]">
      <header className="border-b border-emerald-100 bg-white/[0.96] shadow-[0_10px_30px_rgba(15,76,129,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <AppLogo
              appName={branding.appName}
              logoUrl={branding.logoUrl}
              showName={false}
              imageClassName="h-10 w-auto max-w-[150px] object-contain"
              fallbackClassName="text-xl font-black text-primary"
            />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-600">
                Portal Orang Tua
              </p>
              <h1 className="font-black text-slate-950">Ringkasan Anak</h1>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-1 h-4 w-4" />
            Keluar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold">{data.student.name}</h2>
            <p className="text-muted-foreground">
              {data.student.className}
              {data.student.nis ? ` · NIS ${data.student.nis}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.student.schoolName} · Wali kelas: {data.student.teacherName}
            </p>
            <Badge className="mt-3" variant="secondary">
              Semester {data.semester.label} {data.semester.tahunAjaran}
            </Badge>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <ClipboardCheck className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-sm text-muted-foreground">Kehadiran</p>
                <p className="text-2xl font-bold">
                  {data.attendance.attendancePercent ?? 0}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.attendance.present}/{data.attendance.total} hadir
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Rata-rata Nilai</p>
                <p className="text-2xl font-bold">
                  {data.grades?.average != null ? `${data.grades.average}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.grades?.gradedCount ?? 0} penilaian final
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Nilai Semester</CardTitle>
            <Button size="sm" variant="outline" onClick={downloadPdf} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              PDF Rapor
            </Button>
          </CardHeader>
          <CardContent>
            {downloadError && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {downloadError}
              </div>
            )}
            {!data.grades?.scores.length ? (
              <p className="text-sm text-muted-foreground">
                Belum ada nilai yang dipublikasikan untuk semester ini.
              </p>
            ) : (
              <div className="divide-y">
                {data.grades.scores.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3 first:pt-0"
                  >
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.mapel || "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {s.score != null ? `${s.score}/${s.maxScore}` : "—"}
                      </p>
                      {s.score != null && (
                        <p className="text-xs text-muted-foreground">
                          Predikat {scoreToPredikat(s.score, s.maxScore)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
