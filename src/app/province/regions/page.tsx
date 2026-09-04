import { Building2, MapPinned, School, Users } from "lucide-react";
import { ProvinceAdminShell } from "@/components/layout/province-admin-shell";
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

export default async function ProvinceRegionsPage() {
  const { account } = await getCurrentProvinceAdmin("/province/regions");
  const regencies = await prisma.regency.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { schools: true } } },
  });

  const rows = await Promise.all(
    regencies.map(async (regency) => {
      const [sma, smk, active, admins, students] = await Promise.all([
        prisma.school.count({ where: { regencyId: regency.id, level: { contains: "SMA" } } }),
        prisma.school.count({ where: { regencyId: regency.id, level: { contains: "SMK" } } }),
        prisma.school.count({ where: { regencyId: regency.id, classRooms: { some: { isActive: true } } } }),
        prisma.school.count({ where: { regencyId: regency.id, users: { some: { role: "SCHOOL_ADMIN" } } } }),
        prisma.student.count({ where: { isActive: true, classRoom: { school: { regencyId: regency.id } } } }),
      ]);
      const schools = regency._count.schools;
      const readiness = schools
        ? Math.round(provincePercent(active, schools) * 0.65 + provincePercent(admins, schools) * 0.35)
        : 0;
      return { ...regency, schools, sma, smk, active, admins, students, readiness };
    })
  );

  const totalSchools = rows.reduce((sum, row) => sum + row.schools, 0);
  const totalActive = rows.reduce((sum, row) => sum + row.active, 0);
  const totalStudents = rows.reduce((sum, row) => sum + row.students, 0);
  const averageReadiness = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.readiness, 0) / rows.length)
    : 0;

  return (
    <ProvinceAdminShell activePath="/province/regions" accountName={account.name} accountEmail={account.email}>
      <div className="flex flex-col gap-6 pb-10">
        <ProvincePageHeader
          title="Wilayah Pendidikan"
          description="Perbandingan kesiapan data dan aktivitas SMA/SMK pada setiap kabupaten dan kota di Kalimantan Selatan."
        />

        <ProvinceMetricStrip>
          <ProvinceMetric label="Kabupaten/Kota" value={formatProvinceNumber(rows.length)} helper="Wilayah administratif terdata" icon={MapPinned} />
          <ProvinceMetric label="SMA/SMK" value={formatProvinceNumber(totalSchools)} helper="Sekolah pada seluruh wilayah" icon={School} />
          <ProvinceMetric label="Sekolah aktif" value={`${provincePercent(totalActive, totalSchools)}%`} helper={`${formatProvinceNumber(totalActive)} memiliki kelas aktif`} icon={Building2} />
          <ProvinceMetric label="Peserta didik" value={formatProvinceNumber(totalStudents)} helper={`Kesiapan wilayah rata-rata ${averageReadiness}%`} icon={Users} />
        </ProvinceMetricStrip>

        <ProvinceSection title="Kesiapan Kabupaten/Kota" description="Skor menggabungkan sekolah yang memiliki kelas aktif (65%) dan admin sekolah (35%).">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-extrabold">Wilayah</th>
                  <th className="px-3 py-3 font-extrabold">SMA</th>
                  <th className="px-3 py-3 font-extrabold">SMK</th>
                  <th className="px-3 py-3 font-extrabold">Kelas aktif</th>
                  <th className="px-3 py-3 font-extrabold">Admin sekolah</th>
                  <th className="px-3 py-3 font-extrabold">Siswa</th>
                  <th className="w-48 px-3 py-3 font-extrabold">Kesiapan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                    <td className="px-3 py-4">
                      <p className="font-extrabold text-slate-950">{row.name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">{row.type}</p>
                    </td>
                    <td className="px-3 py-4 font-bold text-slate-700">{formatProvinceNumber(row.sma)}</td>
                    <td className="px-3 py-4 font-bold text-slate-700">{formatProvinceNumber(row.smk)}</td>
                    <td className="px-3 py-4 font-bold text-slate-700">{row.active}/{row.schools}</td>
                    <td className="px-3 py-4 font-bold text-slate-700">{row.admins}/{row.schools}</td>
                    <td className="px-3 py-4 font-bold text-slate-700">{formatProvinceNumber(row.students)}</td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1"><ProvinceProgress value={row.readiness} /></div>
                        <span className="w-10 text-right text-xs font-black text-slate-700">{row.readiness}%</span>
                      </div>
                    </td>
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
