import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess } from "@/lib/pjj";

type Params = { params: Promise<{ id: string; quizId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id, quizId } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed || access.role === "STUDENT") {
    return NextResponse.json(
      { error: "Hanya guru/moderator yang dapat melihat rekap kuis." },
      { status: 403 }
    );
  }

  const quiz = await prisma.liveClassQuiz.findFirst({
    where: { id: quizId, sessionId: id },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      attempts: {
        include: {
          student: { select: { id: true, name: true, nis: true } },
          answers: true,
        },
        orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
      },
    },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Kuis tidak ditemukan." }, { status: 404 });
  }

  const submitted = quiz.attempts.filter((item) => item.status === "SUBMITTED");
  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      status: quiz.status,
      durationSec: quiz.durationSec,
      launchedAt: quiz.launchedAt,
      closedAt: quiz.closedAt,
      questionCount: quiz.questions.length,
    },
    summary: {
      attemptCount: quiz.attempts.length,
      submittedCount: submitted.length,
      averageScore:
        submitted.length === 0
          ? 0
          : Math.round(
              (submitted.reduce((sum, item) => sum + item.score, 0) / submitted.length) * 10
            ) / 10,
    },
    results: quiz.attempts.map((attempt) => ({
      attemptId: attempt.id,
      studentId: attempt.studentId,
      studentName: attempt.student.name,
      nis: attempt.student.nis,
      score: attempt.score,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      answerCount: attempt.answers.length,
    })),
  });
}
