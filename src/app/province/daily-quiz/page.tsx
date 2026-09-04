import { Flame, Target, Trophy, Users } from "lucide-react";
import { ProvinceAdminShell } from "@/components/layout/province-admin-shell";
import { ProvinceDashboardToolbar } from "@/components/province/province-dashboard-toolbar";
import {
  formatProvinceNumber,
  ProvinceEmptyState,
  ProvinceMetric,
  ProvinceMetricStrip,
  ProvincePageHeader,
  ProvinceSection,
} from "@/components/province/province-page";
import { getCurrentProvinceAdmin } from "@/lib/province-admin";
import { getProvinceDailyQuizIndicators } from "@/lib/province-indicators";

export const dynamic = "force-dynamic";

export default async function ProvinceDailyQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { account, scope } = await getCurrentProvinceAdmin("/province/daily-quiz");
  const query = await searchParams;
  const period = ["30", "90", "365"].includes(query.period ?? "") ? query.period! : "30";
  const since = new Date();
  since.setDate(since.getDate() - Number(period));

  const data = await getProvinceDailyQuizIndicators(scope, since);

  return (
    <ProvinceAdminShell
      activePath="/province/daily-quiz"
      accountName={account.name}
      accountEmail={account.email}
    >
      <div className="flex flex-col gap-6 pb-10">
        <ProvincePageHeader
          title="Quiz Harian Nasional"
          description={`Partisipasi siswa ${account.provinceName} pada quiz game nasional (1 quiz/hari) selama ${period} hari terakhir.`}
          actions={<ProvinceDashboardToolbar period={period} />}
        />

        <ProvinceMetricStrip>
          <ProvinceMetric
            label="Partisipasi siswa"
            value={`${data.participationRate}%`}
            helper={`${formatProvinceNumber(data.participantCount)} dari ${formatProvinceNumber(data.studentCount)} siswa`}
            icon={Users}
          />
          <ProvinceMetric
            label="Attempt"
            value={formatProvinceNumber(data.attemptCount)}
            helper={`${formatProvinceNumber(data.publishedQuizCount)} quiz terbit pada periode`}
            icon={Target}
          />
          <ProvinceMetric
            label="Rata-rata skor"
            value={data.attemptCount ? data.avgScore.toFixed(1) : "—"}
            helper="Nilai 0–100 dari attempt siswa wilayah"
            icon={Trophy}
          />
          <ProvinceMetric
            label="Sekolah aktif"
            value={formatProvinceNumber(data.bySchool.length)}
            helper="Sekolah dengan minimal 1 attempt"
            icon={Flame}
          />
        </ProvinceMetricStrip>

        {data.attemptCount === 0 ? (
          <ProvinceEmptyState
            title="Belum ada partisipasi quiz harian"
            description="Pastikan Super Admin sudah mempublikasikan quiz harian dan siswa sudah mulai mengerjakan."
          />
        ) : (
          <ProvinceSection
            title="Sekolah Paling Konsisten"
            description="Diurutkan dari jumlah hari aktif bermain quiz, lalu rata-rata skor."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Sekolah</th>
                    <th className="px-2 py-3">Wilayah</th>
                    <th className="px-2 py-3">Hari aktif</th>
                    <th className="px-2 py-3">Peserta</th>
                    <th className="px-2 py-3">Attempt</th>
                    <th className="px-2 py-3">Rata skor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.bySchool.map((school) => (
                    <tr key={school.id}>
                      <td className="px-2 py-3 font-semibold text-slate-900">{school.name}</td>
                      <td className="px-2 py-3 text-slate-600">{school.regencyName || "—"}</td>
                      <td className="px-2 py-3 font-black text-slate-950">{school.activeDays}</td>
                      <td className="px-2 py-3">{formatProvinceNumber(school.participants)}</td>
                      <td className="px-2 py-3">{formatProvinceNumber(school.attempts)}</td>
                      <td className="px-2 py-3 font-black text-emerald-700">
                        {school.avgScore.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ProvinceSection>
        )}
      </div>
    </ProvinceAdminShell>
  );
}
