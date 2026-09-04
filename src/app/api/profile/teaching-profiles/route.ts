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

const teachingProfileSchema = z.object({
  schoolId: z.string().min(1, "Sekolah wajib dipilih"),
  jenjang: z.string().min(1, "Jenjang wajib dipilih"),
  mapel: z.string().min(1, "Mata pelajaran wajib dipilih"),
  tahunAjaran: z.string().min(1, "Tahun ajaran wajib diisi").optional(),
  semester: z.string().min(1, "Semester wajib dipilih").optional(),
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

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "TEACHER") {
      return forbiddenRoleResponse("Hanya akun guru yang dapat mengakses sekolah mengajar.");
    }

    const existingProfiles = await prisma.teacherSchoolProfile.findMany({
      where: { userId: session.user.id },
      include: TEACHING_PROFILE_INCLUDE,
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({
      profiles: existingProfiles.map(serializeTeachingProfile),
    });
  } catch (err) {
    console.error("[teaching-profiles GET]", err);
    return NextResponse.json(
      { error: "Gagal memuat sekolah mengajar" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat menambah sekolah mengajar.");
  }

  try {
    const body = teachingProfileSchema.parse(await req.json());
    const curriculumError = validateCurriculumSelection(body.jenjang, body.mapel);
    if (curriculumError) {
      return NextResponse.json({ error: curriculumError }, { status: 400 });
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

    const existingCount = await prisma.teacherSchoolProfile.count({
      where: { userId: session.user.id },
    });
    const shouldBePrimary = body.isPrimary || existingCount === 0;

    const created = await prisma.$transaction(async (tx) => {
      if (shouldBePrimary) {
        await tx.teacherSchoolProfile.updateMany({
          where: { userId: session.user.id },
          data: { isPrimary: false },
        });
      }

      const createdProfile = await tx.teacherSchoolProfile.create({
        data: {
          ...teachingProfileFromSchool({
            school,
            jenjang: body.jenjang,
            mapel: body.mapel,
            tahunAjaran: body.tahunAjaran,
            semester: body.semester,
            isPrimary: shouldBePrimary,
          }),
          userId: session.user.id,
        },
        include: TEACHING_PROFILE_INCLUDE,
      });
      if (createdProfile.isPrimary) await syncPrimaryProfileInTransaction(tx, session.user.id, createdProfile.id);
      return createdProfile;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ profile: serializeTeachingProfile(created) }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[teaching-profiles POST]", err);
    return NextResponse.json({ error: "Gagal menyimpan sekolah mengajar" }, { status: 500 });
  }
}
