import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { canRevealAssignmentSolutions, publicAssignmentQuestion } from "@/lib/assignment-engine";
import { assignmentDeadlineState, effectiveAssignmentDueAt } from "@/lib/assignment-time";

type Params = { params: Promise<{ kind: string; id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();

  const { kind, id } = await params;
  const student = await prisma.student.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
      classRoom: { isActive: true },
    },
    select: { id: true, classRoomId: true },
  });
  if (!student) {
    return NextResponse.json(
      { error: "Akun siswa belum terhubung ke kelas." },
      { status: 404 }
    );
  }

  if (kind === "assignment") {
    const assignment = await prisma.assignment.findFirst({
      where: { id, classRoomId: student.classRoomId, status: "PUBLISHED" },
      include: {
        teacher: { select: { name: true } },
        questions: { orderBy: { sortOrder: "asc" } },
        submissions: { where: { studentId: student.id }, take: 1, include: { answers: true } },
      },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
    }
    const assignmentSubmission = assignment.submissions[0] ?? null;
    const revealAssignmentSolutions = canRevealAssignmentSolutions({ status: assignmentSubmission?.status, allowResubmit: assignment.allowResubmit, answers: assignmentSubmission?.answers ?? [] });
    const deadline = assignmentDeadlineState(assignment);
    return NextResponse.json({
      kind,
      activity: {
        id: assignment.id,
        title: assignment.title,
        subject: assignment.mapel,
        description: assignment.description,
        teacherName: assignment.teacher.name,
        dueAt: effectiveAssignmentDueAt(assignment)?.toISOString() ?? null,
        mode: assignment.mode,
        maxScore: assignment.maxScore,
        allowLate: assignment.allowLate,
        allowResubmit: assignment.allowResubmit,
        acceptsSubmission: deadline.acceptsSubmission,
        isLate: deadline.isLate,
        submissionClosedAt: assignment.submissionClosedAt?.toISOString() ?? null,
      },
      submission: assignmentSubmission,
      questions: assignment.questions.map((question) => ({
        ...publicAssignmentQuestion(question),
        explanation: revealAssignmentSolutions ? question.explanation : null,
        correctAnswer: revealAssignmentSolutions ? question.correctAnswer : null,
      })),
    });
  }

  if (kind === "quiz") {
    const quiz = await prisma.dailyQuiz.findFirst({
      where: { id, status: "PUBLISHED" },
      include: {
        questions: { orderBy: { sortOrder: "asc" } },
        attempts: {
          where: { studentId: student.id },
          take: 1,
          include: { answers: true },
        },
      },
    });
    if (!quiz) {
      return NextResponse.json({ error: "Quiz harian tidak ditemukan." }, { status: 404 });
    }
    const attempt = quiz.attempts[0] ?? null;
    return NextResponse.json({
      kind,
      activity: {
        id: quiz.id,
        title: quiz.title,
        subject: quiz.theme,
        description: quiz.description,
        teacherName: "Nasional",
        dateKey: quiz.dateKey,
      },
      attempt,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options,
        correctOptionIndex: attempt ? question.correctOptionIndex : null,
        explanation: attempt ? question.explanation : null,
      })),
    });
  }

  if (kind === "exam") {
    const exam = await prisma.exam.findFirst({
      where: { id, classRoomId: student.classRoomId, status: "PUBLISHED" },
      include: {
        teacher: { select: { name: true } },
        questions: { orderBy: { sortOrder: "asc" } },
        attempts: {
          where: { studentId: student.id },
          take: 1,
          include: { answers: true },
        },
      },
    });
    if (!exam) {
      return NextResponse.json({ error: "Ujian tidak ditemukan." }, { status: 404 });
    }
    const attempt = exam.attempts[0] ?? null;
    const now = Date.now();
    return NextResponse.json({
      kind,
      activity: {
        id: exam.id,
        title: exam.title,
        subject: exam.mapel,
        description: exam.instructions,
        teacherName: exam.teacher.name,
        startAt: exam.startAt.toISOString(),
        endAt: exam.endAt.toISOString(),
        durationMinutes: exam.durationMinutes,
        canSubmit: now >= exam.startAt.getTime() && now <= exam.endAt.getTime(),
      },
      attempt,
      questions: exam.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options,
        correctOptionIndex: attempt ? question.correctOptionIndex : null,
        explanation: attempt ? question.explanation : null,
      })),
    });
  }

  return NextResponse.json({ error: "Jenis aktivitas tidak valid." }, { status: 400 });
}
