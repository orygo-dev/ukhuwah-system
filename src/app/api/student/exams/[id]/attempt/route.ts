import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIndex: z.coerce.number().int().min(0),
});

const attemptSchema = z.object({
  answers: z.array(answerSchema).min(1, "Jawaban ujian wajib diisi"),
});

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya akun siswa yang dapat mengerjakan ujian." },
      { status: 403 }
    );
  }

  const { id } = await params;
  try {
    const body = attemptSchema.parse(await req.json().catch(() => null));
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

    const now = new Date();
    const exam = await prisma.exam.findFirst({
      where: {
        id,
        classRoomId: student.classRoomId,
        status: "PUBLISHED",
        startAt: { lte: now },
        endAt: { gte: now },
      },
      include: {
        questions: { orderBy: { sortOrder: "asc" } },
        attempts: { where: { studentId: student.id }, select: { id: true } },
      },
    });
    if (!exam) {
      return NextResponse.json(
        { error: "Ujian tidak tersedia atau jadwal ujian sudah ditutup." },
        { status: 404 }
      );
    }
    if (exam.attempts.length > 0) {
      return NextResponse.json(
        { error: "Ujian ini sudah pernah dikerjakan." },
        { status: 409 }
      );
    }

    const questionMap = new Map(exam.questions.map((question) => [question.id, question]));
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

    if (uniqueAnswers.size !== exam.questions.length) {
      return NextResponse.json(
        { error: "Semua soal ujian wajib dijawab." },
        { status: 400 }
      );
    }

    let correctCount = 0;
    const answers = exam.questions.map((question) => {
      const selectedOptionIndex = uniqueAnswers.get(question.id) ?? -1;
      const isCorrect = selectedOptionIndex === question.correctOptionIndex;
      if (isCorrect) correctCount += 1;
      return { questionId: question.id, selectedOptionIndex, isCorrect };
    });
    const totalQuestions = exam.questions.length;
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: student.id,
        score,
        correctCount,
        totalQuestions,
        answers: { create: answers },
      },
      include: { answers: true },
    });

    return NextResponse.json({ attempt });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data jawaban ujian tidak valid" },
        { status: 400 }
      );
    }
    console.error("[student exam attempt POST]", err);
    return NextResponse.json({ error: "Gagal menyimpan jawaban ujian" }, { status: 500 });
  }
}
