import { Activity, BookOpen, School, UserCheck } from "lucide-react";
import { ProvinceAdminShell } from "@/components/layout/province-admin-shell";
import { ProvinceDashboardToolbar } from "@/components/province/province-dashboard-toolbar";
import {
  formatProvinceNumber,
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

export default async function ProvinceTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { account } = await getCurrentProvinceAdmin("/province/teachers");
  const query = await searchParams;
  const period = ["30", "90", "365"].includes(query.period ?? "") ? query.period! : "30";
  const since = new Date();
  since.setDate(since.getDate() - Number(period));

  const [teachers, documents, journals, assignments, quizzes, exams, assessments, pjjSessions] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TEACHER" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        school: { select: { name: true, regency: { select: { name: true } } } },
        teachingProfiles: {
          where: { isPrimary: true },
          take: 1,
          select: { schoolName: true, school: { select: { regency: { select: { name: true } } } } },
        },
      },
    }),
    prisma.document.groupBy({ by: ["userId"], where: { createdAt: { gte: since }, user: { role: "TEACHER" } }, _count: { _all: true } }),
    prisma.dailyJournal.groupBy({ by: ["teacherId"], where: { date: { gte: since } }, _count: { _all: true } }),
    prisma.assignment.groupBy({ by: ["teacherId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.quiz.groupBy({ by: ["teacherId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.exam.groupBy({ by: ["teacherId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.assessment.groupBy({ by: ["teacherId"], where: { date: { gte: since } }, _count: { _all: true } }),
    prisma.liveClassSession.groupBy({ by: ["createdById"], where: { scheduledStart: { gte: since } }, _count: { _all: true } }),
  ]);

  type TeacherActivity = { documents: number; journals: number; assignments: number; quizzes: number; exams: number; assessments: number; pjj: number };
  const activities = new Map<string, TeacherActivity>();
  const getActivity = (id: string) => {
    const current = activities.get(id) ?? { documents: 0, journals: 0, assignments: 0, quizzes: 0, exams: 0, assessments: 0, pjj: 0 };
    activities.set(id, current);
    return current;
  };
  documents.forEach((row) => { getActivity(row.userId).documents = row._count._all; });
  journals.forEach((row) => { getActivity(row.teacherId).journals = row._count._all; });
  assignments.forEach((row) => { getActivity(row.teacherId).assignments = row._count._all; });
  quizzes.forEach((row) => { getActivity(row.teacherId).quizzes = row._count._all; });
  exams.forEach((row) => { getActivity(row.teacherId).exams = row._count._all; });
  assessments.forEach((row) => { getActivity(row.teacherId).assessments = row._count._all; });
  pjjSessions.forEach((row) => { getActivity(row.createdById).pjj = row._count._all; });

  const teacherRows = teachers.map((teacher) => {
    const activity = activities.get(teacher.id) ?? { documents: 0, journals: 0, assignments: 0, quizzes: 0, exams: 0, assessments: 0, pjj: 0 };
    const score =
      Math.min(activity.documents, 4) * 0.5 +
      Math.min(activity.journals, 4) * 2 +
      Math.min(activity.assignments, 3) * 2 +
      Math.min(activity.quizzes, 3) * 2 +
      Math.min(activity.exams, 2) * 2 +
      Math.min(activity.assessments, 3) * 2 +
      Math.min(activity.pjj, 2) * 2;
    const category = score >= 10 ? "Aktif" : score >= 4 ? "Cukup" : score > 0 ? "Perlu perhatian" : "Belum aktif";
    return { ...teacher, activity, score, category };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const categories = {
    active: teacherRows.filter((row) => row.score >= 10).length,
    sufficient: teacherRows.filter((row) => row.score >= 4 && row.score < 10).length,
    attention: teacherRows.filter((row) => row.score > 0 && row.score < 4).length,
    inactive: teacherRows.filter((row) => row.score === 0).length,
  };
  const activeCount = categories.active + categories.sufficient;
  const schoolsCovered = new Set(teacherRows.map((row) => row.school?.name || row.teachingProfiles[0]?.schoolName).filter(Boolean)).size;
  const learningArtifacts = assignments.reduce((sum, row) => sum + row._count._all, 0) + quizzes.reduce((sum, row) => sum + row._count._all, 0) + exams.reduce((sum, row) => sum + row._count._all, 0) + assessments.reduce((sum, row) => sum + row._count._all, 0);

  const distribution = [
    { label: "Aktif", value: categories.active, tone: "bg-emerald-500" },
    { label: "Cukup aktif", value: categories.sufficient, tone: "bg-emerald-600" },
    { label: "Perlu perhatian", value: categories.attention, tone: "bg-amber-500" },
    { label: "Belum aktif", value: categories.inactive, tone: "bg-rose-500" },
  ];

  return (
    <ProvinceAdminShell activePath="/province/teachers" accountName={account.name} accountEmail={account.email}>
      <div className="flex flex-col gap-6 pb-10">
        <ProvincePageHeader
          title="Keaktifan Guru"
          description="Aktivitas penggunaan aplikasi untuk pembelajaran. Indikator ini bukan penilaian kinerja, disiplin, atau kualitas profesional guru."
          actions={<ProvinceDashboardToolbar period={period} />}
        />

        <ProvinceMetricStrip>
          <ProvinceMetric label="Guru terdata" value={formatProvinceNumber(teachers.length)} helper="Akun dengan role guru" icon={UserCheck} />
          <ProvinceMetric label="Aktif atau cukup" value={`${provincePercent(activeCount, teachers.length)}%`} helper={`${activeCount} guru pada periode ini`} icon={Activity} />
          <ProvinceMetric label="Sekolah terwakili" value={formatProvinceNumber(schoolsCovered)} helper="Berdasarkan profil utama guru" icon={School} />
          <ProvinceMetric label="Aktivitas asesmen" value={formatProvinceNumber(learningArtifacts)} helper="Tugas, kuis, ujian, dan penilaian" icon={BookOpen} />
        </ProvinceMetricStrip>

        <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <ProvinceSection title="Distribusi Keaktifan" description={`Aktivitas aplikasi selama ${period} hari terakhir.`}>
            <div className="flex flex-col gap-5">
              {distribution.map((item) => {
                const share = provincePercent(item.value, teachers.length);
                return (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-xs font-bold"><span className="text-slate-600">{item.label}</span><span>{item.value} · {share}%</span></div>
                    <ProvinceProgress value={share} tone={item.tone} />
                  </div>
                );
              })}
            </div>
          </ProvinceSection>

          <ProvinceSection title="Dasar Perhitungan" description="Skor dibatasi agar satu jenis aktivitas tidak mendominasi indikator.">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                ["Jurnal harian", "2 poin, maksimal 4 aktivitas"],
                ["Tugas, kuis, penilaian", "2 poin, maksimal 3 per jenis"],
                ["Ujian dan PJJ", "2 poin, maksimal 2 per jenis"],
                ["Dokumen", "0,5 poin, maksimal 4 dokumen"],
              ].map(([label, helper]) => (
                <div key={label} className="border-l-2 border-emerald-200 pl-3"><p className="text-sm font-extrabold text-slate-900">{label}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{helper}</p></div>
              ))}
            </div>
          </ProvinceSection>
        </div>

        <ProvinceSection title="Daftar Aktivitas Guru" description="Digunakan untuk menentukan sekolah yang memerlukan pendampingan adopsi aplikasi.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Guru</th><th className="px-3 py-3">Sekolah</th><th className="px-3 py-3">Jurnal</th><th className="px-3 py-3">Tugas</th><th className="px-3 py-3">Kuis/Ujian</th><th className="px-3 py-3">Penilaian</th><th className="px-3 py-3">PJJ</th><th className="px-3 py-3">Kategori</th></tr></thead>
              <tbody>
                {teacherRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                    <td className="px-3 py-4"><p className="font-extrabold text-slate-950">{row.name}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">{row.email}</p></td>
                    <td className="px-3 py-4 font-semibold text-slate-600">{row.school?.name || row.teachingProfiles[0]?.schoolName || "Belum terhubung"}</td>
                    <td className="px-3 py-4 font-bold">{row.activity.journals}</td>
                    <td className="px-3 py-4 font-bold">{row.activity.assignments}</td>
                    <td className="px-3 py-4 font-bold">{row.activity.quizzes + row.activity.exams}</td>
                    <td className="px-3 py-4 font-bold">{row.activity.assessments}</td>
                    <td className="px-3 py-4 font-bold">{row.activity.pjj}</td>
                    <td className="px-3 py-4"><span className={row.score >= 4 ? "font-extrabold text-emerald-700" : row.score > 0 ? "font-extrabold text-amber-700" : "font-extrabold text-slate-500"}>{row.category}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ProvinceSection>
      </div>
    </ProvinceAdminShell>
  );
}
