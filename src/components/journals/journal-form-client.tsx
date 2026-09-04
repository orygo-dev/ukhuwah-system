"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "next-auth/react";
import { getAllMapelOptions, getClassMapelOptions } from "@/lib/curriculum";
import { todayDateString } from "@/lib/daily-journal";
import { readResponseJson } from "@/lib/http-json";

type ClassRoom = { id: string; name: string; jenjang: string; allowedSubjects?: string[] | null };

type JournalForm = {
  classRoomId: string;
  date: string;
  mapel: string;
  jamKe: string;
  materi: string;
  tujuanPembelajaran: string;
  kegiatan: string;
  evaluasi: string;
  refleksi: string;
  tindakLanjut: string;
  kendala: string;
  status: "DRAFT" | "FINAL";
};

type JournalResponse = Omit<JournalForm, "jamKe"> & {
  id: string;
  teacherId: string;
  classRoomId: string | null;
  jamKe: number;
};

const emptyForm = (defaults?: Partial<JournalForm>): JournalForm => ({
  classRoomId: defaults?.classRoomId ?? "",
  date: defaults?.date ?? todayDateString(),
  mapel: defaults?.mapel ?? "",
  jamKe: defaults?.jamKe ?? "0",
  materi: defaults?.materi ?? "",
  tujuanPembelajaran: defaults?.tujuanPembelajaran ?? "",
  kegiatan: defaults?.kegiatan ?? "",
  evaluasi: defaults?.evaluasi ?? "",
  refleksi: defaults?.refleksi ?? "",
  tindakLanjut: defaults?.tindakLanjut ?? "",
  kendala: defaults?.kendala ?? "",
  status: defaults?.status ?? "DRAFT",
});

