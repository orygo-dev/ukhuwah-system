import { BookOpenCheck, Clock3, FileText, GraduationCap, Library, Users } from "lucide-react";
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

const literacyFilter = {
  OR: [
    { mapel: { contains: "Bahasa Indonesia" } },
    { mapel: { contains: "Literasi" } },
    { title: { contains: "literasi" } },
  ],
};

export default async function ProvinceLiteracyPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { account } = await getCurrentProvinceAdmin("/province/literacy");
  const query = await searchParams;
  const period = ["30", "90", "365"].includes(query.period ?? "") ? query.period! : "30";
  const since = new Date();
  since.setDate(since.getDate() - Number(period));

  const [studentCount, quizAttempts, examAttempts, assignments, submissions, writingStudents, readingProgress] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.quizAttempt.findMany({
      where: { submittedAt: { gte: since }, quiz: literacyFilter },
      select: {
        id: true,
        score: true,
        submittedAt: true,
        studentId: true,
        quiz: { select: { title: true, mapel: true } },
        student: { select: { classRoom: { select: { school: { select: { regency: { select: { name: true } } } } } } } },
      },
    }),
    prisma.examAttempt.findMany({
      where: { submittedAt: { gte: since }, exam: literacyFilter },
      select: {
        id: true,
        score: true,
        submittedAt: true,
        studentId: true,
        exam: { select: { title: true, mapel: true } },
        student: { select: { classRoom: { select: { school: { select: { regency: { select: { name: true } } } } } } } },
      },
    }),
    prisma.assignment.count({ where: { createdAt: { gte: since }, ...literacyFilter } }),
    prisma.assignmentSubmission.count({ where: { submittedAt: { gte: since }, assignment: literacyFilter } }),
    prisma.studentBoardPost.findMany({
      where: {
        publishedAt: { gte: since },
        studentId: { not: null },
        status: "PUBLISHED",
        OR: [
          { category: { contains: "Literasi" } },
          { category: { contains: "Cerpen" } },
          { category: { contains: "Puisi" } },
          { category: { contains: "Artikel" } },
        ],
      },
      distinct: ["studentId"],
      select: { studentId: true },
    }),
    prisma.readingProgress.findMany({
      where: { lastReadAt: { gte: since } },
      select: { studentId: true, progressPercent: true, secondsRead: true, completedAt: true },
    }),
  ]);

  const attempts = [
    ...quizAttempts.map((item) => ({ ...item, type: "Kuis", title: item.quiz.title, mapel: item.quiz.mapel })),
    ...examAttempts.map((item) => ({ ...item, type: "Ujian", title: item.exam.title, mapel: item.exam.mapel })),
  ].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  const studentIds = new Set(attempts.map((item) => item.studentId));
  writingStudents.forEach((item) => item.studentId && studentIds.add(item.studentId));
  readingProgress.forEach((item) => studentIds.add(item.studentId));
  const readingStudents = new Set(readingProgress.map((item) => item.studentId));
  const readingMinutes = Math.round(readingProgress.reduce((sum, item) => sum + item.secondsRead, 0) / 60);
  const completedReadings = readingProgress.filter((item) => item.completedAt).length;
  const average = attempts.length ? attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length : 0;
  const distribution = [
    { label: "Mahir", value: attempts.filter((item) => item.score >= 80).length, tone: "bg-emerald-500" },
    { label: "Cakap", value: attempts.filter((item) => item.score >= 65 && item.score < 80).length, tone: "bg-emerald-600" },
    { label: "Dasar", value: attempts.filter((item) => item.score >= 50 && item.score < 65).length, tone: "bg-amber-500" },
    { label: "Perlu intervensi", value: attempts.filter((item) => item.score < 50).length, tone: "bg-rose-500" },
  ];

  const regionMap = new Map<string, { total: number; score: number }>();
  attempts.forEach((item) => {
    const region = item.student.classRoom.school?.regency?.name || "Belum dipetakan";
    const current = regionMap.get(region) ?? { total: 0, score: 0 };
    current.total += 1;
    current.score += item.score;
    regionMap.set(region, current);
  });
  const regionRows = [...regionMap.entries()]
    .map(([name, value]) => ({ name, attempts: value.total, average: value.score / value.total }))
    .sort((a, b) => b.average - a.average);

  return (
    <ProvinceAdminShell activePath="/province/literacy" accountName={account.name} accountEmail={account.email}>
      <div className="flex flex-col gap-6 pb-10">
        <ProvincePageHeader
          title="Literasi Siswa"
          description="Capaian literasi dihitung hanya dari kuis dan ujian berlabel Literasi atau Bahasa Indonesia. Karya tulis menunjukkan partisipasi, bukan nilai."
          actions={<ProvinceDashboardToolbar period={period} />}
        />

        <ProvinceMetricStrip>
          <ProvinceMetric label="Rata-rata capaian" value={attempts.length ? average.toFixed(1) : "—"} helper={`${formatProvinceNumber(attempts.length)} hasil asesmen aktual`} icon={BookOpenCheck} />
          <ProvinceMetric label="Siswa terlibat" value={formatProvinceNumber(studentIds.size)} helper={`${provincePercent(studentIds.size, studentCount)}% dari siswa aktif`} icon={Users} />
          <ProvinceMetric label="Tugas literasi" value={formatProvinceNumber(assignments)} helper={`${formatProvinceNumber(submissions)} pengumpulan`} icon={FileText} />
          <ProvinceMetric label="Penulis aktif" value={formatProvinceNumber(writingStudents.length)} helper="Karya literasi terpublikasi" icon={GraduationCap} />
        </ProvinceMetricStrip>

        <ProvinceSection title="Aktivitas Zona Baca" description={`Aktivitas perpustakaan digital pada ${period} hari terakhir ikut dihitung sebagai partisipasi literasi, tetapi tidak mengubah nilai asesmen.`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><Library className="h-5 w-5 text-emerald-700" /><p className="mt-3 text-2xl font-black text-slate-950">{formatProvinceNumber(readingStudents.size)}</p><p className="text-xs font-bold text-slate-500">Pembaca aktif</p></div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><BookOpenCheck className="h-5 w-5 text-emerald-700" /><p className="mt-3 text-2xl font-black text-slate-950">{formatProvinceNumber(completedReadings)}</p><p className="text-xs font-bold text-slate-500">Bacaan selesai</p></div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4"><Clock3 className="h-5 w-5 text-cyan-700" /><p className="mt-3 text-2xl font-black text-slate-950">{formatProvinceNumber(readingMinutes)}</p><p className="text-xs font-bold text-slate-500">Menit membaca tercatat</p></div>
          </div>
        </ProvinceSection>

        {attempts.length === 0 ? (
          <ProvinceEmptyState
            title="Belum ada capaian literasi yang dapat dihitung"
            description="Minta sekolah memberi label Literasi atau Bahasa Indonesia pada asesmen. Sistem tidak mengarang skor dari data yang belum tersedia."
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <ProvinceSection title="Distribusi Capaian" description={`Sebaran ${formatProvinceNumber(attempts.length)} hasil pada ${period} hari terakhir.`}>
              <div className="flex flex-col gap-5">
                {distribution.map((item) => {
                  const share = provincePercent(item.value, attempts.length);
                  return (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="text-slate-950">{formatProvinceNumber(item.value)} · {share}%</span>
                      </div>
                      <ProvinceProgress value={share} tone={item.tone} />
                    </div>
                  );
                })}
              </div>
            </ProvinceSection>

            <ProvinceSection title="Capaian per Wilayah" description="Hanya wilayah yang sudah memiliki hasil asesmen literasi.">
              <div className="flex flex-col gap-4">
                {regionRows.map((row) => (
                  <div key={row.name} className="grid grid-cols-[minmax(0,1fr)_70px] items-center gap-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
                        <span className="truncate text-slate-700">{row.name}</span>
                        <span className="text-slate-500">{row.attempts} hasil</span>
                      </div>
                      <ProvinceProgress value={row.average} />
                    </div>
                    <span className="text-right text-sm font-black text-slate-950">{row.average.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </ProvinceSection>
          </div>
        )}

        <ProvinceSection title="Hasil Asesmen Terbaru" description="Jejak nilai terbaru yang menjadi dasar indikator literasi.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Asesmen</th><th className="px-3 py-3">Jenis</th><th className="px-3 py-3">Mapel</th><th className="px-3 py-3">Wilayah</th><th className="px-3 py-3 text-right">Nilai</th></tr></thead>
              <tbody>
                {attempts.slice(0, 20).map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-4 font-extrabold text-slate-950">{item.title}</td>
                    <td className="px-3 py-4 font-semibold text-slate-600">{item.type}</td>
                    <td className="px-3 py-4 font-semibold text-slate-600">{item.mapel}</td>
                    <td className="px-3 py-4 font-semibold text-slate-600">{item.student.classRoom.school?.regency?.name || "Belum dipetakan"}</td>
                    <td className="px-3 py-4 text-right font-black text-slate-950">{item.score.toFixed(1)}</td>
                  </tr>
                ))}
                {attempts.length === 0 ? <tr><td colSpan={5} className="px-3 py-10 text-center font-semibold text-slate-500">Belum ada hasil asesmen.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </ProvinceSection>
      </div>
    </ProvinceAdminShell>
  );
}
