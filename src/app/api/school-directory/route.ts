import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SCHOOL_WITH_REGION_INCLUDE,
  serializeProvince,
  serializeRegency,
  serializeSchool,
} from "@/lib/school-directory";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provinceId = url.searchParams.get("provinceId") || undefined;
  const regencyId = url.searchParams.get("regencyId") || undefined;
  const schoolId = url.searchParams.get("schoolId") || undefined;
  const q = (url.searchParams.get("q") || "").trim();
  const searchQuery = q.length >= 2 ? q.slice(0, 100) : "";

  const [provinces, regencies, schools] = await Promise.all([
    prisma.province.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.regency.findMany({
      where: provinceId ? { provinceId } : { id: { in: [] } },
      include: { province: { select: { name: true } } },
      orderBy: [{ province: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.school.findMany({
      where: {
        ...(!schoolId && !regencyId && !searchQuery ? { id: { in: [] } } : {}),
        ...(schoolId ? { id: schoolId } : {}),
        ...(regencyId
          ? { regencyId }
          : provinceId
            ? { regency: { provinceId } }
            : {}),
        ...(searchQuery
          ? {
              OR: [
                { name: { contains: searchQuery } },
                { npsn: { contains: searchQuery } },
                { city: { contains: searchQuery } },
                { province: { contains: searchQuery } },
                { regency: { name: { contains: searchQuery } } },
              ],
            }
          : {}),
      },
      include: SCHOOL_WITH_REGION_INCLUDE,
      orderBy: [{ name: "asc" }],
      take: 100,
    }),
  ]);

  return NextResponse.json({
    provinces: provinces.map(serializeProvince),
    regencies: regencies.map(serializeRegency),
    schools: schools.map(serializeSchool),
  });
}
