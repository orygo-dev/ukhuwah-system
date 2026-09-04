import { after, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { gradeStructuredAssignment } from "@/lib/assignment-engine";
import { assignmentDeadlineState } from "@/lib/assignment-time";
import { prisma } from "@/lib/prisma";
import { notifyAssignmentResult } from "@/lib/assignment-notifications";
import { assignmentSerializableTransaction } from "@/lib/assignment-transaction";

type Params = { params: Promise<{ id: string }> };

const submitSchema = z.object({
  answer: z.string().trim().max(12000).optional(),
  answers: z.array(z.object({ questionId: z.string().min(1), response: z.unknown() })).max(100).optional(),
  version: z.number().int().positive().optional(),
});

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya akun siswa yang dapat mengumpulkan tugas." },
      { status: 403 }
    );
  }

  const { id } = await params;
  try {
    const body = submitSchema.parse(await req.json().catch(() => null));
    const student = await prisma.student.findFirst({
      where: { userId: session.user.id, isActive: true, classRoom: { isActive: true } },
      select: { id: true, classRoomId: true },
    });
    if (!student) {
      return NextResponse.json(
        { error: "Akun siswa belum terhubung ke data siswa." },
        { status: 404 }
      );
    }

    const assignment = await prisma.assignment.findFirst({
      where: {
        id,
        classRoomId: student.classRoomId,
        status: "PUBLISHED",
      },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
    }

    const existingSubmission = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: student.id,
        },
      },
      select: { id: true, status: true, version: true, answers: { select: { autoGraded: true } } },
    });

    const canRetryAutoGraded = existingSubmission?.status === "GRADED" &&
      assignment.mode === "QUESTION_SET" && assignment.allowResubmit &&
      existingSubmission.answers.length > 0 && existingSubmission.answers.every((answer) => answer.autoGraded);
    if (existingSubmission?.status === "GRADED" && !canRetryAutoGraded) {
      return NextResponse.json(
        { error: "Tugas sudah dinilai dan tidak dapat diperbarui." },
        { status: 409 }
      );
    }

    if (existingSubmission && existingSubmission.status !== "RETURNED" && !assignment.allowResubmit) {
      return NextResponse.json({ error: "Tugas ini hanya dapat dikumpulkan satu kali." }, { status: 409 });
    }

    const deadline = assignmentDeadlineState(assignment);
    const status = deadline.isLate ? "LATE" as const : "SUBMITTED" as const;
    if (!deadline.acceptsSubmission) {
      return NextResponse.json({ error: "Waktu pengumpulan tugas sudah ditutup." }, { status: 409 });
    }
    if (existingSubmission && body.version !== undefined && body.version !== existingSubmission.version) {
      return NextResponse.json({ error: "Jawaban telah berubah. Muat ulang sebelum mengumpulkan kembali." }, { status: 409 });
    }

    let legacyAnswer = body.answer?.trim() ?? "";
    let structuredAnswers: ReturnType<typeof gradeStructuredAssignment>["answers"] = [];
    let autoScore: number | null = null;
    let finalStatus: "SUBMITTED" | "LATE" | "GRADED" = status;
    let gradedAt: Date | null = null;
    if (assignment.mode === "QUESTION_SET") {
      const graded = gradeStructuredAssignment(assignment.questions, body.answers ?? []);
      if (graded.missingRequired.length) {
        return NextResponse.json({ error: "Semua soal wajib harus dijawab." }, { status: 400 });
      }
      structuredAnswers = graded.answers;
      autoScore = graded.autoScore;
      legacyAnswer = `Jawaban terstruktur (${structuredAnswers.length} butir)`;
      if (graded.fullyAutoGraded) {
        finalStatus = "GRADED";
        gradedAt = new Date();
      }
    } else if (!legacyAnswer) {
      return NextResponse.json({ error: "Jawaban tugas wajib diisi" }, { status: 400 });
    }

    const submittedAt = new Date();
    const submission = await assignmentSerializableTransaction(async (tx) => {
      const currentPolicy = await tx.assignment.findUniqueOrThrow({
        where: { id: assignment.id },
        select: { status: true, dueAt: true, dueDate: true, allowLate: true, submissionClosedAt: true },
      });
      const currentDeadline = assignmentDeadlineState({ ...currentPolicy, now: submittedAt });
      if (currentPolicy.status !== "PUBLISHED" || !currentDeadline.acceptsSubmission) {
        throw new Error("ASSIGNMENT_SUBMISSION_CLOSED");
      }
      if (existingSubmission) {
        const changed = await tx.assignmentSubmission.updateMany({
          where: { id: existingSubmission.id, version: existingSubmission.version },
          data: {
            answer: legacyAnswer,
            status: finalStatus,
            submittedAt,
            score: finalStatus === "GRADED" ? autoScore : null,
            autoScore,
            feedback: null,
            gradedAt,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new Error("ASSIGNMENT_SUBMISSION_CONFLICT");
        await tx.assignmentSubmissionAnswer.deleteMany({ where: { submissionId: existingSubmission.id } });
        if (structuredAnswers.length) {
          await tx.assignmentSubmissionAnswer.createMany({
            data: structuredAnswers.map((item) => ({
              submissionId: existingSubmission.id,
              questionId: item.questionId,
              response: item.response as Prisma.InputJsonValue,
              score: item.score,
              autoGraded: item.autoGraded,
            })),
          });
        }
        return tx.assignmentSubmission.findUniqueOrThrow({
          where: { id: existingSubmission.id },
          include: { answers: true },
        });
      }
      return tx.assignmentSubmission.create({
        data: {
          assignmentId: assignment.id,
          studentId: student.id,
          answer: legacyAnswer,
          status: finalStatus,
          submittedAt,
          score: finalStatus === "GRADED" ? autoScore : null,
          autoScore,
          gradedAt,
          answers: structuredAnswers.length
            ? {
                create: structuredAnswers.map((item) => ({
                  questionId: item.questionId,
                  response: item.response as Prisma.InputJsonValue,
                  score: item.score,
                  autoGraded: item.autoGraded,
                })),
              }
            : undefined,
        },
        include: { answers: true },
      });
    });

    if (finalStatus === "GRADED") {
      after(() => notifyAssignmentResult({
        senderId: assignment.teacherId,
        recipientId: session.user.id,
        assignmentId: assignment.id,
        title: assignment.title,
        returned: false,
      }).catch((error) => console.error("[assignment auto-grade notification]", error)));
    }

    return NextResponse.json({ submission });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data jawaban tidak valid" },
        { status: 400 }
      );
    }
    if (err instanceof Error && err.message === "ASSIGNMENT_SUBMISSION_CONFLICT") {
      return NextResponse.json({ error: "Jawaban berubah saat diproses. Muat ulang lalu coba lagi." }, { status: 409 });
    }
    if (err instanceof Error && err.message === "ASSIGNMENT_SUBMISSION_CLOSED") {
      return NextResponse.json({ error: "Pengumpulan tugas ditutup saat jawaban diproses. Jawaban tidak disimpan." }, { status: 409 });
    }
    console.error("[student assignment submission POST]", err);
    return NextResponse.json({ error: "Gagal mengumpulkan tugas" }, { status: 500 });
  }
}
