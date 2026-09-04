"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardUser } from "@/hooks/use-dashboard-user";
import { assessmentTypeLabel, ASSESSMENT_TYPE_OPTIONS } from "@/lib/grading";
import { formatDateId, todayDateString } from "@/lib/attendance";
import { getClassMapelOptions } from "@/lib/curriculum";
import { readResponseJson } from "@/lib/http-json";
import type { AssessmentType } from "@prisma/client";

type Assessment = {
  id: string;
  title: string;
  mapel: string;
  type: AssessmentType;
  date: string;
  maxScore: number;
  status: string;
  classRoom: { id: string; name: string };
  _count: { gradeRecords: number };
  gradedCount: number;
};

type ClassRoom = { id: string; name: string; jenjang: string; allowedSubjects?: string[] | null };

export function GradingOverviewClient() {
  const dashboardUser = useDashboardUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillClassId = searchParams.get("classRoomId") || "";

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classFilter, setClassFilter] = useState(prefillClassId);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    classRoomId: prefillClassId,
    title: "",
    mapel: "",
    type: "QUIZ" as AssessmentType,
    date: todayDateString(),
    maxScore: "100",
  });
  const selectedClass = classes.find((item) => item.id === form.classRoomId);
  const mapelOptions = getClassMapelOptions(selectedClass);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (classFilter) params.set("classRoomId", classFilter);
    try {
      const [aRes, cRes] = await Promise.all([
        fetch(`/api/grading/assessments?${params}`),
        fetch("/api/attendance/classes"),
      ]);
      const aData = await readResponseJson<{ assessments?: Assessment[] }>(aRes);
      const cData = await readResponseJson<{ classes?: ClassRoom[] }>(cRes);
      if (aRes.ok) setAssessments(aData.assessments || []);
      else {
        setAssessments([]);
        setError(aData.error || "Gagal memuat penilaian.");
      }
      if (cRes.ok) setClasses(cData.classes || []);
      else setError(cData.error || "Gagal memuat kelas.");
    } catch {
      setAssessments([]);
      setError("Gagal memuat penilaian.");
    } finally {
      setLoading(false);
    }
  }, [classFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const createAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/grading/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          maxScore: Number(form.maxScore) || 100,
        }),
      });
      const data = await readResponseJson<{ assessment: { id: string } }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat penilaian");
      router.push(`/dashboard/penilaian/${data.assessment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat penilaian");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardShell activePath="/dashboard/penilaian" user={dashboardUser}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Penilaian</h1>
            <p className="text-muted-foreground">
              Input nilai siswa per kelas — kuis, tugas, UTS, dan lainnya.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/penilaian/rekap">Rekap Nilai</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/penilaian/rapor-semester">Rapor Semester</Link>
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-2 h-4 w-4" />
              Penilaian Baru
            </Button>
          </div>
        </div>

        {!showForm && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={createAssessment} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Kelas</Label>
                  <Select
                    value={form.classRoomId || undefined}
                    onValueChange={(v) => setForm({ ...form, classRoomId: v, mapel: "" })}
                    required
                  >
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
                  <Label>Judul Penilaian</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Contoh: ULH Bab 1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mata Pelajaran</Label>
                  <Select
                    value={form.mapel || undefined}
                    onValueChange={(v) => setForm({ ...form, mapel: v })}
                    disabled={!form.classRoomId || mapelOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={mapelOptions.length ? "Pilih mapel" : "Mapel kelas belum tersedia"} />
                    </SelectTrigger>
                    <SelectContent>
                      {mapelOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jenis</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setForm({ ...form, type: v as AssessmentType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSESSMENT_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nilai Maksimum</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={form.maxScore}
                    onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={creating || !form.classRoomId}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Buat & Input Nilai
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Batal
                  </Button>
                </div>
              </form>
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        {classes.length > 0 && (
          <Select
            value={classFilter || "all"}
            onValueChange={(v) => setClassFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-56">
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
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : assessments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-semibold">Belum ada penilaian</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Buat penilaian pertama untuk mulai mencatat nilai siswa.
              </p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Penilaian Baru
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {assessments.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/penilaian/${a.id}`}
                className="flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-secondary/30"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{a.title}</p>
                    <Badge variant="outline">{a.classRoom.name}</Badge>
                    <Badge variant="secondary">
                      {assessmentTypeLabel(a.type)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateId(a.date)} · {a.mapel} · Maks {a.maxScore}
                  </p>
                </div>
                <Badge>
                  {a.gradedCount}/{a._count.gradeRecords} dinilai
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
