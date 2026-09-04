import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProvinceAdminScope, schoolWhereForProvince } from "@/lib/province-scope";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("createProgram"),
    name: z.string().trim().min(3).max(160),
    province: z.string().trim().min(3).max(100),
    schoolYear: z.string().trim().min(4).max(20),
    description: z.string().trim().max(3000).optional().default(""),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal("addSchool"),
    programId: z.string().cuid(),
    schoolId: z.string().cuid(),
    role: z.enum(["INDUK", "MITRA"]),
  }),
  z.object({
    action: z.literal("updateProgramStatus"),
    programId: z.string().cuid(),
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]),
  }),
]);

async function requireProvinceUser() {
  const session = await auth();
  return session?.user.role === "PROVINCE_ADMIN" || session?.user.role === "SUPER_ADMIN"
    ? session
    : null;
}
export async function GET() {
  const session = await requireProvinceUser();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const provinceScope =
    session.user.role === "PROVINCE_ADMIN"
      ? await getProvinceAdminScope(session.user.id)
      : null;
  if (session.user.role === "PROVINCE_ADMIN" && !provinceScope) {
    return NextResponse.json(
      { error: "Akun dinas belum ditautkan ke provinsi." },
      { status: 400 }
    );
  }
  const ownerWhere = session.user.role === "SUPER_ADMIN" ? {} : { createdById: session.user.id };
  const schoolLevelFilter = {
    OR: [
      { level: { startsWith: "SMA" } },
      { level: { startsWith: "SMK" } },
      { level: { contains: "SMA" } },
      { level: { contains: "SMK" } },
    ],
  };
  const [programs, schools] = await Promise.all([
    prisma.pjjProgram.findMany({
      where: ownerWhere,
      orderBy: { createdAt: "desc" },
      include: {
        schools: {
          include: {
            school: {
              select: { id: true, name: true, npsn: true, level: true, city: true, province: true },
            },
          },
          orderBy: [{ role: "asc" }, { school: { name: "asc" } }],
        },
        _count: { select: { enrollments: true, classRooms: true } },
        classRooms: {
          select: {
            _count: { select: { liveClassSessions: true } },
            liveClassSessions: {
              select: { participants: { where: { role: "STUDENT" }, select: { attendanceStatus: true } } },
            },
          },
        },
      },
    }),
    prisma.school.findMany({
      where: provinceScope
        ? {
            AND: [
              schoolWhereForProvince(provinceScope.provinceId, provinceScope.provinceName),
              schoolLevelFilter,
            ],
          }
        : schoolLevelFilter,
      orderBy: { name: "asc" },
      select: { id: true, name: true, npsn: true, level: true, city: true, province: true },
    }),
  ]);

  const rows = programs.map((program) => {
    const participants = program.classRooms.flatMap((room) =>
      room.liveClassSessions.flatMap((live) => live.participants)
    );
    return {
      id: program.id,
      name: program.name,
      province: program.province,
      schoolYear: program.schoolYear,
      description: program.description,
      status: program.status,
      startsAt: program.startsAt,
      endsAt: program.endsAt,
      schools: program.schools,
      enrollmentCount: program._count.enrollments,
      classCount: program._count.classRooms,
      sessionCount: program.classRooms.reduce(
        (sum, room) => sum + room._count.liveClassSessions,
        0
      ),
      presentCount: participants.filter((item) =>
        ["PRESENT", "LATE"].includes(item.attendanceStatus)
      ).length,
      participationCount: participants.length,
    };
  });
  return NextResponse.json({ programs: rows, schools });
}

export async function POST(request: Request) {
  const session = await requireProvinceUser();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const provinceScope =
    session.user.role === "PROVINCE_ADMIN"
      ? await getProvinceAdminScope(session.user.id)
      : null;
  if (session.user.role === "PROVINCE_ADMIN" && !provinceScope) {
    return NextResponse.json(
      { error: "Akun dinas belum ditautkan ke provinsi." },
      { status: 400 }
    );
  }
  try {
    const input = actionSchema.parse(await request.json());
    if (input.action === "createProgram") {
      if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
        return NextResponse.json({ error: "Tanggal selesai harus setelah tanggal mulai." }, { status: 400 });
      }
      const provinceName =
        provinceScope?.provinceName ?? input.province;
      const program = await prisma.pjjProgram.create({
        data: {
          name: input.name,
          province: provinceName,
          schoolYear: input.schoolYear,
          description: input.description || null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          createdById: session.user.id,
        },
      });
      return NextResponse.json({ success: true, program });
    }

    const program = await prisma.pjjProgram.findFirst({
      where: {
        id: input.programId,
        ...(session.user.role === "SUPER_ADMIN" ? {} : { createdById: session.user.id }),
      },
      select: { id: true, province: true },
    });
    if (!program) return NextResponse.json({ error: "Program tidak ditemukan." }, { status: 404 });

    if (input.action === "addSchool") {
      const school = await prisma.school.findFirst({
        where: {
          id: input.schoolId,
          AND: [
            {
              OR: [{ level: { startsWith: "SMA" } }, { level: { startsWith: "SMK" } }],
            },
            ...(provinceScope
              ? [schoolWhereForProvince(provinceScope.provinceId, provinceScope.provinceName)]
              : []),
          ],
        },
        select: { id: true },
      });
      if (!school) return NextResponse.json({ error: "Sekolah SMA/SMK tidak ditemukan." }, { status: 404 });
      await prisma.pjjProgramSchool.upsert({
        where: { programId_schoolId: { programId: program.id, schoolId: school.id } },
        create: {
          programId: program.id,
          schoolId: school.id,
          role: input.role,
          isApproved: true,
          approvedAt: new Date(),
        },
        update: { role: input.role, isApproved: true, approvedAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    await prisma.pjjProgram.update({
      where: { id: program.id },
      data: { status: input.status },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors[0]?.message || "Data PJJ tidak valid."
        : error instanceof Error
          ? error.message
          : "Operasi PJJ gagal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
