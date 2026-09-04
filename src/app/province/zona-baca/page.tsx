import { BookCheck, BookOpen, Clock3, Library, School, Users } from "lucide-react";
import { ProvinceAdminShell } from "@/components/layout/province-admin-shell";
import { ProvinceDashboardToolbar } from "@/components/province/province-dashboard-toolbar";
import { formatProvinceNumber, ProvinceEmptyState, ProvinceMetric, ProvinceMetricStrip, ProvincePageHeader, ProvinceProgress, ProvinceSection, provincePercent } from "@/components/province/province-page";
import { getCurrentProvinceAdmin } from "@/lib/province-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProvinceReadingPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [{ account }, query] = await Promise.all([getCurrentProvinceAdmin("/province/zona-baca"), searchParams]);
  const period = ["30", "90", "365"].includes(query.period ?? "") ? query.period! : "30";
  const since = new Date();
  since.setDate(since.getDate() - Number(period));
  const [publishedBooks, progressRows, studentCount, schoolCount] = await Promise.all([
    prisma.readingBook.count({ where: { status: "PUBLISHED" } }),
    prisma.readingProgress.findMany({
      where: { lastReadAt: { gte: since } },
      select: {
        studentId: true,
        progressPercent: true,
        secondsRead: true,
        completedAt: true,
        student: { select: { classRoom: { select: { school: { select: { id: true, name: true, regency: { select: { name: true } } } } } } } },
      },
    }),
    prisma.student.count({ where: { isActive: true } }),
    prisma.school.count(),
  ]);
  const activeStudents = new Set(progressRows.map((item) => item.studentId));
  const completed = progressRows.filter((item) => item.completedAt).length;
  const totalMinutes = Math.round(progressRows.reduce((sum, item) => sum + item.secondsRead, 0) / 60);
  const schoolMap = new Map<string, { name: string; region: string; readers: Set<string>; minutes: number; completed: number }>();
  progressRows.forEach((item) => {
    const school = item.student.classRoom.school;
    if (!school) return;
    const row = schoolMap.get(school.id) ?? { name: school.name, region: school.regency?.name || "Belum dipetakan", readers: new Set<string>(), minutes: 0, completed: 0 };
    row.readers.add(item.studentId);
    row.minutes += Math.round(item.secondsRead / 60);
    if (item.completedAt) row.completed += 1;
    schoolMap.set(school.id, row);
  });
  const schoolRows = [...schoolMap.values()].sort((a, b) => b.readers.size - a.readers.size);

  return <ProvinceAdminShell activePath="/province/zona-baca" accountName={account.name} accountEmail={account.email}><div className="flex flex-col gap-6 pb-10"><ProvincePageHeader title="Statistik Zona Baca" description="Aktivitas perpustakaan digital yang benar-benar tercatat dari progres membaca siswa. Durasi berasal dari sesi yang disimpan siswa, bukan estimasi." actions={<ProvinceDashboardToolbar period={period} />} />
    <ProvinceMetricStrip><ProvinceMetric label="Koleksi terbit" value={formatProvinceNumber(publishedBooks)} helper="Global, sekolah, dan kelas" icon={Library} /><ProvinceMetric label="Pembaca aktif" value={formatProvinceNumber(activeStudents.size)} helper={`${provincePercent(activeStudents.size, studentCount)}% siswa aktif`} icon={Users} /><ProvinceMetric label="Bacaan selesai" value={formatProvinceNumber(completed)} helper={`Dalam ${period} hari`} icon={BookCheck} /><ProvinceMetric label="Waktu membaca" value={`${formatProvinceNumber(totalMinutes)} mnt`} helper="Akumulasi sesi tersimpan" icon={Clock3} /></ProvinceMetricStrip>
    {progressRows.length === 0 ? <ProvinceEmptyState title="Belum ada aktivitas Zona Baca" description="Aktivitas akan muncul setelah siswa membuka bacaan dan menyimpan progres membaca." /> : <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><ProvinceSection title="Partisipasi per Sekolah" description={`${schoolRows.length} dari ${formatProvinceNumber(schoolCount)} sekolah memiliki aktivitas pada periode ini.`}><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Sekolah</th><th className="px-3 py-3">Wilayah</th><th className="px-3 py-3 text-right">Pembaca</th><th className="px-3 py-3 text-right">Selesai</th><th className="px-3 py-3 text-right">Menit</th></tr></thead><tbody>{schoolRows.map((row) => <tr key={`${row.name}-${row.region}`} className="border-b border-slate-100"><td className="px-3 py-4 font-extrabold">{row.name}</td><td className="px-3 py-4 font-semibold text-slate-500">{row.region}</td><td className="px-3 py-4 text-right font-black">{row.readers.size}</td><td className="px-3 py-4 text-right font-black">{row.completed}</td><td className="px-3 py-4 text-right font-black">{row.minutes}</td></tr>)}</tbody></table></div></ProvinceSection><ProvinceSection title="Cakupan Sekolah" description="Persentase sekolah yang menghasilkan aktivitas membaca."><div className="flex min-h-64 flex-col items-center justify-center text-center"><div className="grid h-28 w-28 place-items-center rounded-full bg-emerald-50 text-3xl font-black text-emerald-800">{provincePercent(schoolRows.length, schoolCount)}%</div><p className="mt-4 text-sm font-bold text-slate-600">{schoolRows.length} sekolah aktif</p><div className="mt-5 w-full"><ProvinceProgress value={provincePercent(schoolRows.length, schoolCount)} /></div></div></ProvinceSection></div>}
    <ProvinceSection title="Definisi Indikator" description="Agar angka dapat diaudit dan tidak menyesatkan."><div className="grid gap-4 md:grid-cols-3"><Definition icon={BookOpen} title="Pembaca aktif" text="Siswa dengan progres yang diperbarui dalam periode terpilih." /><Definition icon={BookCheck} title="Bacaan selesai" text="Progres buku telah mencapai 100 persen." /><Definition icon={School} title="Sekolah aktif" text="Sekolah dengan minimal satu siswa yang menyimpan progres." /></div></ProvinceSection>
  </div></ProvinceAdminShell>;
}

function Definition({ icon: Icon, title, text }: { icon: typeof BookOpen; title: string; text: string }) {
  return <div className="rounded-2xl border border-slate-200 p-4"><Icon className="h-5 w-5 text-emerald-700" /><p className="mt-3 font-black">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>;
}
