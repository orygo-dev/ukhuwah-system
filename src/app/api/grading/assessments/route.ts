import { NextResponse } from "next/server";
import { z } from "zod";
import { AssessmentType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseSubjectForClass, getClassRoomForUser } from "@/lib/attendance-access";
import { assessmentWhereForUser } from "@/lib/grading-access";
import { parseDateOnly } from "@/lib/attendance";
import { parseTeacherProfile } from "@/lib/teacher-profile";
import { currentSemester } from "@/lib/semester";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";

const createSchema = z.object({
  classRoomId: z.string().min(1),
  title: z.string().trim().min(1, "Judul penilaian wajib diisi").max(120),
  mapel: z.string().trim().min(1).max(120),
  type: z.nativeEnum(AssessmentType).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxScore: z.number().min(1).max(1000).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke data penilaian guru.");
  }

  const { searchParams } = new URL(req.url);
  const classRoomId = searchParams.get("classRoomId");

  if (classRoomId) {
    const room = await getClassRoomForUser(classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });

  const where = {
    ...assessmentWhereForUser(session.user, user?.schoolId),
    ...(classRoomId ? { classRoomId } : {}),
  };

  const assessments = await prisma.assessment.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      classRoom: { select: { id: true, name: true } },
      _count: { select: { gradeRecords: true } },
      gradeRecords: {
        where: { score: { not: null } },
        select: { id: true },
      },
    },
  });

  const mapped = assessments.map((a) => ({
    ...a,
    gradedCount: a.gradeRecords.length,
    gradeRecords: undefined,
  }));

  return NextResponse.json({ assessments: mapped });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat membuat penilaian.");
  }

  try {
    const body = createSchema.parse(await req.json());
    const room = await getClassRoomForUser(body.classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    if (!room.isActive) {
      return NextResponse.json(
        { error: "Kelas sudah dinonaktifkan dan tidak bisa dipakai untuk penilaian baru." },
        { status: 400 }
      );
    }
    if (!(await canUseSubjectForClass(room, session.user, body.mapel))) {
      return NextResponse.json(
        { error: "Mata pelajaran tidak sesuai jenjang atau penugasan Anda pada kelas ini." },
        { status: 400 }
      );
    }

    const students = await prisma.student.findMany({
      where: { classRoomId: body.classRoomId, isActive: true },
      orderBy: { name: "asc" },
    });

    if (students.length === 0) {
      return NextResponse.json(
        { error: "Belum ada siswa di kelas ini." },
        { status: 400 }
      );
    }

    const existing = await prisma.assessment.findUnique({
      where: {
        classRoomId_title_date_mapel: {
          classRoomId: body.classRoomId,
          title: body.title,
          date: parseDateOnly(body.date),
          mapel: body.mapel,
        },
      },
    });

    if (existing) {
      if (existing.teacherId !== session.user.id) {
        return NextResponse.json(
          {
            error:
              "Penilaian dengan judul, tanggal, dan mapel yang sama sudah dibuat oleh guru lain pada kelas ini.",
          },
          { status: 409 }
        );
      }

      const full = await prisma.assessment.findUnique({
        where: { id: existing.id },
        include: {
          classRoom: { select: { id: true, name: true } },
          gradeRecords: { include: { student: true }, orderBy: { student: { name: "asc" } } },
        },
      });
      return NextResponse.json({ assessment: full, created: false });
    }

    const teacher = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { profileDefaults: true, name: true },
    });
    if (!teacher) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const profile = parseTeacherProfile(teacher);
    const semester = profile.semester || currentSemester();
    const tahunAjaran = profile.tahunAjaran || room.tahunAjaran;

    const assessment = await prisma.assessment.create({
      data: {
        classRoomId: body.classRoomId,
        teacherId: session.user.id,
        title: body.title,
        mapel: body.mapel,
        type: body.type ?? "LAINNYA",
        date: parseDateOnly(body.date),
        semester,
        tahunAjaran,
        maxScore: body.maxScore ?? 100,
        note: body.note?.trim() || null,
        gradeRecords: {
          create: students.map((s) => ({ studentId: s.id, score: null })),
        },
      },
      include: {
        classRoom: { select: { id: true, name: true } },
        gradeRecords: { include: { student: true }, orderBy: { student: { name: "asc" } } },
      },
    });

    return NextResponse.json({ assessment, created: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[grading assessments POST]", err);
    return NextResponse.json({ error: "Gagal membuat penilaian" }, { status: 500 });
  }
}
