import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManagePjjClass } from "@/lib/pjj";
import { getProvinceAdminScope } from "@/lib/province-scope";

const createSchema = z.object({
  studentId: z.string().cuid(),
  category: z.string().trim().min(2).max(80),
  note: z.string().trim().min(3).max(4000),
  followUpAt: z.string().datetime().optional().nullable(),
});

async function assertCanAccessStudent(
  actor: {
    id: string;
    role: string;
    schoolId?: string | null;
  },
  studentId: string
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      classRoomId: true,
      classRoom: {
        select: {
          id: true,
          schoolId: true,
          deliveryMode: true,
          teacherId: true,
        },
      },
    },
  });
  if (!student) return null;

  if (actor.role === "SUPER_ADMIN") {
    return student;
  }
  if (actor.role === "PROVINCE_ADMIN") {
    const schoolId = student.classRoom.schoolId;
    const scope = await getProvinceAdminScope(actor.id);
    if (schoolId && scope?.schoolIds.includes(schoolId)) {
      return student;
    }
    return null;
  }
  if (actor.role === "SCHOOL_ADMIN" && actor.schoolId && student.classRoom.schoolId === actor.schoolId) {
    return student;
  }
  if (actor.role === "TEACHER") {
    if (await canManagePjjClass(actor.id, student.classRoomId)) {
      return student;
    }
  }
  return null;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !["TEACHER", "SCHOOL_ADMIN", "PROVINCE_ADMIN", "SUPER_ADMIN"].includes(
      session.user.role
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const classRoomId = url.searchParams.get("classRoomId");
    const studentId = url.searchParams.get("studentId");
    const openOnly = url.searchParams.get("openOnly") === "1";

    const where: Prisma.PjjInterventionWhereInput = {};
    if (openOnly) where.resolvedAt = null;
    if (studentId) where.studentId = studentId;

    if (session.user.role === "TEACHER") {
      if (classRoomId) {
        if (!(await canManagePjjClass(session.user.id, classRoomId))) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        where.student = { classRoomId };
      } else {
        const rooms = await prisma.classRoom.findMany({
          where: {
            deliveryMode: { in: ["PJJ", "HYBRID"] },
            OR: [
              { teacherId: session.user.id },
              {
                teacherAssignments: {
                  some: { teacherId: session.user.id, isActive: true },
                },
              },
            ],
          },
          select: { id: true },
        });
        where.student = { classRoomId: { in: rooms.map((room) => room.id) } };
      }
    } else if (session.user.role === "SCHOOL_ADMIN") {
      if (!session.user.schoolId) {
        return NextResponse.json({ error: "Sekolah belum terhubung" }, { status: 400 });
      }
      where.student = classRoomId
        ? {
            classRoomId,
            classRoom: { schoolId: session.user.schoolId },
          }
        : { classRoom: { schoolId: session.user.schoolId } };
    } else if (session.user.role === "PROVINCE_ADMIN") {
      const scope = await getProvinceAdminScope(session.user.id);
      if (!scope) {
        return NextResponse.json(
          { error: "Akun dinas belum ditautkan ke provinsi." },
          { status: 400 }
        );
      }
      where.student = classRoomId
        ? {
            classRoomId,
            classRoom: { schoolId: { in: scope.schoolIds } },
          }
        : { classRoom: { schoolId: { in: scope.schoolIds } } };
    } else if (classRoomId) {
      where.student = { classRoomId };
    }

    const interventions = await prisma.pjjIntervention.findMany({
      where,
      orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        student: { select: { id: true, name: true, nis: true, classRoomId: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ interventions });
  } catch (error) {
    console.error("[pjj interventions GET]", error);
    const message =
      error instanceof Error ? error.message : "Gagal memuat intervensi PJJ.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !["TEACHER", "SCHOOL_ADMIN", "PROVINCE_ADMIN", "SUPER_ADMIN"].includes(
      session.user.role
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const input = createSchema.parse(await req.json().catch(() => null));
    const student = await assertCanAccessStudent(session.user, input.studentId);
    if (!student) {
      return NextResponse.json(
        { error: "Siswa tidak ditemukan atau di luar kewenangan Anda." },
        { status: 403 }
      );
    }

    const intervention = await prisma.pjjIntervention.create({
      data: {
        studentId: student.id,
        createdById: session.user.id,
        category: input.category,
        note: input.note,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
      },
      include: {
        student: { select: { id: true, name: true, nis: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Mark enrollment at risk when intervention is opened.
    await prisma.pjjEnrollment.updateMany({
      where: {
        studentId: student.id,
        status: { in: ["PENDING", "ACTIVE"] },
      },
      data: { status: "AT_RISK" },
    });

    return NextResponse.json({ success: true, intervention }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Gagal membuat intervensi" }, { status: 500 });
  }
}
