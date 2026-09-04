import { after, NextResponse } from "next/server";
import { AssignmentMode, AssignmentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assignmentQuestionDraftSchema, assignmentQuestionInputSchema, normalizeAssignmentOptions } from "@/lib/assignment-engine";
import { canUseSubjectForClass, getClassRoomForUser } from "@/lib/attendance-access";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";
import { prisma } from "@/lib/prisma";
import { notifyAssignmentPublished } from "@/lib/assignment-notifications";
import { assignmentQuestionImageUrls, deleteAssignmentMediaIfUnreferenced, validateAssignmentQuestionImages } from "@/lib/assignment-media";
import { legacyDateFromDueAt, parseAssignmentDueAt } from "@/lib/assignment-time";
import { assignmentSerializableTransaction } from "@/lib/assignment-transaction";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  mapel: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable().optional(),
  status: z.enum([AssignmentStatus.DRAFT, AssignmentStatus.PUBLISHED, AssignmentStatus.ARCHIVED]).optional(),
  mode: z.nativeEnum(AssignmentMode).optional(),
  allowLate: z.boolean().optional(),
  allowResubmit: z.boolean().optional(),
  submissionClosed: z.boolean().optional(),
  questions: z.array(assignmentQuestionDraftSchema).max(100).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses monitoring tugas.");
  }

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      classRoom: {
        include: {
          students: {
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, nis: true },
          },
        },
      },
      teacher: { select: { id: true, name: true } },
      questions: { orderBy: { sortOrder: "asc" } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        include: {
          student: { select: { id: true, name: true, nis: true } },
          answers: {
            orderBy: { question: { sortOrder: "asc" } },
            include: { question: true },
          },
        },
      },
    },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
  }

  const room = await getClassRoomForUser(assignment.classRoomId, session.user);
  if (!room) {
    return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ assignment });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "TEACHER" && session.user.role !== "SUPER_ADMIN") {
    return forbiddenRoleResponse("Hanya pembuat tugas yang dapat mengubah tugas.");
  }
  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json().catch(() => null));
    const current = await prisma.assignment.findFirst({
      where: { id, ...(session.user.role === "SUPER_ADMIN" ? {} : { teacherId: session.user.id }) },
      include: { questions: { orderBy: { sortOrder: "asc" } }, _count: { select: { submissions: true, questions: true } } },
    });
    if (!current) return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
    if (body.mapel) {
      const room = await getClassRoomForUser(current.classRoomId, session.user);
      if (!room || !(await canUseSubjectForClass(room, session.user, body.mapel))) {
        return NextResponse.json({ error: "Mata pelajaran tidak sesuai kelas atau penugasan Anda." }, { status: 400 });
      }
    }
    if (body.questions && !validateAssignmentQuestionImages(body.questions, current.teacherId)) {
      return NextResponse.json({ error: "Salah satu gambar soal tidak valid atau bukan milik pembuat tugas." }, { status: 400 });
    }
    if ((body.questions || (body.mode && body.mode !== current.mode)) && current._count.submissions > 0) {
      return NextResponse.json(
        { error: "Struktur soal tidak dapat diubah setelah jawaban siswa masuk. Duplikasi tugas untuk membuat revisi." },
        { status: 409 }
      );
    }
    const effectiveMode = body.mode ?? current.mode;
    const nextQuestionCount = effectiveMode === AssignmentMode.LEGACY_TEXT ? 0 : body.questions?.length ?? current._count.questions;
    if ((body.status ?? current.status) === AssignmentStatus.PUBLISHED && effectiveMode === AssignmentMode.QUESTION_SET && nextQuestionCount === 0) {
      return NextResponse.json({ error: "Tugas terstruktur wajib memiliki minimal satu soal" }, { status: 400 });
    }
    if ((body.status ?? current.status) === AssignmentStatus.PUBLISHED && effectiveMode === AssignmentMode.QUESTION_SET) {
      const publishQuestions = body.questions ?? current.questions;
      if (Math.abs(publishQuestions.reduce((sum, question) => sum + question.points, 0) - 100) > 0.001) {
        return NextResponse.json({ error: "Total bobot soal harus tepat 100 poin" }, { status: 400 });
      }
      for (const question of publishQuestions) {
        const parsed = assignmentQuestionInputSchema.safeParse(question);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message || "Soal tidak valid" }, { status: 400 });
      }
    }
    const previousImages = assignmentQuestionImageUrls(current.questions);
    const dueAt = body.dueAt !== undefined
      ? parseAssignmentDueAt(body.dueAt)
      : body.dueDate !== undefined
        ? body.dueDate ? parseAssignmentDueAt(`${body.dueDate}T23:59`) : null
        : undefined;
    const updated = await assignmentSerializableTransaction(async (tx) => {
      if (body.questions || body.mode === AssignmentMode.LEGACY_TEXT) {
        const concurrentSubmissions = await tx.assignmentSubmission.count({
          where: { assignmentId: id },
        });
        if (concurrentSubmissions > 0) {
          throw new Error("ASSIGNMENT_STRUCTURE_LOCKED");
        }
        await tx.assignmentQuestion.deleteMany({ where: { assignmentId: id } });
        if (body.questions?.length && effectiveMode === AssignmentMode.QUESTION_SET) {
          await tx.assignmentQuestion.createMany({
            data: body.questions.map((question, sortOrder) => ({
              assignmentId: id,
              type: question.type,
              prompt: question.prompt,
              imageUrl: question.imageUrl || null,
              options: question.type === "TRUE_FALSE" ? ["Benar", "Salah"] : question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE" ? normalizeAssignmentOptions(question.options) : Prisma.JsonNull,
              correctAnswer: question.correctAnswer ?? Prisma.JsonNull,
              points: question.points,
              required: question.required,
              explanation: question.explanation || null,
              sortOrder,
            })),
          });
        }
      }
      return tx.assignment.update({
        where: { id },
        data: {
          title: body.title,
          mapel: body.mapel,
          description: body.description,
          dueDate: dueAt === null ? null : dueAt ? legacyDateFromDueAt(dueAt) : undefined,
          dueAt,
          status: body.status,
          mode: body.mode,
          publishedAt: body.status === AssignmentStatus.PUBLISHED && !current.publishedAt ? new Date() : undefined,
          allowLate: body.allowLate,
          allowResubmit: body.allowResubmit,
          submissionClosedAt: body.submissionClosed === undefined ? undefined : body.submissionClosed ? new Date() : null,
          maxScore: effectiveMode === AssignmentMode.LEGACY_TEXT ? 100 : body.questions?.length ? body.questions.reduce((sum, question) => sum + question.points, 0) : undefined,
        },
        include: { questions: { orderBy: { sortOrder: "asc" } }, _count: { select: { submissions: true } } },
      });
    });
    if (body.questions || body.mode === AssignmentMode.LEGACY_TEXT) {
      const nextImages = assignmentQuestionImageUrls(body.questions ?? []);
      const removedImages = [...previousImages].filter((url) => !nextImages.has(url));
      after(() => deleteAssignmentMediaIfUnreferenced(removedImages).catch((error) => console.error("[assignment media cleanup]", error)));
    }
    if (body.status === AssignmentStatus.PUBLISHED && current.status !== AssignmentStatus.PUBLISHED) {
      after(() => notifyAssignmentPublished({ senderId: session.user.id, classRoomId: current.classRoomId, assignmentId: current.id, title: updated.title }).catch((error) => console.error("[assignment publish notification]", error)));
    }
    return NextResponse.json({ assignment: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    if (error instanceof Error && error.message === "ASSIGNMENT_STRUCTURE_LOCKED") {
      return NextResponse.json(
        { error: "Jawaban siswa masuk saat tugas diperbarui. Struktur soal tidak diubah; duplikasi tugas untuk membuat revisi." },
        { status: 409 },
      );
    }
    console.error("[assignment PATCH]", error);
    return NextResponse.json({ error: "Gagal memperbarui tugas" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "TEACHER" && session.user.role !== "SUPER_ADMIN") {
    return forbiddenRoleResponse("Hanya pembuat tugas yang dapat menghapus tugas.");
  }
  const { id } = await params;
  const result = await assignmentSerializableTransaction(async (tx) => {
    const current = await tx.assignment.findFirst({
      where: { id, ...(session.user.role === "SUPER_ADMIN" ? {} : { teacherId: session.user.id }) },
      include: { questions: true, _count: { select: { submissions: true } } },
    });
    if (!current) return null;
    if (current._count.submissions > 0) {
      await tx.assignment.update({ where: { id }, data: { status: AssignmentStatus.ARCHIVED } });
      return { archived: true as const, images: [] as string[] };
    }
    const images = [...assignmentQuestionImageUrls(current.questions)];
    await tx.assignment.delete({ where: { id } });
    return { archived: false as const, images };
  });
  if (!result) return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
  if (result.archived) return NextResponse.json({ archived: true });
  after(() => deleteAssignmentMediaIfUnreferenced(result.images).catch((error) => console.error("[assignment delete media cleanup]", error)));
  return NextResponse.json({ deleted: true });
}
