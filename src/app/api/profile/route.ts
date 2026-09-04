import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseTeacherProfile,
  serializeTeacherProfile,
  validateTeacherProfile,
  type TeacherProfile,
} from "@/lib/teacher-profile";
import { teacherProfileToTeachingDefaults } from "@/lib/teacher-school-profiles";
import { serializeActiveMembershipPlan } from "@/lib/plan-limits";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";
import { readRequestJson } from "@/lib/http-json";
import { JENJANG_OPTIONS, getMapelOptions } from "@/lib/curriculum";

const profileSchema = z.object({
  namaGuru: z.string().min(1, "Nama guru wajib diisi"),
  nip: z.string().optional(),
  phone: z.string().optional(),
  schoolId: z.string().optional(),
  sekolah: z.string().min(1, "Nama sekolah wajib diisi"),
  npsn: z.string().optional(),
  alamatSekolah: z.string().optional(),
  kota: z.string().optional(),
  provinsi: z.string().optional(),
  jenjang: z.string().min(1, "Jenjang wajib dipilih"),
  mapel: z.string().min(1, "Mata pelajaran wajib dipilih"),
  tahunAjaran: z.string().min(1, "Tahun ajaran wajib diisi"),
  semester: z.string().min(1, "Semester wajib dipilih"),
  kurikulum: z.string().min(1, "Kurikulum wajib dipilih"),
});

function validateCurriculumSelection(jenjang: string, mapel: string) {
  const validJenjang = JENJANG_OPTIONS.some((option) => option.value === jenjang);
  if (!validJenjang) return "Jenjang tidak valid";
  const validMapel = getMapelOptions(jenjang).some((option) => option.value === mapel);
  if (!validMapel) return "Mata pelajaran tidak sesuai jenjang";
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      avatarUrl: true,
      creditsRemaining: true,
      nip: true,
      phone: true,
      planExpiresAt: true,
      plan: { select: { name: true, slug: true } },
      schoolId: true,
      school: {
        select: {
          id: true,
          name: true,
          npsn: true,
          address: true,
          city: true,
          province: true,
          regency: {
            select: {
              name: true,
              province: { select: { name: true } },
            },
          },
        },
      },
      profileDefaults: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profile = parseTeacherProfile(user);
  const validation = validateTeacherProfile(profile);

  return NextResponse.json({
    profile,
    complete: validation.complete,
    missing: validation.missing,
    account: {
      name: user.name,
      avatarUrl: user.avatarUrl,
      creditsRemaining: user.creditsRemaining,
      plan: serializeActiveMembershipPlan(user.plan, user.planExpiresAt),
    },
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat mengubah profil guru.");
  }

  try {
    const raw = await readRequestJson(req);
    if (raw == null) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const parsed = profileSchema.parse(raw) as TeacherProfile;
    const requestedSchoolId = parsed.schoolId?.trim() || null;
    const curriculumError = validateCurriculumSelection(parsed.jenjang, parsed.mapel);
    if (curriculumError) {
      return NextResponse.json({ error: curriculumError }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { schoolId: true },
    });
    // Teachers may bind a school once; changing school later requires Super/School Admin.
    const selectedSchoolId = currentUser?.schoolId || requestedSchoolId;

    if (currentUser?.schoolId && requestedSchoolId && requestedSchoolId !== currentUser.schoolId) {
      return NextResponse.json(
        {
          error:
            "Sekolah akun sudah terhubung dan tidak dapat diganti sendiri. Hubungi Super Admin atau Admin Sekolah.",
        },
        { status: 403 }
      );
    }

    if (selectedSchoolId) {
      const school = await prisma.school.findUnique({
        where: { id: selectedSchoolId },
        include: {
          regency: {
            include: {
              province: true,
            },
          },
        },
      });
      if (!school) {
        return NextResponse.json(
          { error: "Sekolah yang dipilih tidak ditemukan" },
          { status: 400 }
        );
      }
      parsed.schoolId = school.id;
      parsed.sekolah = school.name;
      parsed.npsn = school.npsn || "";
      parsed.alamatSekolah = school.address || "";
      parsed.kota = school.regency?.name || school.city || "";
      parsed.provinsi = school.regency?.province?.name || school.province || "";
    }

    const validation = validateTeacherProfile(parsed);

    const profileDefaults = serializeTeacherProfile(parsed, validation.complete);

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: session.user.id },
        data: {
          name: parsed.namaGuru.trim(),
          nip: parsed.nip?.trim() || null,
          phone: parsed.phone?.trim() || null,
          schoolId: selectedSchoolId,
          profileDefaults,
        },
        select: {
          name: true,
          nip: true,
          phone: true,
          schoolId: true,
          school: {
            select: {
              id: true,
              name: true,
              npsn: true,
              address: true,
              city: true,
              province: true,
              regency: {
                select: {
                  name: true,
                  province: { select: { name: true } },
                },
              },
            },
          },
          profileDefaults: true,
        },
      });

      const teachingDefaults = teacherProfileToTeachingDefaults(parsed);
      if (teachingDefaults) {
        await tx.teacherSchoolProfile.updateMany({
          where: { userId: session.user.id },
          data: { isPrimary: false },
        });
        const existingPrimary = await tx.teacherSchoolProfile.findFirst({
          where: {
            userId: session.user.id,
            schoolId: teachingDefaults.schoolId,
            jenjang: teachingDefaults.jenjang,
            mapel: teachingDefaults.mapel,
            tahunAjaran: teachingDefaults.tahunAjaran,
          },
        });
        if (existingPrimary) {
          await tx.teacherSchoolProfile.update({
            where: { id: existingPrimary.id },
            data: { ...teachingDefaults, isPrimary: true },
          });
        } else {
          await tx.teacherSchoolProfile.create({
            data: {
              ...teachingDefaults,
              userId: session.user.id,
            },
          });
        }
      }

      return updatedUser;
    });

    const profile = parseTeacherProfile(user);

    return NextResponse.json({
      profile,
      complete: validation.complete,
      missing: validation.missing,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[profile PATCH]", err);
    return NextResponse.json({ error: "Gagal menyimpan profil" }, { status: 500 });
  }
}
