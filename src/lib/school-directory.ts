import type { Prisma } from "@prisma/client";

export const SCHOOL_WITH_REGION_INCLUDE = {
  regency: {
    include: {
      province: true,
    },
  },
  _count: {
    select: {
      users: true,
      classRooms: true,
    },
  },
} satisfies Prisma.SchoolInclude;

export type SchoolWithRegion = Prisma.SchoolGetPayload<{
  include: typeof SCHOOL_WITH_REGION_INCLUDE;
}>;

export type ProvinceOption = {
  id: string;
  name: string;
  code: string | null;
};

export type RegencyOption = {
  id: string;
  provinceId: string;
  name: string;
  code: string | null;
  type: string;
  provinceName?: string;
};

export type SchoolOption = {
  id: string;
  regencyId: string | null;
  name: string;
  npsn: string | null;
  level: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  regencyName: string | null;
  provinceId: string | null;
  provinceName: string | null;
  usersCount?: number;
  classRoomsCount?: number;
};

export function serializeProvince(province: {
  id: string;
  name: string;
  code: string | null;
}): ProvinceOption {
  return {
    id: province.id,
    name: province.name,
    code: province.code,
  };
}

export function serializeRegency(regency: {
  id: string;
  provinceId: string;
  name: string;
  code: string | null;
  type: string;
  province?: { name: string } | null;
}): RegencyOption {
  return {
    id: regency.id,
    provinceId: regency.provinceId,
    name: regency.name,
    code: regency.code,
    type: regency.type,
    provinceName: regency.province?.name,
  };
}

export function serializeSchool(school: SchoolWithRegion): SchoolOption {
  const regencyName = school.regency?.name ?? school.city;
  const provinceName = school.regency?.province?.name ?? school.province;

  return {
    id: school.id,
    regencyId: school.regencyId,
    name: school.name,
    npsn: school.npsn,
    level: school.level,
    address: school.address,
    city: regencyName,
    province: provinceName,
    regencyName,
    provinceId: school.regency?.provinceId ?? null,
    provinceName,
    usersCount: school._count?.users,
    classRoomsCount: school._count?.classRooms,
  };
}
