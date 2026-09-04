import { BookOpenCheck, BrainCircuit, CheckCircle2, Users } from "lucide-react";
import { ProvinceAdminShell } from "@/components/layout/province-admin-shell";
import { ProvinceDashboardToolbar } from "@/components/province/province-dashboard-toolbar";
import {
  formatProvinceNumber,
  ProvinceEmptyState,
  ProvinceMetric,
  ProvinceMetricStrip,
  ProvincePageHeader,
  ProvinceProgress,
  ProvinceSection,
  provincePercent,
} from "@/components/province/province-page";
import { getCurrentProvinceAdmin } from "@/lib/province-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProvinceTkaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { account } = await getCurrentProvinceAdmin("/province/tka");
  const query = await searchParams;
  const period = ["30", "90", "365"].includes(query.period ?? "") ? query.period! : "30";
  const since = new Date();
  since.setDate(since.getDate() - Number(period));

  const [publishedPackages, questionCount, attempts, subjectCount] = await Promise.all([
    prisma.tkaPackage.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        scope: true,
        publishedAt: true,
        subject: { select: { name: true } },
        school: { select: { name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    }),
    prisma.tkaQuestion.count({ where: { status: "PUBLISHED" } }),
    prisma.tkaAttempt.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, status: true, score: true, submittedAt: true, studentId: true },
    }),
    prisma.tkaSubject.count({ where: { isActive: true } }),
  ]);

  const submitted = attempts.filter((attempt) => attempt.status === "SUBMITTED");
  const scored = submitted.filter((attempt) => attempt.score !== null);
  const average = scored.length ? scored.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0) / scored.length : 0;
  const students = new Set(attempts.map((attempt) => attempt.studentId)).size;
  const distribution = [
    { label: "80–100", value: scored.filter((item) => (item.score ?? 0) >= 80).length, tone: "bg-emerald-500" },
    { label: "65–79", value: scored.filter((item) => (item.score ?? 0) >= 65 && (item.score ?? 0) < 80).length, tone: "bg-emerald-600" },
    { label: "50–64", value: scored.filter((item) => (item.score ?? 0) >= 50 && (item.score ?? 0) < 65).length, tone: "bg-amber-500" },
    { label: "Di bawah 50", value: scored.filter((item) => (item.score ?? 0) < 50).length, tone: "bg-rose-500" },
  ];

  return (
    <ProvinceAdminShell activePath="/province/tka" accountName={account.name} accountEmail={account.email}>
      <div className="flex flex-col gap-6 pb-10">
        <ProvincePageHeader
          title="Tes Kemampuan Akademik"
          description="Monitoring paket terpublikasi, partisipasi siswa, tingkat penyelesaian, dan capaian TKA di tingkat provinsi."
          actions={<ProvinceDashboardToolbar period={period} />}
        />

        <ProvinceMetricStrip>
          <ProvinceMetric label="Paket terpublikasi" value={formatProvinceNumber(publishedPackages.length)} helper={`${subjectCount} mata pelajaran aktif`} icon={BrainCircuit} />
          <ProvinceMetric label="Soal terpublikasi" value={formatProvinceNumber(questionCount)} helper="Sudah melalui alur review" icon={BookOpenCheck} />
          <ProvinceMetric label="Peserta" value={formatProvinceNumber(students)} helper={`${formatProvinceNumber(attempts.length)} percobaan periode ini`} icon={Users} />
          <ProvinceMetric label="Penyelesaian" value={`${provincePercent(submitted.length, attempts.length)}%`} helper={scored.length ? `Rata-rata ${average.toFixed(1)}` : "Belum ada hasil bernilai"} icon={CheckCircle2} />
        </ProvinceMetricStrip>

        {attempts.length === 0 ? (
          <ProvinceEmptyState title="Belum ada aktivitas TKA pada periode ini" description="Paket yang sudah dipublikasikan tetap tersedia, tetapi belum ada siswa yang memulai pada rentang waktu pilihan." />
        ) : (
          <ProvinceSection title="Distribusi Nilai" description={`Berdasarkan ${scored.length} percobaan selesai dan memiliki nilai.`}>
            <div className="grid gap-5 md:grid-cols-2">
              {distribution.map((item) => {
                const share = provincePercent(item.value, scored.length);
                return <div key={item.label}><div className="mb-2 flex items-center justify-between text-xs font-bold"><span>{item.label}</span><span>{item.value} · {share}%</span></div><ProvinceProgress value={share} tone={item.tone} /></div>;
              })}
            </div>
          </ProvinceSection>
        )}

        <ProvinceSection title="Paket TKA Aktif" description="Paket yang dapat diakses siswa sesuai cakupan kelas, sekolah, atau global.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Paket</th><th className="px-3 py-3">Mata pelajaran</th><th className="px-3 py-3">Cakupan</th><th className="px-3 py-3">Sekolah</th><th className="px-3 py-3">Soal</th><th className="px-3 py-3">Percobaan</th></tr></thead>
              <tbody>
                {publishedPackages.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-4 font-extrabold text-slate-950">{item.title}</td>
                    <td className="px-3 py-4 font-semibold text-slate-600">{item.subject.name}</td>
                    <td className="px-3 py-4 font-semibold text-slate-600">{item.scope}</td>
                    <td className="px-3 py-4 font-semibold text-slate-600">{item.school?.name || "Provinsi/Global"}</td>
                    <td className="px-3 py-4 font-bold">{item._count.questions}</td>
                    <td className="px-3 py-4 font-bold">{item._count.attempts}</td>
                  </tr>
                ))}
                {publishedPackages.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center font-semibold text-slate-500">Belum ada paket terpublikasi.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </ProvinceSection>
      </div>
    </ProvinceAdminShell>
  );
}
