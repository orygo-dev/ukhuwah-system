"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Save } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { assessmentTypeLabel, formatScore, scoreToPredikat } from "@/lib/grading";
import { formatDateId } from "@/lib/attendance";
import type { AssessmentType } from "@prisma/client";
import { readResponseJson } from "@/lib/http-json";

type GradeRow = {
  id: string;
  studentId: string;
  score: number | null;
  student: { id: string; name: string; nis: string | null };
};

type AssessmentData = {
  id: string;
  teacherId: string;
  title: string;
  mapel: string;
  type: AssessmentType;
  date: string;
  maxScore: number;
  status: string;
  classRoom: { id: string; name: string };
  gradeRecords: GradeRow[];
};

export function GradingEntryClient({ assessmentId }: { assessmentId: string }) {
  const { data: session } = useSession();
  const [data, setData] = useState<AssessmentData | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/grading/assessments/${assessmentId}`);
      const json = await readResponseJson<{ assessment?: AssessmentData; error?: string }>(res);
      if (res.ok && json.assessment) {
        setData(json.assessment);
        const map: Record<string, string> = {};
        for (const r of json.assessment.gradeRecords) {
          map[r.studentId] = r.score != null ? String(r.score) : "";
        }
        setScores(map);
      } else {
        setError(json.error || "Penilaian tidak ditemukan");
      }
    } catch {
      setError("Gagal memuat penilaian.");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const setScore = (studentId: string, value: string) => {
    setScores((prev) => ({ ...prev, [studentId]: value }));
    setSaved(false);
  };

  const save = async (finalize = false) => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      const records = data.gradeRecords.map((r) => {
        const raw = scores[r.studentId]?.trim();
        const score = raw === "" ? null : Number(raw);
        if (score != null && (Number.isNaN(score) || score < 0)) {
          throw new Error(`Nilai tidak valid untuk ${r.student.name}`);
        }
        if (score != null && score > data.maxScore) {
          throw new Error(`Nilai ${r.student.name} tidak boleh melebihi ${data.maxScore}`);
        }
        return { studentId: r.studentId, score };
      });

      const res = await fetch(`/api/grading/assessments/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records,
          ...(finalize ? { status: "FINAL" } : {}),
        }),
      });
      const json = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/penilaian">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (!data) {
    return (
      <DashboardShell activePath="/dashboard/penilaian">
        <p className="text-destructive">{error}</p>
        <Button variant="link" asChild className="mt-4 px-0">
          <Link href="/dashboard/penilaian">Kembali</Link>
        </Button>
      </DashboardShell>
    );
  }

  const gradedCount = Object.values(scores).filter((v) => v.trim() !== "").length;
  const canEdit = data.teacherId === session?.user?.id;

  return (
    <DashboardShell
      activePath="/dashboard/penilaian"
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
            <Link href="/dashboard/penilaian">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Semua Penilaian
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <p className="text-muted-foreground">
            {data.classRoom.name} · {formatDateId(data.date)} · {data.mapel} ·{" "}
            {assessmentTypeLabel(data.type)} · Maks {data.maxScore}
          </p>
          <Badge className="mt-2" variant="secondary">
            {gradedCount}/{data.gradeRecords.length} siswa dinilai
          </Badge>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => save(false)}
              disabled={saving || data.gradeRecords.length === 0}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saved ? "Tersimpan!" : "Simpan Nilai"}
            </Button>
            <Button
              variant="outline"
              onClick={() => save(true)}
              disabled={saving || data.gradeRecords.length === 0}
            >
              <Check className="mr-2 h-4 w-4" />
              Simpan & Final
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Penilaian ini dibuat oleh guru lain di sekolah Anda. Anda dapat melihat datanya,
            tetapi tidak dapat mengubah nilai.
          </div>
        )}

        <Card>
          <CardContent className="divide-y p-0">
            {data.gradeRecords.map((r, i) => {
              const raw = scores[r.studentId]?.trim();
              const num = raw !== "" && raw != null ? Number(raw) : null;
              const predikat =
                num != null && !Number.isNaN(num)
                  ? scoreToPredikat(num, data.maxScore)
                  : null;

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
                        <p className="text-xs text-muted-foreground">
                          NIS {r.student.nis}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={data.maxScore}
                      step={0.5}
                      className="w-24 text-center"
                      placeholder="—"
                      value={scores[r.studentId] ?? ""}
                      onChange={(e) => setScore(r.studentId, e.target.value)}
                      disabled={!canEdit}
                    />
                    <span className="text-sm text-muted-foreground">
                      / {data.maxScore}
                    </span>
                    {predikat && (
                      <Badge variant="outline" className="min-w-[2rem] justify-center">
                        {predikat}
                      </Badge>
                    )}
                    {num != null && !Number.isNaN(num) && (
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatScore(num, data.maxScore)}
                      </span>
                    )}
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
