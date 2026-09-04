import { after, NextResponse } from "next/server";
import { z } from "zod";
import { AssignmentMode, AssignmentStatus, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/attendance";
import { canUseSubjectForClass, getClassRoomForUser } from "@/lib/attendance-access";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";
import { assignmentQuestionDraftSchema, assignmentQuestionInputSchema } from "@/lib/assignment-engine";
import { notifyAssignmentPublished } from "@/lib/assignment-notifications";
import { legacyDateFromDueAt, parseAssignmentDueAt } from "@/lib/assignment-time";
import { normalizeAssignmentOptions } from "@/lib/assignment-engine";
import { validateAssignmentQuestionImages } from "@/lib/assignment-media";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  classRoomId: z.string().min(1, "Kelas wajib dipilih"),
  title: z.string().trim().min(1, "Judul tugas wajib diisi").max(140),
  mapel: z.string().trim().min(1, "Mata pelajaran wajib diisi").max(120),
  description: z.string().trim().min(1, "Instruksi tugas wajib diisi").max(4000),
  dueDate: z.string().regex(DATE_PATTERN, "Format deadline tidak valid").optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Format deadline tidak valid").nullable().optional(),
  status: z.enum([AssignmentStatus.DRAFT, AssignmentStatus.PUBLISHED]).optional(),
  mode: z.nativeEnum(AssignmentMode).optional(),
  allowLate: z.boolean().optional(),
  allowResubmit: z.boolean().optional(),
  questions: z.array(assignmentQuestionDraftSchema).max(100, "Maksimal 100 soal").optional(),
}).superRefine((body, ctx) => {
  if (body.mode === AssignmentMode.QUESTION_SET && body.status !== AssignmentStatus.DRAFT && !body.questions?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tugas terstruktur wajib memiliki minimal satu soal", path: ["questions"] });
  }
  if (body.status !== AssignmentStatus.DRAFT) {
    if (body.mode === AssignmentMode.QUESTION_SET && body.questions && Math.abs(body.questions.reduce((sum, question) => sum + question.points, 0) - 100) > 0.001) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Total bobot soal harus tepat 100 poin", path: ["questions"] });
    }
    body.questions?.forEach((question, index) => {
      const parsed = assignmentQuestionInputSchema.safeParse(question);
      if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.errors[0]?.message || "Soal tidak valid", path: ["questions", index] });
    });
  }
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke daftar tugas guru.");
  }

  const { searchParams } = new URL(req.url);
  const classRoomId = searchParams.get("classRoomId");
  const includeArchived = searchParams.get("includeArchived") === "true";
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

  const assignments = await prisma.assignment.findMany({
    where: {
      ...baseWhere,
      ...(classRoomId ? { classRoomId } : {}),
      ...(includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    },
    orderBy: [{ dueAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      classRoom: { select: { id: true, name: true, jenjang: true } },
      teacher: { select: { id: true, name: true } },
      questions: { orderBy: { sortOrder: "asc" } },
      _count: { select: { submissions: true } },
    },
  });

  return NextResponse.json({ assignments });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat membuat tugas.");
  }

  try {
    const body = createSchema.parse(await req.json().catch(() => null));
    const room = await getClassRoomForUser(body.classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    if (!room.isActive) {
      return NextResponse.json(
        { error: "Kelas sudah dinonaktifkan dan tidak bisa diberi tugas baru." },
        { status: 400 }
      );
    }
    if (!(await canUseSubjectForClass(room, session.user, body.mapel))) {
      return NextResponse.json(
        { error: "Mata pelajaran tidak sesuai jenjang atau penugasan Anda pada kelas ini." },
        { status: 400 }
      );
    }

    const mode = body.mode ?? AssignmentMode.LEGACY_TEXT;
    const questions = mode === AssignmentMode.QUESTION_SET ? body.questions ?? [] : [];
    const maxScore = questions.length
      ? questions.reduce((sum, question) => sum + question.points, 0)
      : 100;
    const status = body.status ?? AssignmentStatus.PUBLISHED;
    if (!validateAssignmentQuestionImages(questions, session.user.id)) {
      return NextResponse.json({ error: "Salah satu gambar soal tidak valid atau bukan milik akun Anda." }, { status: 400 });
    }
    const dueAt = body.dueAt !== undefined
      ? parseAssignmentDueAt(body.dueAt)
      : body.dueDate
        ? parseAssignmentDueAt(`${body.dueDate}T23:59`)
        : null;
    const assignment = await prisma.assignment.create({
      data: {
        classRoomId: body.classRoomId,
        teacherId: session.user.id,
        title: body.title,
        mapel: body.mapel,
        description: body.description,
        dueDate: dueAt ? legacyDateFromDueAt(dueAt) : body.dueDate ? parseDateOnly(body.dueDate) : null,
        dueAt,
        status,
        mode,
        maxScore,
        allowLate: body.allowLate ?? true,
        allowResubmit: body.allowResubmit ?? true,
        publishedAt: status === AssignmentStatus.PUBLISHED ? new Date() : null,
        questions: questions.length
          ? {
              create: questions.map((question, sortOrder) => ({
                type: question.type,
                prompt: question.prompt,
                imageUrl: question.imageUrl || null,
                options: question.type === "TRUE_FALSE"
                  ? ["Benar", "Salah"]
                  : question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE"
                    ? normalizeAssignmentOptions(question.options)
                    : Prisma.JsonNull,
                correctAnswer: question.correctAnswer ?? Prisma.JsonNull,
                points: question.points,
                required: question.required,
                explanation: question.explanation || null,
                sortOrder,
              })),
            }
          : undefined,
      },
      include: {
        classRoom: { select: { id: true, name: true, jenjang: true } },
        teacher: { select: { id: true, name: true } },
        questions: { orderBy: { sortOrder: "asc" } },
        _count: { select: { submissions: true } },
      },
    });

    if (status === AssignmentStatus.PUBLISHED) {
      after(() => notifyAssignmentPublished({
        senderId: session.user.id,
        classRoomId: assignment.classRoom.id,
        assignmentId: assignment.id,
        title: assignment.title,
      }).catch((error) => console.error("[assignment publish notification]", error)));
    }

    return NextResponse.json({ assignment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tugas tidak valid" },
        { status: 400 }
      );
    }
    console.error("[assignments POST]", err);
    return NextResponse.json({ error: "Gagal membuat tugas" }, { status: 500 });
  }
}
