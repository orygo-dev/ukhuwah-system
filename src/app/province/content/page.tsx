import { Clapperboard, Clock3, Newspaper, School } from "lucide-react";
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
import { getProvinceContentIndicators } from "@/lib/province-indicators";

export const dynamic = "force-dynamic";

export default async function ProvinceContentPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { account, scope } = await getCurrentProvinceAdmin("/province/content");
  const query = await searchParams;
  const period = ["30", "90", "365"].includes(query.period ?? "") ? query.period! : "30";
  const since = new Date();
  since.setDate(since.getDate() - Number(period));

  const data = await getProvinceContentIndicators(scope, since);

  return (
    <ProvinceAdminShell
      activePath="/province/content"
      accountName={account.name}
      accountEmail={account.email}
    >
      <div className="flex flex-col gap-6 pb-10">
        <ProvincePageHeader
          title="Zona Kreasi & Mading"
          description={`Aktivitas konten siswa di ${account.provinceName} selama ${period} hari terakhir, termasuk antrean review.`}
          actions={<ProvinceDashboardToolbar period={period} />}
        />

        <ProvinceMetricStrip>
          <ProvinceMetric
            label="Konten terbit"
            value={formatProvinceNumber(data.publishedTotal)}
            helper={`Mading ${formatProvinceNumber(data.madingPublished)} · Zona Kreasi ${formatProvinceNumber(data.spotlightPublished)}`}
            icon={Newspaper}
            tone="emerald"
          />
          <ProvinceMetric
            label="Menunggu review"
            value={formatProvinceNumber(data.pendingTotal)}
            helper={`Mading ${formatProvinceNumber(data.madingPending)} · Zona Kreasi ${formatProvinceNumber(data.spotlightPending)}`}
            icon={Clock3}
            tone="amber"
          />
          <ProvinceMetric
            label="Zona Kreasi ditolak"
            value={formatProvinceNumber(data.spotlightRejected)}
            helper={`Mading ditolak ${formatProvinceNumber(data.madingRejected)}`}
            icon={Clapperboard}
            tone="rose"
          />
          <ProvinceMetric
            label="Sekolah aktif"
            value={formatProvinceNumber(data.activeSchoolCount)}
            helper="Minimal 1 unggahan mading/Zona Kreasi"
            icon={School}
            tone="sky"
          />
        </ProvinceMetricStrip>

        {data.publishedTotal + data.pendingTotal === 0 ? (
          <ProvinceEmptyState
            title="Belum ada aktivitas konten siswa"
            description="Mading dan Zona Kreasi siswa di wilayah ini belum memiliki unggahan pada periode yang dipilih."
          />
        ) : (
          <ProvinceSection
            title="Sekolah Paling Aktif"
            description="Gabungan unggahan mading dan Zona Kreasi (terbit + menunggu review)."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Sekolah</th>
                    <th className="px-2 py-3">Wilayah</th>
                    <th className="px-2 py-3">Mading</th>
                    <th className="px-2 py-3">Zona Kreasi</th>
                    <th className="px-2 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.bySchool.map((school) => (
                    <tr key={school.id}>
                      <td className="px-2 py-3 font-semibold text-slate-900">{school.name}</td>
                      <td className="px-2 py-3 text-slate-600">{school.regencyName || "—"}</td>
                      <td className="px-2 py-3">{formatProvinceNumber(school.mading)}</td>
                      <td className="px-2 py-3">{formatProvinceNumber(school.spotlight)}</td>
                      <td className="px-2 py-3 font-black text-slate-950">
                        {formatProvinceNumber(school.total)}
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
