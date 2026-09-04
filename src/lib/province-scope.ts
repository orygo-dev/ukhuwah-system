import { prisma } from "@/lib/prisma";

/** Schools belonging to a province via regency relation (preferred) or legacy province string. */
export async function schoolIdsForProvince(provinceId: string) {
  const province = await prisma.province.findUnique({
    where: { id: provinceId },
    select: { id: true, name: true },
  });
  if (!province) return [] as string[];

  const schools = await prisma.school.findMany({
    where: {
      OR: [
        { regency: { provinceId: province.id } },
        { province: province.name },
      ],
    },
    select: { id: true },
  });
  return schools.map((school) => school.id);
}

export async function getProvinceAdminScope(userId: string) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      provinceId: true,
      province: { select: { id: true, name: true } },
    },
  });
  if (!account || account.role !== "PROVINCE_ADMIN" || !account.provinceId || !account.province) {
    return null;
  }
  const schoolIds = await schoolIdsForProvince(account.provinceId);
  return {
    userId: account.id,
    provinceId: account.provinceId,
    provinceName: account.province.name,
    schoolIds,
  };
}

export function schoolWhereForProvince(provinceId: string, provinceName: string) {
  return {
    OR: [
      { regency: { provinceId } },
      { province: provinceName },
    ],
  };
}
