import { CalendarCheck2, CircleAlert, HeartPulse, UserX } from "lucide-react";
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
import { getProvinceAttendanceIndicators } from "@/lib/province-indicators";

export const dynamic = "force-dynamic";

export default async function ProvinceAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { account, scope } = await getCurrentProvinceAdmin("/province/attendance");
  const query = await searchParams;
  const period = ["30", "90", "365"].includes(query.period ?? "") ? query.period! : "30";
  const since = new Date();
  since.setDate(since.getDate() - Number(period));

  const data = await getProvinceAttendanceIndicators(scope, since);

  return (
    <ProvinceAdminShell
      activePath="/province/attendance"
      accountName={account.name}
      accountEmail={account.email}
    >
      <div className="flex flex-col gap-6 pb-10">
        <ProvincePageHeader
          title="Kehadiran Siswa"
          description={`Rekap hadir, izin, sakit, dan alpha pada sekolah di ${account.provinceName} selama ${period} hari terakhir.`}
          actions={<ProvinceDashboardToolbar period={period} />}
        />

        <ProvinceMetricStrip>
          <ProvinceMetric
            label="Persentase hadir"
            value={`${data.presentRate}%`}
            helper={`${formatProvinceNumber(data.present)} dari ${formatProvinceNumber(data.total)} catatan`}
            icon={CalendarCheck2}
            tone="emerald"
          />
          <ProvinceMetric
            label="Izin"
            value={formatProvinceNumber(data.excused)}
            helper={`${provincePercent(data.excused, data.total)}% dari total`}
            icon={CircleAlert}
            tone="amber"
          />
          <ProvinceMetric
            label="Sakit"
            value={formatProvinceNumber(data.sick)}
            helper={`${provincePercent(data.sick, data.total)}% dari total`}
            icon={HeartPulse}
            tone="orange"
          />
          <ProvinceMetric
            label="Alpha"
            value={formatProvinceNumber(data.absent)}
            helper={`${provincePercent(data.absent, data.total)}% dari total`}
            icon={UserX}
            tone="rose"
          />
        </ProvinceMetricStrip>

        {data.total === 0 ? (
          <ProvinceEmptyState
            title="Belum ada data kehadiran"
            description="Catatan absensi kelas pada periode ini belum tersedia untuk sekolah di wilayah Anda."
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <ProvinceSection
              title="Distribusi Status"
              description="Proporsi status kehadiran di seluruh sekolah provinsi."
            >
              <div className="space-y-4">
                {data.byStatus.map((item) => (
                  <div key={item.status}>
                    <div className="mb-2 flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="text-slate-950">
                        {formatProvinceNumber(item.count)} · {item.rate}%
                      </span>
                    </div>
                    <ProvinceProgress
                      value={item.rate}
                      tone={
                        item.status === "PRESENT"
                          ? "bg-emerald-500"
                          : item.status === "ABSENT"
                            ? "bg-rose-500"
                            : "bg-amber-500"
                      }
                    />
                  </div>
                ))}
              </div>
            </ProvinceSection>

            <ProvinceSection
              title="Kabupaten/Kota"
              description="Persentase kehadiran per wilayah."
            >
              <div className="max-h-[360px] space-y-3 overflow-y-auto">
                {data.byRegency.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-100 px-3 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="font-extrabold text-slate-900">{row.name}</p>
                      <p className="font-black text-slate-950">{row.presentRate}%</p>
                    </div>
                    <div className="mt-2">
                      <ProvinceProgress value={row.presentRate} />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                      {formatProvinceNumber(row.present)} hadir dari {formatProvinceNumber(row.total)} catatan
                    </p>
                  </div>
                ))}
              </div>
            </ProvinceSection>
          </div>
        )}

        {data.bySchool.length > 0 ? (
          <ProvinceSection
            title="Sekolah dengan Kehadiran Terendah"
            description="Prioritas pantauan untuk tindak lanjut kehadiran siswa."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Sekolah</th>
                    <th className="px-2 py-3">Wilayah</th>
                    <th className="px-2 py-3">Hadir</th>
                    <th className="px-2 py-3">Izin</th>
                    <th className="px-2 py-3">Sakit</th>
                    <th className="px-2 py-3">Alpha</th>
                    <th className="px-2 py-3">% Hadir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.bySchool.map((school) => (
                    <tr key={school.id}>
                      <td className="px-2 py-3 font-semibold text-slate-900">{school.name}</td>
                      <td className="px-2 py-3 text-slate-600">{school.regencyName || "—"}</td>
                      <td className="px-2 py-3">{formatProvinceNumber(school.present)}</td>
                      <td className="px-2 py-3">{formatProvinceNumber(school.excused)}</td>
                      <td className="px-2 py-3">{formatProvinceNumber(school.sick)}</td>
                      <td className="px-2 py-3">{formatProvinceNumber(school.absent)}</td>
                      <td className="px-2 py-3 font-black text-slate-950">{school.presentRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ProvinceSection>
        ) : null}
      </div>
    </ProvinceAdminShell>
  );
}
