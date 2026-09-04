import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlanEntitlements } from "@/lib/plan-limits";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";
import { isCanonicalJenjang } from "@/lib/curriculum";
import { getAllowedSubjectsForClass } from "@/lib/attendance-access";

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama kelas wajib diisi").max(80),
  jenjang: z.string().trim().refine(isCanonicalJenjang, "Jenjang tidak valid"),
  tahunAjaran: z.string().trim().min(1).max(20),
  teacherId: z.string().trim().min(1).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke data kelas guru.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });

  const where =
    session.user.role === "SUPER_ADMIN"
      ? {}
      : session.user.role === "SCHOOL_ADMIN" && user?.schoolId
        ? { schoolId: user.schoolId }
        : {
            OR: [
              { teacherId: session.user.id },
              {
                teacherAssignments: {
                  some: { teacherId: session.user.id, isActive: true },
                },
              },
            ],
          };

  const classes = await prisma.classRoom.findMany({
    where: { ...where, isActive: true },
    orderBy: { name: "asc" },
    include: {
      teacher: { select: { id: true, name: true } },
      _count: {
        select: {
          students: { where: { isActive: true } },
          sessions: true,
        },
      },
    },
  });

  const enrichedClasses = await Promise.all(
    classes.map(async (room) => ({
      ...room,
      allowedSubjects:
        session.user.role === "TEACHER"
          ? await getAllowedSubjectsForClass(room, session.user)
          : null,
    }))
  );

  return NextResponse.json({ classes: enrichedClasses });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak dapat membuat kelas.");
  }

  try {
    const body = createSchema.parse(await req.json().catch(() => null));
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { schoolId: true, profileDefaults: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (session.user.role === "TEACHER") {
      const { entitlements } = await getUserPlanEntitlements(session.user.id);
      if (entitlements.maxClasses !== null) {
        const totalClasses = await prisma.classRoom.count({
          where: { teacherId: session.user.id, isActive: true },
        });
        if (totalClasses >= entitlements.maxClasses) {
          return NextResponse.json(
            {
              error: "Quota kelas pada paket langganan Anda sudah habis.",
              code: "CLASS_LIMIT_REACHED",
            },
            { status: 429 }
          );
        }
      }
    }
    const ownerTeacherId =
      session.user.role === "SCHOOL_ADMIN" && body.teacherId
        ? body.teacherId
        : session.user.id;

    if (session.user.role === "SCHOOL_ADMIN") {
      if (!user.schoolId) {
        return NextResponse.json(
          { error: "Akun admin sekolah belum terhubung ke sekolah." },
          { status: 400 }
        );
      }
      if (!body.teacherId) {
        return NextResponse.json(
          { error: "Pilih guru pengelola kelas terlebih dahulu." },
          { status: 400 }
        );
      }
      const teacher = await prisma.user.findFirst({
        where: {
          id: body.teacherId,
          role: "TEACHER",
          schoolId: user.schoolId,
        },
        select: { id: true },
      });
      if (!teacher) {
        return NextResponse.json(
          { error: "Guru pengelola tidak ditemukan di sekolah ini." },
          { status: 404 }
        );
      }
    }

    if (user.schoolId) {
      const duplicateSchoolClass = await prisma.classRoom.findFirst({
        where: {
          schoolId: user.schoolId,
          name: body.name,
          tahunAjaran: body.tahunAjaran,
          isActive: true,
        },
        select: { id: true },
      });
      if (duplicateSchoolClass) {
        return NextResponse.json(
          { error: "Kelas dengan nama dan tahun ajaran yang sama sudah ada di sekolah ini." },
          { status: 409 }
        );
      }
    }

    const room = await prisma.classRoom.create({
      data: {
        teacherId: ownerTeacherId,
        schoolId: user.schoolId,
        name: body.name,
        jenjang: body.jenjang,
        tahunAjaran: body.tahunAjaran,
      },
      include: {
        _count: { select: { students: true, sessions: true } },
      },
    });

    return NextResponse.json({ classRoom: room });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Kelas dengan nama dan tahun ajaran yang sama sudah ada." },
        { status: 409 }
      );
    }
    console.error("[attendance classes POST]", err);
    return NextResponse.json({ error: "Gagal membuat kelas" }, { status: 500 });
  }
}
