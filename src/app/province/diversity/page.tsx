import { HeartHandshake, MapPinned, ShieldCheck, UsersRound } from "lucide-react";
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
import { getProvinceDiversityIndicators } from "@/lib/province-indicators";

export const dynamic = "force-dynamic";

export default async function ProvinceDiversityPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { account, scope } = await getCurrentProvinceAdmin("/province/diversity");
  const query = await searchParams;
  const period = ["30", "90", "365"].includes(query.period ?? "") ? query.period! : "30";
  const since = new Date();
  since.setDate(since.getDate() - Number(period));

  const data = await getProvinceDiversityIndicators(scope, since);
  const genderKnown = data.male + data.female;

  return (
    <ProvinceAdminShell
      activePath="/province/diversity"
      accountName={account.name}
      accountEmail={account.email}
    >
      <div className="flex flex-col gap-6 pb-10">
        <ProvincePageHeader
          title="Kebhinnekaan & Partisipasi Inklusif"
          description={`Indikator operasional berbasis data aplikasi di ${account.provinceName}. Ini bukan skor survei iklim sekolah resmi, tetapi proxy partisipasi inklusif yang bisa dipantau sekarang.`}
          actions={<ProvinceDashboardToolbar period={period} />}
        />

        <ProvinceMetricStrip>
          <ProvinceMetric
            label="Indeks inklusif"
            value={`${data.inclusiveIndex}%`}
            helper="Gabungan demografi, orang tua, wilayah, dan konten"
            icon={ShieldCheck}
          />
          <ProvinceMetric
            label="Keseimbangan gender"
            value={`${data.genderBalanceScore}%`}
            helper={
              genderKnown
                ? `L ${formatProvinceNumber(data.male)} · P ${formatProvinceNumber(data.female)}`
                : "Data gender belum cukup"
            }
            icon={UsersRound}
          />
          <ProvinceMetric
            label="Akses orang tua"
            value={`${data.parentCoverage}%`}
            helper={`${formatProvinceNumber(data.parentAccessCount)} siswa dengan portal orang tua`}
            icon={HeartHandshake}
          />
          <ProvinceMetric
            label="Cakupan kab/kota"
            value={`${data.regencyCoverage}%`}
            helper={`${formatProvinceNumber(data.regenciesWithStudents)} dari ${formatProvinceNumber(data.regencyCount)} wilayah`}
            icon={MapPinned}
          />
        </ProvinceMetricStrip>

        <div className="grid gap-6 xl:grid-cols-2">
          <ProvinceSection
            title="Komponen Indeks"
            description="Masing-masing komponen dihitung dari data aktual sekolah/siswa di provinsi."
          >
            <div className="space-y-5">
              {[
                {
                  label: "Demografi gender terisi",
                  value: provincePercent(data.genderRecorded, data.studentCount),
                  helper: `${formatProvinceNumber(data.genderRecorded)} dari ${formatProvinceNumber(data.studentCount)} siswa`,
                },
                {
                  label: "Keseimbangan L/P",
                  value: data.genderBalanceScore,
                  helper: "100% = proporsi paling seimbang",
                },
                {
                  label: "Portal orang tua aktif",
                  value: data.parentCoverage,
                  helper: "Siswa dengan parent access enabled",
                },
                {
                  label: "Kab/kota dengan siswa aktif",
                  value: data.regencyCoverage,
                  helper: "Representasi wilayah",
                },
                {
                  label: "Sekolah aktif berkonten",
                  value: data.contentSchoolRate,
                  helper: `${formatProvinceNumber(data.contentSchoolCount)} sekolah · ${formatProvinceNumber(data.publishedContent)} konten terbit`,
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="text-slate-950">{item.value}%</span>
                  </div>
                  <ProvinceProgress value={item.value} />
                  <p className="mt-2 text-xs font-semibold text-slate-500">{item.helper}</p>
                </div>
              ))}
            </div>
          </ProvinceSection>

          <ProvinceSection
            title="Cara Membaca"
            description="Gunakan indeks ini untuk pantauan operasional, bukan sebagai pengganti survei kebhinnekaan formal."
          >
            <div className="space-y-4 text-sm leading-6 text-slate-600">
              <p>
                Indeks inklusif menggabungkan kelengkapan demografi, keseimbangan gender,
                aktivasi orang tua, sebaran wilayah, dan partisipasi konten siswa lintas sekolah.
              </p>
              <p>
                Nilai tinggi berarti lebih banyak siswa/sekolah terwakili dalam sistem. Nilai
                rendah menandai wilayah atau kelompok yang belum terhubung ke layanan digital.
              </p>
              <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                Survei anonim rasa aman, toleransi, dan iklim sekolah masih perlu instrumen
                terpisah bila Dinas ingin skor kebhinnekaan resmi.
              </p>
            </div>
          </ProvinceSection>
        </div>
      </div>
    </ProvinceAdminShell>
  );
}
