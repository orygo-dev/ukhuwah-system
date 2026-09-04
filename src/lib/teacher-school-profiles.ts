import type { Prisma } from "@prisma/client";
import {
  currentTahunAjaran,
  parseTeacherProfile,
  serializeTeacherProfile,
  validateTeacherProfile,
  type TeacherProfile,
} from "@/lib/teacher-profile";

export type TeachingProfilePayload = {
  schoolId: string;
  jenjang: string;
  mapel: string;
  tahunAjaran?: string;
  semester?: string;
  isPrimary?: boolean;
};

export const TEACHING_PROFILE_INCLUDE = {
  school: {
    include: {
      regency: {
        include: {
          province: true,
        },
      },
    },
  },
} satisfies Prisma.TeacherSchoolProfileInclude;

export async function syncPrimaryProfileInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  profileId: string
) {
  const profile = await tx.teacherSchoolProfile.findFirst({
    where: { id: profileId, userId },
    include: TEACHING_PROFILE_INCLUDE,
  });
  if (!profile) return;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { name: true, nip: true, phone: true, schoolId: true, school: true, profileDefaults: true },
  });
  if (!user) return;
  const current = parseTeacherProfile(user);
  const nextProfile = {
    ...current,
    schoolId: profile.schoolId || "",
    sekolah: profile.schoolName,
    npsn: profile.npsn || "",
    alamatSekolah: profile.address || "",
    kota: profile.city || "",
    provinsi: profile.province || "",
    jenjang: profile.jenjang,
    mapel: profile.mapel,
    tahunAjaran: profile.tahunAjaran,
    semester: profile.semester,
  };
  const validation = validateTeacherProfile(nextProfile);
  await tx.user.update({
    where: { id: userId },
    data: { schoolId: profile.schoolId, profileDefaults: serializeTeacherProfile(nextProfile, validation.complete) },
  });
}

type SchoolWithRegion = Prisma.SchoolGetPayload<{
  include: {
    regency: {
      include: {
        province: true;
      };
    };
  };
}>;

export function teachingProfileFromSchool(args: {
  school: SchoolWithRegion;
  jenjang: string;
  mapel: string;
  tahunAjaran?: string;
  semester?: string;
  isPrimary?: boolean;
}): Omit<Prisma.TeacherSchoolProfileUncheckedCreateInput, "userId"> {
  const { school } = args;
  return {
    schoolId: school.id,
    schoolName: school.name,
    npsn: school.npsn || null,
    address: school.address || null,
    city: school.regency?.name || school.city || null,
    province: school.regency?.province?.name || school.province || null,
    jenjang: args.jenjang,
    mapel: args.mapel,
    tahunAjaran: args.tahunAjaran || currentTahunAjaran(),
    semester: args.semester || "Ganjil",
    isPrimary: Boolean(args.isPrimary),
  };
}

export function serializeTeachingProfile(
  profile: Prisma.TeacherSchoolProfileGetPayload<{
    include: typeof TEACHING_PROFILE_INCLUDE;
  }>
) {
  return {
    id: profile.id,
    schoolId: profile.schoolId,
    schoolName: profile.schoolName,
    npsn: profile.npsn,
    address: profile.address,
    city: profile.city,
    province: profile.province,
    jenjang: profile.jenjang,
    mapel: profile.mapel,
    tahunAjaran: profile.tahunAjaran,
    semester: profile.semester,
    isPrimary: profile.isPrimary,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function teacherProfileToTeachingDefaults(profile: TeacherProfile) {
  if (!profile.sekolah || !profile.jenjang || !profile.mapel) {
    return null;
  }
  return {
    schoolId: profile.schoolId || null,
    schoolName: profile.sekolah,
    npsn: profile.npsn || null,
    address: profile.alamatSekolah || null,
    city: profile.kota || null,
    province: profile.provinsi || null,
    jenjang: profile.jenjang,
    mapel: profile.mapel,
    tahunAjaran: profile.tahunAjaran || currentTahunAjaran(),
    semester: profile.semester || "Ganjil",
    isPrimary: true,
  };
}
