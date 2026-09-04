"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, Download, Loader2, PenLine, Plus } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDashboardUser } from "@/hooks/use-dashboard-user";
import { weekRange } from "@/lib/export-journal-weekly";
import { journalStatusLabel, formatDateId } from "@/lib/daily-journal";
import { readResponseJson } from "@/lib/http-json";

type Journal = {
  id: string;
  date: string;
  mapel: string;
  materi: string;
  jamKe: number;
  status: string;
  classRoom: { id: string; name: string } | null;
};

type ClassRoom = { id: string; name: string };

export function JournalsOverviewClient() {
  const dashboardUser = useDashboardUser();
  const searchParams = useSearchParams();
  const initialClassId = searchParams.get("classRoomId") || "";

  const [journals, setJournals] = useState<Journal[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [classFilter, setClassFilter] = useState(initialClassId);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const defaultWeek = weekRange();
  const [exportFrom, setExportFrom] = useState(defaultWeek.from);
  const [exportTo, setExportTo] = useState(defaultWeek.to);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "50" });
    if (classFilter) params.set("classRoomId", classFilter);

    try {
      const [jRes, cRes] = await Promise.all([
        fetch(`/api/journals?${params}`),
        fetch("/api/attendance/classes"),
      ]);
      const jData = await readResponseJson<{
        journals?: Journal[];
        todayCount?: number;
        error?: string;
      }>(jRes);
      const cData = await readResponseJson<{ classes?: ClassRoom[]; error?: string }>(cRes);
      if (jRes.ok) {
        setJournals(jData.journals || []);
        setTodayCount(jData.todayCount ?? 0);
      } else {
        setJournals([]);
        setError(jData.error || "Gagal memuat jurnal.");
      }
      if (cRes.ok) setClasses(cData.classes || []);
      else setError(cData.error || "Gagal memuat kelas.");
    } catch {
      setJournals([]);
      setError("Gagal memuat jurnal.");
    } finally {
      setLoading(false);
    }
  }, [classFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadWeeklyPdf = async () => {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams({ from: exportFrom, to: exportTo });
      if (classFilter) params.set("classRoomId", classFilter);
      const res = await fetch(`/api/journals/export/pdf?${params}`);
      if (!res.ok) {
        const data = await readResponseJson<{ error?: string }>(res);
        throw new Error(data.error || "Gagal mengunduh PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap-jurnal-${exportFrom}-${exportTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardShell activePath="/dashboard/jurnal" user={dashboardUser}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jurnal Harian</h1>
            <p className="text-muted-foreground">
              Catat kegiatan belajar mengajar setiap hari untuk dokumentasi KBM.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/jurnal/baru">
              <Plus className="mr-2 h-4 w-4" />
              Tulis Jurnal
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Card className="flex-1">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <PenLine className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Jurnal hari ini</p>
                <p className="text-xl font-bold">{todayCount} entri</p>
              </div>
            </CardContent>
          </Card>
          {classes.length > 0 && (
            <div className="w-full sm:w-56">
              <Select
                value={classFilter || "all"}
                onValueChange={(v) => setClassFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua kelas</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm font-medium">Ekspor Rekap Mingguan (PDF)</Label>
              <p className="text-xs text-muted-foreground">
                Unduh ringkasan jurnal untuk periode yang dipilih.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Dari</Label>
              <Input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sampai</Label>
              <Input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
              />
            </div>
            <div className="sm:col-span-4">
              <Button
                variant="outline"
                onClick={downloadWeeklyPdf}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Unduh PDF Mingguan
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : journals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-semibold">Belum ada jurnal</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Mulai catat kegiatan mengajar hari ini. Jurnal membantu
                dokumentasi KBM dan refleksi pembelajaran.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/dashboard/jurnal/baru">
                  <PenLine className="mr-2 h-4 w-4" />
                  Tulis Jurnal Pertama
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {journals.map((j) => (
              <Link
                key={j.id}
                href={`/dashboard/jurnal/${j.id}`}
                className="flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-secondary/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{j.mapel}</p>
                    {j.classRoom && (
                      <Badge variant="outline">{j.classRoom.name}</Badge>
                    )}
                    <Badge variant="secondary">
                      {journalStatusLabel(j.status as "DRAFT" | "FINAL")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateId(j.date)}
                    {j.jamKe > 0 ? ` · Jam ke-${j.jamKe}` : ""}
                  </p>
                  <p className="mt-1 truncate text-sm">{j.materi}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
