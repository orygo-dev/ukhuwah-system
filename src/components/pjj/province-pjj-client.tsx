"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, GraduationCap, Plus, RadioTower, Users } from "lucide-react";
import { SchoolSearchPicker } from "@/components/admin/school-search-picker";
import {
  formatProvinceNumber,
  ProvinceMetric,
  ProvinceMetricStrip,
} from "@/components/province/province-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readResponseJson } from "@/lib/http-json";

type School = { id: string; name: string; npsn?: string | null; level?: string | null; city?: string | null; province?: string | null };
type Program = {
  id: string;
  name: string;
  province: string;
  schoolYear: string;
  description?: string | null;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  schools: Array<{ id: string; role: "INDUK" | "MITRA"; isApproved: boolean; school: School }>;
  enrollmentCount: number;
  classCount: number;
  sessionCount: number;
  presentCount: number;
  participationCount: number;
};

const STATUS_LABEL: Record<Program["status"], string> = {
  DRAFT: "Draf",
  ACTIVE: "Aktif",
  COMPLETED: "Selesai",
  ARCHIVED: "Diarsipkan",
};

export function ProvincePjjClient() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "Program PJJ Kalimantan Selatan", province: "Kalimantan Selatan", schoolYear: "2026/2027", description: "" });
  const [linkForm, setLinkForm] = useState({ programId: "", schoolId: "", role: "INDUK" as "INDUK" | "MITRA" });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/province/pjj");
      const data = await readResponseJson<{
        programs: Program[];
        schools: School[];
      }>(response);
      if (!response.ok) throw new Error(data.error || "Gagal memuat PJJ.");
      setPrograms(data.programs);
      setSchools(data.schools);
      setLinkForm((current) => ({ ...current, programId: current.programId || data.programs[0]?.id || "" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(payload: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/province/pjj", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await readResponseJson(response);
      if (!response.ok) throw new Error(data.error || "Operasi gagal.");
      setMessage(successMessage);
      if (payload.action === "addSchool") {
        setLinkForm((current) => ({ ...current, schoolId: "" }));
      }
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operasi gagal.");
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => programs.reduce((value, program) => ({
    schools: value.schools + program.schools.length,
    classes: value.classes + program.classCount,
    students: value.students + program.enrollmentCount,
    sessions: value.sessions + program.sessionCount,
  }), { schools: 0, classes: 0, students: 0, sessions: 0 }), [programs]);
  const chosenProgram = programs.find((program) => program.id === linkForm.programId);
  const schoolOptions = schools
    .filter((school) => !chosenProgram?.schools.some((link) => link.school.id === school.id))
    .map((school) => ({
      id: school.id,
      name: school.name,
      npsn: school.npsn,
      city: school.city,
      provinceName: school.province,
    }));
  const statCards = [
    { label: "Sekolah", value: stats.schools, icon: Building2, tone: "sky" as const },
    { label: "Kelas PJJ", value: stats.classes, icon: GraduationCap, tone: "indigo" as const },
    { label: "Siswa", value: stats.students, icon: Users, tone: "emerald" as const },
    { label: "Sesi Live", value: stats.sessions, icon: BarChart3, tone: "cyan" as const },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/50 to-cyan-50 p-6 shadow-sm lg:p-8">
        <Badge className="bg-sky-700 text-white hover:bg-sky-700">
          <RadioTower className="mr-1 h-3.5 w-3.5" />
          Monitoring PJJ
        </Badge>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
          Pendidikan Jarak Jauh
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Tetapkan program, sekolah induk dan mitra, lalu pantau kelas, peserta, sesi, serta kehadiran secara
          agregat.
        </p>
      </section>

      {message ? (
        <div
          role="status"
          className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900"
        >
          {message}
        </div>
      ) : null}

      <ProvinceMetricStrip>
        {statCards.map(({ label, value, icon, tone }) => (
          <ProvinceMetric
            key={label}
            label={label}
            value={formatProvinceNumber(value)}
            helper="Agregat wilayah provinsi"
            icon={icon}
            tone={tone}
          />
        ))}
      </ProvinceMetricStrip>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="rounded-[24px] border-emerald-100 bg-white">
          <CardHeader><CardTitle className="text-lg">Buat program PJJ</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="programName">Nama program</Label><Input id="programName" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="province">Provinsi</Label><Input id="province" value={form.province} onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="schoolYear">Tahun ajaran</Label><Input id="schoolYear" value={form.schoolYear} onChange={(event) => setForm((current) => ({ ...current, schoolYear: event.target.value }))} /></div></div>
            <div className="space-y-2"><Label htmlFor="description">Keterangan</Label><textarea id="description" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <Button disabled={busy} onClick={() => submit({ action: "createProgram", ...form }, "Program PJJ berhasil dibuat.")}><Plus className="h-4 w-4" />Buat Program</Button>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-emerald-100 bg-white">
          <CardHeader><CardTitle className="text-lg">Tambahkan sekolah</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program">Program</Label>
              <select
                id="program"
                value={linkForm.programId}
                onChange={(event) =>
                  setLinkForm((current) => ({
                    ...current,
                    programId: event.target.value,
                    schoolId: "",
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Pilih program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>SMA/SMK</Label>
              <SchoolSearchPicker
                schools={schoolOptions}
                value={linkForm.schoolId}
                onChange={(schoolId) => setLinkForm((current) => ({ ...current, schoolId }))}
                allowNone={false}
                disabled={!linkForm.programId}
              />
            </div>
            <div className="space-y-2"><Label htmlFor="schoolRole">Peran sekolah</Label><select id="schoolRole" value={linkForm.role} onChange={(event) => setLinkForm((current) => ({ ...current, role: event.target.value as "INDUK" | "MITRA" }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="INDUK">Sekolah Induk</option><option value="MITRA">Sekolah Mitra</option></select></div>
            <Button disabled={busy || !linkForm.programId || !linkForm.schoolId} onClick={() => submit({ action: "addSchool", ...linkForm }, "Sekolah berhasil ditambahkan.")}><Building2 className="h-4 w-4" />Tambahkan Sekolah</Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {loading ? <p className="text-sm font-semibold text-slate-500">Memuat program...</p> : programs.length === 0 ? <Card className="rounded-[24px] border-dashed"><CardContent className="p-8 text-center text-sm text-slate-500">Belum ada program PJJ.</CardContent></Card> : programs.map((program) => {
          const percent = program.participationCount ? Math.round((program.presentCount / program.participationCount) * 100) : 0;
          return <Card key={program.id} className="rounded-[24px] border-emerald-100 bg-white"><CardContent className="p-5 lg:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-slate-950">{program.name}</h2><Badge variant="outline">{STATUS_LABEL[program.status]}</Badge></div><p className="mt-1 text-sm text-slate-500">{program.province} · {program.schoolYear}</p><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{program.description || "Belum ada keterangan."}</p></div><select aria-label={`Status ${program.name}`} value={program.status} onChange={(event) => submit({ action: "updateProgramStatus", programId: program.id, status: event.target.value }, "Status program diperbarui.")} className="h-10 rounded-xl border border-emerald-100 bg-emerald-50 px-3 text-sm font-bold text-emerald-800"><option value="DRAFT">Draf</option><option value="ACTIVE">Aktif</option><option value="COMPLETED">Selesai</option><option value="ARCHIVED">Arsip</option></select></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{program.schools.length}</p><p className="text-xs text-slate-500">Sekolah</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{program.classCount}</p><p className="text-xs text-slate-500">Kelas</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{program.enrollmentCount}</p><p className="text-xs text-slate-500">Siswa</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{percent}%</p><p className="text-xs text-slate-500">Kehadiran tercatat</p></div></div><div className="mt-4 flex flex-wrap gap-2">{program.schools.map((link) => <Badge key={link.id} variant="outline" className={link.role === "INDUK" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{link.role === "INDUK" ? "Induk" : "Mitra"}: {link.school.name}</Badge>)}</div></CardContent></Card>;
        })}
      </div>
    </div>
  );
}
