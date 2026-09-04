import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { parseDateOnly, todayDateString } from "@/lib/attendance";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";

const createSchema = z.object({
  classRoomId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mapel: z.string().trim().max(120).optional(),
  jamKe: z.number().int().min(0).max(20).optional(),
  note: z.string().trim().max(500).optional(),
});

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke data absensi guru.");
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || todayDateString();
  const classRoomId = searchParams.get("classRoomId");
  if (!DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });
  const schoolId = user?.schoolId ?? session.user.schoolId ?? null;

  const where: Record<string, unknown> =
    session.user.role === "SUPER_ADMIN"
      ? {}
      : session.user.role === "SCHOOL_ADMIN" && schoolId
        ? { classRoom: { schoolId } }
        : {
            OR: [
              { teacherId: session.user.id },
              {
                classRoom: {
                  teacherAssignments: {
                    some: { teacherId: session.user.id, isActive: true },
                  },
                },
              },
            ],
          };

  where.date = parseDateOnly(date);
  if (classRoomId) {
    const room = await getClassRoomForUser(classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    where.classRoomId = classRoomId;
  }

  const sessions = await prisma.attendanceSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      classRoom: { select: { id: true, name: true } },
      records: true,
      _count: { select: { records: true } },
    },
  });

  return NextResponse.json({ sessions, date });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat membuat sesi absensi.");
  }

  try {
    const body = createSchema.parse(await req.json().catch(() => null));
    const room = await getClassRoomForUser(body.classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    if (!room.isActive) {
      return NextResponse.json(
        { error: "Kelas sudah dinonaktifkan dan tidak bisa dipakai untuk absensi baru." },
        { status: 400 }
      );
    }

    const date = parseDateOnly(body.date || todayDateString());
    const mapel = body.mapel || "";
    const jamKe = body.jamKe ?? 0;

    const students = await prisma.student.findMany({
      where: { classRoomId: body.classRoomId, isActive: true },
      orderBy: { name: "asc" },
    });

    if (students.length === 0) {
      return NextResponse.json(
        { error: "Belum ada siswa di kelas ini. Tambahkan siswa terlebih dahulu." },
        { status: 400 }
      );
    }

    const existing = await prisma.attendanceSession.findUnique({
      where: {
        classRoomId_date_mapel_jamKe: {
          classRoomId: body.classRoomId,
          date,
          mapel,
          jamKe,
        },
      },
    });

    if (existing) {
      if (existing.teacherId !== session.user.id) {
        return NextResponse.json(
          {
            error:
              "Sesi absensi untuk kelas, tanggal, mapel, dan jam ini sudah dibuat oleh guru lain.",
          },
          { status: 409 }
        );
      }

      const full = await prisma.attendanceSession.findUnique({
        where: { id: existing.id },
        include: {
          classRoom: { select: { id: true, name: true } },
          records: { include: { student: true }, orderBy: { student: { name: "asc" } } },
        },
      });
      return NextResponse.json({ session: full, created: false });
    }

    const attendanceSession = await prisma.attendanceSession.create({
      data: {
        classRoomId: body.classRoomId,
        teacherId: session.user.id,
        date,
        mapel,
        jamKe,
        note: body.note?.trim() || null,
        records: {
          create: students.map((s) => ({
            studentId: s.id,
            status: "PRESENT",
          })),
        },
      },
      include: {
        classRoom: { select: { id: true, name: true } },
        records: { include: { student: true }, orderBy: { student: { name: "asc" } } },
      },
    });

    return NextResponse.json({ session: attendanceSession, created: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[attendance sessions POST]", err);
    return NextResponse.json({ error: "Gagal membuat sesi absensi" }, { status: 500 });
  }
}
