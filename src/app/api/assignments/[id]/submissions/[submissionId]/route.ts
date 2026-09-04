import { after, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAssignmentResult } from "@/lib/assignment-notifications";

type Params = { params: Promise<{ id: string; submissionId: string }> };

const gradeSchema = z.object({
  action: z.enum(["GRADE", "RETURN"]).default("GRADE"),
  score: z.coerce.number().min(0, "Nilai minimal 0").max(1000, "Nilai terlalu besar").optional(),
  feedback: z.string().trim().max(4000, "Feedback terlalu panjang").optional(),
  version: z.number().int().positive().optional(),
  answerScores: z.array(z.object({ answerId: z.string().min(1), score: z.coerce.number().min(0), feedback: z.string().trim().max(2000).optional() })).max(100).optional(),
}).superRefine((body, ctx) => {
  if (body.action === "GRADE" && body.score === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nilai wajib diisi", path: ["score"] });
  }
  if (body.action === "RETURN" && !body.feedback) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Catatan revisi wajib diisi", path: ["feedback"] });
  }
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Hanya guru yang dapat menilai tugas." },
      { status: 403 }
    );
  }

  const { id, submissionId } = await params;
  try {
    const body = gradeSchema.parse(await req.json().catch(() => null));
    const submission = await prisma.assignmentSubmission.findFirst({
      where: {
        id: submissionId,
        assignmentId: id,
        assignment:
          session.user.role === "SUPER_ADMIN" ? undefined : { teacherId: session.user.id },
      },
      select: {
        id: true,
        version: true,
        assignment: { select: { maxScore: true, title: true } },
        student: { select: { userId: true } },
        answers: { select: { id: true, question: { select: { points: true } } } },
      },
    });
    if (!submission) {
      return NextResponse.json({ error: "Jawaban siswa tidak ditemukan" }, { status: 404 });
    }

    if (body.version !== undefined && body.version !== submission.version) {
      return NextResponse.json({ error: "Jawaban siswa telah berubah. Muat ulang sebelum menilai." }, { status: 409 });
    }
    if (body.action === "GRADE" && Number(body.score) > submission.assignment.maxScore) {
      return NextResponse.json({ error: `Nilai maksimal tugas adalah ${submission.assignment.maxScore}` }, { status: 400 });
    }
    const answerById = new Map(submission.answers.map((answer) => [answer.id, answer]));
    if (body.answerScores?.some((answer) => !answerById.has(answer.answerId) || answer.score > answerById.get(answer.answerId)!.question.points)) {
      return NextResponse.json({ error: "Nilai per soal tidak valid" }, { status: 400 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (body.action === "GRADE" && body.answerScores?.length) {
        for (const answer of body.answerScores) {
          await tx.assignmentSubmissionAnswer.update({ where: { id: answer.answerId }, data: { score: answer.score, feedback: answer.feedback || null, autoGraded: false } });
        }
      }
      if (body.action === "GRADE" && submission.answers.length) {
        await tx.assignmentSubmissionAnswer.updateMany({ where: { submissionId: submission.id }, data: { autoGraded: false } });
      }
      const changed = await tx.assignmentSubmission.updateMany({
        where: { id: submission.id, version: submission.version },
        data: body.action === "RETURN"
          ? { score: null, feedback: body.feedback, status: "RETURNED", gradedAt: null, version: { increment: 1 } }
          : { score: body.score, feedback: body.feedback || null, status: "GRADED", gradedAt: new Date(), version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("ASSIGNMENT_GRADE_CONFLICT");
      return tx.assignmentSubmission.findUniqueOrThrow({
        where: { id: submission.id },
        include: { student: { select: { id: true, name: true, nis: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (submission.student.userId) {
      after(() => notifyAssignmentResult({
        senderId: session.user.id,
        recipientId: submission.student.userId!,
        assignmentId: id,
        title: submission.assignment.title,
        returned: body.action === "RETURN",
      }).catch((error) => console.error("[assignment result notification]", error)));
    }

    return NextResponse.json({ submission: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data nilai tidak valid" },
        { status: 400 }
      );
    }
    if (err instanceof Error && err.message === "ASSIGNMENT_GRADE_CONFLICT") {
      return NextResponse.json({ error: "Jawaban berubah saat dinilai. Muat ulang lalu coba lagi." }, { status: 409 });
    }
    console.error("[assignment submission grade PATCH]", err);
    return NextResponse.json({ error: "Gagal menyimpan nilai tugas" }, { status: 500 });
  }
}
