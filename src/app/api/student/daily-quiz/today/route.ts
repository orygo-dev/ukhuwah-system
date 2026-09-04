import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  countStudentDailyStreak,
  formatJakartaDateLabel,
  getPublishedDailyQuizByDate,
  jakartaDateKey,
} from "@/lib/daily-quiz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya akun siswa yang dapat mengakses quiz harian." },
      { status: 403 }
    );
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true, classRoom: { isActive: true } },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json(
      { error: "Akun siswa belum terhubung ke data siswa." },
      { status: 404 }
    );
  }

  const dateKey = jakartaDateKey();
  const quiz = await getPublishedDailyQuizByDate(dateKey);
  if (!quiz) {
    return NextResponse.json({
      dateKey,
      dateLabel: formatJakartaDateLabel(dateKey),
      quiz: null,
      attempt: null,
      streak: await countStudentDailyStreak(student.id),
    });
  }

  const attempt = await prisma.dailyQuizAttempt.findUnique({
    where: {
      dailyQuizId_studentId: { dailyQuizId: quiz.id, studentId: student.id },
    },
    include: { answers: true },
  });

  return NextResponse.json({
    dateKey,
    dateLabel: formatJakartaDateLabel(dateKey),
    streak: await countStudentDailyStreak(student.id),
    quiz: {
      id: quiz.id,
      title: quiz.title,
      theme: quiz.theme,
      description: quiz.description,
      questionCount: quiz.questionCount,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: Array.isArray(question.options)
          ? question.options.map((option) => String(option))
          : [],
        correctOptionIndex: attempt ? question.correctOptionIndex : null,
        explanation: attempt ? question.explanation : null,
      })),
    },
    attempt: attempt
      ? {
          id: attempt.id,
          score: attempt.score,
          correctCount: attempt.correctCount,
          totalQuestions: attempt.totalQuestions,
          xpEarned: attempt.xpEarned,
          submittedAt: attempt.submittedAt.toISOString(),
          answers: attempt.answers.map((answer) => ({
            questionId: answer.questionId,
            selectedOptionIndex: answer.selectedOptionIndex,
            isCorrect: answer.isCorrect,
          })),
        }
      : null,
  });
}
