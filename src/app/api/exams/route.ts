import { NextResponse } from "next/server";
import { z } from "zod";
import { ExamStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canUseSubjectForClass, getClassRoomForUser } from "@/lib/attendance-access";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";
import { prisma } from "@/lib/prisma";

const optionSchema = z.string().trim().min(1, "Opsi jawaban wajib diisi").max(300);
const questionSchema = z.object({
  prompt: z.string().trim().min(1, "Pertanyaan wajib diisi").max(2000),
  options: z.array(optionSchema).min(2).max(5),
  correctOptionIndex: z.coerce.number().int().min(0),
  explanation: z.string().trim().max(2000).optional(),
});

const createSchema = z.object({
  classRoomId: z.string().min(1, "Kelas wajib dipilih"),
  title: z.string().trim().min(1, "Judul ujian wajib diisi").max(140),
  mapel: z.string().trim().min(1, "Mata pelajaran wajib diisi").max(120),
  instructions: z.string().trim().max(4000).optional(),
  startAt: z.string().datetime("Tanggal mulai ujian tidak valid"),
  endAt: z.string().datetime("Tanggal selesai ujian tidak valid"),
  durationMinutes: z.coerce.number().int().min(5).max(300),
  status: z.nativeEnum(ExamStatus).optional(),
  questions: z.array(questionSchema).min(1, "Minimal 1 soal").max(80),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses daftar ujian guru.");
  }

  const { searchParams } = new URL(req.url);
  const classRoomId = searchParams.get("classRoomId");
  if (classRoomId) {
    const room = await getClassRoomForUser(classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
  }

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });
  const schoolId = account?.schoolId ?? session.user.schoolId ?? null;
  const baseWhere =
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

  const exams = await prisma.exam.findMany({
    where: {
      ...baseWhere,
      ...(classRoomId ? { classRoomId } : {}),
      status: { not: "ARCHIVED" },
    },
    orderBy: { startAt: "desc" },
    include: {
      classRoom: { select: { id: true, name: true, jenjang: true, tahunAjaran: true } },
      teacher: { select: { id: true, name: true } },
      _count: { select: { questions: true, attempts: true } },
    },
  });

  return NextResponse.json({ exams });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat membuat ujian.");
  }

  try {
    const body = createSchema.parse(await req.json().catch(() => null));
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (endAt <= startAt) {
      return NextResponse.json(
        { error: "Tanggal selesai ujian harus setelah tanggal mulai." },
        { status: 400 }
      );
    }
    const invalidQuestion = body.questions.find(
      (question) => question.correctOptionIndex >= question.options.length
    );
    if (invalidQuestion) {
      return NextResponse.json(
        { error: "Kunci jawaban tidak sesuai dengan jumlah opsi." },
        { status: 400 }
      );
    }

    const room = await getClassRoomForUser(body.classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    if (!room.isActive) {
      return NextResponse.json(
        { error: "Kelas sudah dinonaktifkan dan tidak bisa diberi ujian baru." },
        { status: 400 }
      );
    }
    if (!(await canUseSubjectForClass(room, session.user, body.mapel))) {
      return NextResponse.json(
        { error: "Mata pelajaran tidak sesuai jenjang atau penugasan Anda pada kelas ini." },
        { status: 400 }
      );
    }

    const exam = await prisma.exam.create({
      data: {
        classRoomId: body.classRoomId,
        teacherId: session.user.id,
        title: body.title,
        mapel: body.mapel,
        instructions: body.instructions || null,
        startAt,
        endAt,
        durationMinutes: body.durationMinutes,
        status: body.status ?? "PUBLISHED",
        questions: {
          create: body.questions.map((question, index) => ({
            prompt: question.prompt,
            options: question.options,
            correctOptionIndex: question.correctOptionIndex,
            explanation: question.explanation || null,
            sortOrder: index,
          })),
        },
      },
      include: {
        classRoom: { select: { id: true, name: true, jenjang: true, tahunAjaran: true } },
        teacher: { select: { id: true, name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });

    return NextResponse.json({ exam });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data ujian tidak valid" },
        { status: 400 }
      );
    }
    console.error("[exams POST]", err);
    return NextResponse.json({ error: "Gagal membuat ujian" }, { status: 500 });
  }
}
