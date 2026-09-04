import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  TEACHING_PROFILE_INCLUDE,
  serializeTeachingProfile,
  teachingProfileFromSchool,
  syncPrimaryProfileInTransaction,
} from "@/lib/teacher-school-profiles";
import {
  parseTeacherProfile,
  serializeTeacherProfile,
  validateTeacherProfile,
} from "@/lib/teacher-profile";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";
import { JENJANG_OPTIONS, getMapelOptions } from "@/lib/curriculum";

type Params = {
  params: Promise<{ id: string }>;
};

const teachingProfileSchema = z.object({
  schoolId: z.string().min(1, "Sekolah wajib dipilih"),
  jenjang: z.string().min(1, "Jenjang wajib dipilih"),
  mapel: z.string().min(1, "Mata pelajaran wajib dipilih"),
  tahunAjaran: z.string().min(1, "Tahun ajaran wajib diisi"),
  semester: z.string().min(1, "Semester wajib dipilih"),
  isPrimary: z.boolean().optional(),
});

function validateCurriculumSelection(jenjang: string, mapel: string) {
  const validJenjang = JENJANG_OPTIONS.some((option) => option.value === jenjang);
  if (!validJenjang) return "Jenjang tidak valid";
  const validMapel = getMapelOptions(jenjang).some((option) => option.value === mapel);
  if (!validMapel) return "Mata pelajaran tidak sesuai jenjang";
  return null;
}

async function syncPrimaryProfile(userId: string, profileId: string) {
  const teachingProfile = await prisma.teacherSchoolProfile.findFirst({
    where: { id: profileId, userId },
    include: TEACHING_PROFILE_INCLUDE,
  });
  if (!teachingProfile) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      nip: true,
      phone: true,
      schoolId: true,
      school: true,
      profileDefaults: true,
    },
  });
  if (!user) return;

  const current = parseTeacherProfile(user);
  const nextProfile = {
    ...current,
    schoolId: teachingProfile.schoolId || "",
    sekolah: teachingProfile.schoolName,
    npsn: teachingProfile.npsn || "",
    alamatSekolah: teachingProfile.address || "",
    kota: teachingProfile.city || "",
    provinsi: teachingProfile.province || "",
    jenjang: teachingProfile.jenjang,
    mapel: teachingProfile.mapel,
    tahunAjaran: teachingProfile.tahunAjaran,
    semester: teachingProfile.semester,
  };
  const validation = validateTeacherProfile(nextProfile);

  await prisma.user.update({
    where: { id: userId },
    data: {
      schoolId: teachingProfile.schoolId,
      profileDefaults: serializeTeacherProfile(nextProfile, validation.complete),
    },
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat mengubah sekolah mengajar.");
  }

  try {
    const { id } = await params;
    const body = teachingProfileSchema.parse(await req.json());
    const curriculumError = validateCurriculumSelection(body.jenjang, body.mapel);
    if (curriculumError) {
      return NextResponse.json({ error: curriculumError }, { status: 400 });
    }

    const existing = await prisma.teacherSchoolProfile.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Profil mengajar tidak ditemukan" }, { status: 404 });
    }

    const school = await prisma.school.findUnique({
      where: { id: body.schoolId },
      include: {
        regency: {
          include: {
            province: true,
          },
        },
      },
    });
    if (!school) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.isPrimary) {
        await tx.teacherSchoolProfile.updateMany({
          where: { userId: session.user.id, id: { not: id } },
          data: { isPrimary: false },
        });
      }

      const updatedProfile = await tx.teacherSchoolProfile.update({
        where: { id },
        data: {
          ...teachingProfileFromSchool({
            school,
            jenjang: body.jenjang,
            mapel: body.mapel,
            tahunAjaran: body.tahunAjaran,
            semester: body.semester,
            isPrimary: body.isPrimary ?? existing.isPrimary,
          }),
          isPrimary: body.isPrimary ?? existing.isPrimary,
        },
        include: TEACHING_PROFILE_INCLUDE,
      });
      if (updatedProfile.isPrimary) await syncPrimaryProfileInTransaction(tx, session.user.id, updatedProfile.id);
      return updatedProfile;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ profile: serializeTeachingProfile(updated) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[teaching-profiles PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui sekolah mengajar" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat menghapus sekolah mengajar.");
  }

  const { id } = await params;
  const existing = await prisma.teacherSchoolProfile.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Profil mengajar tidak ditemukan" }, { status: 404 });
  }

  const remainingPrimary = await prisma.$transaction(async (tx) => {
    await tx.teacherSchoolProfile.delete({ where: { id } });
    if (!existing.isPrimary) return null;

    const nextProfile = await tx.teacherSchoolProfile.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });
    if (!nextProfile) return null;

    await tx.teacherSchoolProfile.update({
      where: { id: nextProfile.id },
      data: { isPrimary: true },
    });
    return nextProfile.id;
  });

  if (remainingPrimary) {
    await syncPrimaryProfile(session.user.id, remainingPrimary);
  } else if (existing.isPrimary) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { schoolId: null, profileDefaults: Prisma.JsonNull },
    });
  }

  return NextResponse.json({ ok: true });
}
