import type { Prisma } from "@prisma/client";
import { Building2, School, Search, UserCog } from "lucide-react";
import { ProvinceAdminShell } from "@/components/layout/province-admin-shell";
import {
  formatProvinceNumber,
  ProvinceMetric,
  ProvinceMetricStrip,
  ProvincePageHeader,
  ProvinceSection,
  provincePercent,
} from "@/components/province/province-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentProvinceAdmin } from "@/lib/province-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProvinceSchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string; regency?: string }>;
}) {
  const { account, scope } = await getCurrentProvinceAdmin("/province/schools");
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const level = query.level === "SMA" || query.level === "SMK" ? query.level : "";
  const regency = query.regency?.trim() ?? "";
  const provinceScope: Prisma.SchoolWhereInput = {
    OR: [
      { regency: { provinceId: scope.provinceId } },
      { province: scope.provinceName },
    ],
  };
  const where: Prisma.SchoolWhereInput = {
    AND: [
      provinceScope,
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q } },
                { npsn: { contains: q } },
                { city: { contains: q } },
              ],
            } satisfies Prisma.SchoolWhereInput,
          ]
        : []),
      ...(level ? [{ level: { contains: level } } satisfies Prisma.SchoolWhereInput] : []),
      ...(regency ? [{ regencyId: regency } satisfies Prisma.SchoolWhereInput] : []),
    ],
  };

  const [schools, regencies, totalSchools, totalSma, totalSmk, schoolsWithAdmin] = await Promise.all([
    prisma.school.findMany({
      where,
      orderBy: [{ regency: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        npsn: true,
        level: true,
        city: true,
        updatedAt: true,
        regency: { select: { name: true } },
        users: { select: { role: true } },
        classRooms: {
          select: { isActive: true, _count: { select: { students: true } } },
        },
      },
    }),
    prisma.regency.findMany({
      where: { provinceId: scope.provinceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.school.count({ where: provinceScope }),
    prisma.school.count({ where: { AND: [provinceScope, { level: { contains: "SMA" } }] } }),
    prisma.school.count({ where: { AND: [provinceScope, { level: { contains: "SMK" } }] } }),
    prisma.school.count({
      where: { AND: [provinceScope, { users: { some: { role: "SCHOOL_ADMIN" } } }] },
    }),
  ]);

  const activeSchools = schools.filter((school) => school.classRooms.some((room) => room.isActive)).length;
  const students = schools.reduce(
    (sum, school) => sum + school.classRooms.reduce((schoolSum, room) => schoolSum + room._count.students, 0),
    0
  );

  return (
    <ProvinceAdminShell activePath="/province/schools" accountName={account.name} accountEmail={account.email}>
      <div className="flex flex-col gap-6 pb-10">
        <ProvincePageHeader
          title="Direktori SMA dan SMK"
          description="Daftar sekolah riil yang tersimpan pada sistem beserta kesiapan admin, kelas aktif, dan jumlah siswa terhubung."
        />

        <ProvinceMetricStrip>
          <ProvinceMetric label="Total sekolah" value={formatProvinceNumber(totalSchools)} helper="SMA dan SMK Kalimantan Selatan" icon={Building2} />
          <ProvinceMetric label="SMA" value={formatProvinceNumber(totalSma)} helper="Sekolah menengah atas" icon={School} />
          <ProvinceMetric label="SMK" value={formatProvinceNumber(totalSmk)} helper="Sekolah menengah kejuruan" icon={School} />
          <ProvinceMetric label="Memiliki admin" value={`${provincePercent(schoolsWithAdmin, totalSchools)}%`} helper={`${formatProvinceNumber(schoolsWithAdmin)} sekolah siap mengelola data`} icon={UserCog} />
        </ProvinceMetricStrip>

        <ProvinceSection title="Cari dan Filter Sekolah" description={`${formatProvinceNumber(schools.length)} sekolah cocok · ${formatProvinceNumber(activeSchools)} aktif · ${formatProvinceNumber(students)} siswa pada hasil ini`}>
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_240px_auto]" action="/province/schools">
            <label className="relative block">
              <span className="sr-only">Cari sekolah</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input name="q" defaultValue={q} placeholder="Nama sekolah, NPSN, atau kota" className="h-11 pl-10" />
            </label>
            <label>
              <span className="sr-only">Jenjang</span>
              <select name="level" defaultValue={level} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-slate-700">
                <option value="">Semua jenjang</option>
                <option value="SMA">SMA</option>
                <option value="SMK">SMK</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Kabupaten atau kota</span>
              <select name="regency" defaultValue={regency} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-slate-700">
                <option value="">Semua kabupaten/kota</option>
                {regencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <Button type="submit" className="h-11">Terapkan</Button>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-extrabold">Sekolah</th>
                  <th className="px-3 py-3 font-extrabold">Wilayah</th>
                  <th className="px-3 py-3 font-extrabold">Jenjang</th>
                  <th className="px-3 py-3 font-extrabold">Kelas</th>
                  <th className="px-3 py-3 font-extrabold">Siswa</th>
                  <th className="px-3 py-3 font-extrabold">Admin</th>
                  <th className="px-3 py-3 font-extrabold">Status</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => {
                  const active = school.classRooms.some((room) => room.isActive);
                  const studentCount = school.classRooms.reduce((sum, room) => sum + room._count.students, 0);
                  const adminCount = school.users.filter((user) => user.role === "SCHOOL_ADMIN").length;
                  return (
                    <tr key={school.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                      <td className="px-3 py-4">
                        <p className="font-extrabold text-slate-950">{school.name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">NPSN {school.npsn || "belum tersedia"}</p>
                      </td>
                      <td className="px-3 py-4 font-semibold text-slate-600">{school.regency?.name || school.city || "Belum dipetakan"}</td>
                      <td className="px-3 py-4 font-bold text-slate-700">{school.level || "-"}</td>
                      <td className="px-3 py-4 font-bold text-slate-700">{school.classRooms.length}</td>
                      <td className="px-3 py-4 font-bold text-slate-700">{formatProvinceNumber(studentCount)}</td>
                      <td className="px-3 py-4 font-bold text-slate-700">{adminCount}</td>
                      <td className="px-3 py-4">
                        <span className={active ? "text-xs font-extrabold text-emerald-700" : "text-xs font-extrabold text-amber-700"}>
                          {active ? "Kelas aktif" : "Perlu aktivasi"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {schools.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">Tidak ada sekolah yang cocok dengan filter.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </ProvinceSection>
      </div>
    </ProvinceAdminShell>
  );
}
