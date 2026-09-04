import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  computeDailyQuizXp,
  countStudentDailyStreak,
  jakartaDateKey,
} from "@/lib/daily-quiz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIndex: z.coerce.number().int().min(0),
});

const attemptSchema = z.object({
  answers: z.array(answerSchema).min(1, "Jawaban quiz wajib diisi"),
});

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya akun siswa yang dapat mengerjakan quiz harian." },
      { status: 403 }
    );
  }

  const { id } = await params;
  try {
    const body = attemptSchema.parse(await req.json().catch(() => null));
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

    const todayKey = jakartaDateKey();
    const quiz = await prisma.dailyQuiz.findFirst({
      where: { id, status: "PUBLISHED", dateKey: todayKey },
      include: {
        questions: { orderBy: { sortOrder: "asc" } },
        attempts: { where: { studentId: student.id }, select: { id: true } },
      },
    });
    if (!quiz) {
      return NextResponse.json(
        { error: "Quiz harian hari ini tidak ditemukan atau sudah berakhir." },
        { status: 404 }
      );
    }
    if (quiz.attempts.length > 0) {
      return NextResponse.json(
        { error: "Kamu sudah mengerjakan quiz hari ini." },
        { status: 409 }
      );
    }

    const questionMap = new Map(quiz.questions.map((question) => [question.id, question]));
    const uniqueAnswers = new Map<string, number>();
    for (const answer of body.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        return NextResponse.json(
          { error: "Jawaban berisi soal yang tidak valid." },
          { status: 400 }
        );
      }
      const options = Array.isArray(question.options) ? question.options : [];
      if (answer.selectedOptionIndex >= options.length) {
        return NextResponse.json(
          { error: "Pilihan jawaban tidak valid." },
          { status: 400 }
        );
      }
      uniqueAnswers.set(answer.questionId, answer.selectedOptionIndex);
    }

    if (uniqueAnswers.size !== quiz.questions.length) {
      return NextResponse.json(
        { error: "Semua soal quiz wajib dijawab." },
        { status: 400 }
      );
    }

    let correctCount = 0;
    const answers = quiz.questions.map((question) => {
      const selectedOptionIndex = uniqueAnswers.get(question.id) ?? -1;
      const isCorrect = selectedOptionIndex === question.correctOptionIndex;
      if (isCorrect) correctCount += 1;
      return {
        questionId: question.id,
        selectedOptionIndex,
        isCorrect,
      };
    });
    const totalQuestions = quiz.questions.length;
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const xpEarned = computeDailyQuizXp(correctCount, totalQuestions);

    const attempt = await prisma.dailyQuizAttempt.create({
      data: {
        dailyQuizId: quiz.id,
        studentId: student.id,
        score,
        correctCount,
        totalQuestions,
        xpEarned,
        answers: { create: answers },
      },
      include: { answers: true },
    });

    return NextResponse.json({
      attempt,
      streak: await countStudentDailyStreak(student.id),
      reviewQuestions: quiz.questions.map((question) => ({
        id: question.id,
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation,
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data jawaban quiz tidak valid" },
        { status: 400 }
      );
    }
    console.error("[student daily-quiz attempt POST]", err);
    return NextResponse.json({ error: "Gagal menyimpan jawaban quiz" }, { status: 500 });
  }
}