export function JournalFormClient({
  journalId,
  mode,
}: {
  journalId?: string;
  mode: "create" | "edit";
}) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillClassId = searchParams.get("classRoomId") || "";
  const prefillSessionId = searchParams.get("attendanceSessionId") || "";
  const prefillDate = searchParams.get("date") || "";
  const prefillMapel = searchParams.get("mapel") || "";
  const prefillJamKe = searchParams.get("jamKe") || "";

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [form, setForm] = useState<JournalForm>(
    emptyForm({
      classRoomId: prefillClassId,
      date: prefillDate || undefined,
      mapel: prefillMapel,
      jamKe: prefillJamKe || undefined,
    })
  );
  const [attendanceSessionId] = useState(prefillSessionId);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [readOnlyMessage, setReadOnlyMessage] = useState("");
  const selectedClass = classes.find((item) => item.id === form.classRoomId);
  const mapelOptions = useMemo(() => {
    const options = selectedClass ? getClassMapelOptions(selectedClass) : getAllMapelOptions();
    if (form.mapel && !options.some((item) => item.value === form.mapel)) {
      return [{ value: form.mapel, label: form.mapel }, ...options];
    }
    return options;
  }, [form.mapel, selectedClass]);

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/classes");
      const data = await readResponseJson<{ classes?: ClassRoom[] }>(res);
      if (res.ok) setClasses(data.classes || []);
      else setError(data.error || "Gagal memuat kelas.");
    } catch {
      setError("Gagal memuat kelas.");
    }
  }, []);

  const loadJournal = useCallback(async () => {
    if (!journalId) return;
    try {
      const res = await fetch(`/api/journals/${journalId}`);
      const data = await readResponseJson<{ journal?: JournalResponse }>(res);
      if (res.ok && data.journal) {
        const j = data.journal;
        if (j.teacherId !== session?.user?.id) {
          setReadOnlyMessage(
            "Jurnal ini dibuat oleh guru lain di sekolah Anda. Anda dapat melihat detailnya, tetapi tidak dapat mengubah jurnal ini."
          );
        }
        setForm({
          classRoomId: j.classRoomId ?? "",
          date: j.date.slice(0, 10),
          mapel: j.mapel,
          jamKe: String(j.jamKe ?? 0),
          materi: j.materi,
          tujuanPembelajaran: j.tujuanPembelajaran ?? "",
          kegiatan: j.kegiatan ?? "",
          evaluasi: j.evaluasi ?? "",
          refleksi: j.refleksi ?? "",
          tindakLanjut: j.tindakLanjut ?? "",
          kendala: j.kendala ?? "",
          status: j.status,
        });
      } else {
        setError(data.error || "Jurnal tidak ditemukan");
      }
    } catch {
      setError("Gagal memuat jurnal.");
    } finally {
      setLoading(false);
    }
  }, [journalId, session?.user?.id]);

  useEffect(() => {
    if (mode === "edit" && sessionStatus === "loading") return;
    loadClasses();
    if (mode === "edit") loadJournal();
  }, [loadClasses, loadJournal, mode, sessionStatus]);

  const save = async (status?: "DRAFT" | "FINAL") => {
    setSaving(true);
    setError("");
    const payload = {
      classRoomId: form.classRoomId || undefined,
      attendanceSessionId: attendanceSessionId || undefined,
      date: form.date,
      mapel: form.mapel,
      jamKe: Number(form.jamKe) || 0,
      materi: form.materi,
      tujuanPembelajaran: form.tujuanPembelajaran || undefined,
      kegiatan: form.kegiatan || undefined,
      evaluasi: form.evaluasi || undefined,
      refleksi: form.refleksi || undefined,
      tindakLanjut: form.tindakLanjut || undefined,
      kendala: form.kendala || undefined,
      status: status ?? form.status,
    };

    try {
      const res = await fetch(
        mode === "create" ? "/api/journals" : `/api/journals/${journalId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await readResponseJson<{ journal: { id: string } }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan jurnal");
      router.push(`/dashboard/jurnal/${data.journal.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!journalId || !confirm("Hapus jurnal ini?")) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/journals/${journalId}`, { method: "DELETE" });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus jurnal");
      router.push("/dashboard/jurnal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus jurnal");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/jurnal">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (mode === "edit" && readOnlyMessage) {
    return (
      <DashboardShell
        activePath="/dashboard/jurnal"
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
        <div className="mx-auto max-w-3xl space-y-4">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={journalId ? `/dashboard/jurnal/${journalId}` : "/dashboard/jurnal"}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Kembali
            </Link>
          </Button>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {readOnlyMessage}
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activePath="/dashboard/jurnal"
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
            <Link href="/dashboard/jurnal">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Kembali
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {mode === "create" ? "Tulis Jurnal Harian" : "Edit Jurnal"}
          </h1>
          <p className="text-muted-foreground">
            Dokumentasikan kegiatan belajar mengajar hari ini.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label>Kelas (opsional)</Label>
                <Select
                  value={form.classRoomId || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, classRoomId: v === "none" ? "" : v, mapel: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Tanpa kelas —</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mata Pelajaran</Label>
                <Select
                  value={form.mapel || undefined}
                  onValueChange={(v) => setForm({ ...form, mapel: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih mapel" />
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
                <Label>Jam ke-</Label>
                <Select
                  value={form.jamKe}
                  onValueChange={(v) => setForm({ ...form, jamKe: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">—</SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Jam ke-{n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Materi / Topik Pembelajaran</Label>
              <Input
                value={form.materi}
                onChange={(e) => setForm({ ...form, materi: e.target.value })}
                placeholder="Contoh: Persamaan Linear Satu Variabel"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tujuan Pembelajaran (opsional)</Label>
              <Textarea
                rows={2}
                value={form.tujuanPembelajaran}
                onChange={(e) =>
                  setForm({ ...form, tujuanPembelajaran: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Kegiatan Pembelajaran</Label>
              <Textarea
                rows={4}
                value={form.kegiatan}
                onChange={(e) => setForm({ ...form, kegiatan: e.target.value })}
                placeholder="Apersepsi, inti, penutup, metode yang digunakan..."
              />
            </div>

            <div className="space-y-2">
              <Label>Evaluasi</Label>
              <Textarea
                rows={2}
                value={form.evaluasi}
                onChange={(e) => setForm({ ...form, evaluasi: e.target.value })}
                placeholder="Hasil evaluasi pembelajaran hari ini"
              />
            </div>

            <div className="space-y-2">
              <Label>Refleksi</Label>
              <Textarea
                rows={2}
                value={form.refleksi}
                onChange={(e) => setForm({ ...form, refleksi: e.target.value })}
                placeholder="Apa yang berjalan baik, apa yang perlu diperbaiki"
              />
            </div>

            <div className="space-y-2">
              <Label>Tindak Lanjut</Label>
              <Textarea
                rows={2}
                value={form.tindakLanjut}
                onChange={(e) =>
                  setForm({ ...form, tindakLanjut: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Kendala (opsional)</Label>
              <Textarea
                rows={2}
                value={form.kendala}
                onChange={(e) => setForm({ ...form, kendala: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                onClick={() => save("DRAFT")}
                variant="outline"
                disabled={saving || !form.mapel || !form.materi}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Draft
              </Button>
              <Button
                onClick={() => save("FINAL")}
                disabled={saving || !form.mapel || !form.materi}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan & Final
              </Button>
              <Button variant="outline" asChild>
                <Link
                  href={`/dashboard/tools/jurnal-mengajar?prefill=1&mapel=${encodeURIComponent(form.mapel)}&materi=${encodeURIComponent(form.materi)}`}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate dengan AI
                </Link>
              </Button>
              {mode === "edit" && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={remove}
                  disabled={deleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
