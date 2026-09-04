import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess } from "@/lib/pjj";
import { reportPjjApiError } from "@/lib/pjj-api-errors";
import { findActiveLiveQuiz, serializeQuizForViewer } from "@/lib/pjj-live-quiz";

type Params = { params: Promise<{ id: string; quizId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id, quizId } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
  }

  const quiz = await prisma.liveClassQuiz.findFirst({
    where: { id: quizId, sessionId: id },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      _count: { select: { attempts: true } },
    },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Kuis tidak ditemukan." }, { status: 404 });
  }

  const isModerator = access.role !== "STUDENT";
  const includeAnswerKey = isModerator || quiz.status === "CLOSED";
  let myAttempt = null;
  if (access.studentId) {
    myAttempt = await prisma.liveClassQuizAttempt.findUnique({
      where: {
        quizId_studentId: { quizId: quiz.id, studentId: access.studentId },
      },
      include: { answers: true },
    });
  }

  return NextResponse.json({
    quiz: {
      ...serializeQuizForViewer(quiz, { includeAnswerKey }),
      submittedCount: quiz._count.attempts,
      myAttempt,
    },
  });
}

export async function POST(request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id, quizId } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed || access.role === "STUDENT") {
    return NextResponse.json(
      { error: "Hanya guru/moderator yang dapat mengatur kuis." },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const action = body.action;
    if (action !== "launch" && action !== "close") {
      return NextResponse.json({ error: "Action harus launch atau close." }, { status: 400 });
    }

    const quiz = await prisma.liveClassQuiz.findFirst({
      where: { id: quizId, sessionId: id },
      include: { questions: true },
    });
    if (!quiz) {
      return NextResponse.json({ error: "Kuis tidak ditemukan." }, { status: 404 });
    }
    if (quiz.questions.length === 0) {
      return NextResponse.json({ error: "Kuis belum punya soal." }, { status: 400 });
    }

    if (action === "launch") {
      if (quiz.status !== "DRAFT" && quiz.status !== "CLOSED") {
        return NextResponse.json({ error: "Kuis sudah live." }, { status: 409 });
      }
      const active = await findActiveLiveQuiz(id);
      if (active && active.id !== quiz.id) {
        return NextResponse.json(
          { error: "Sudah ada kuis live aktif. Tutup dulu sebelum meluncurkan yang baru." },
          { status: 409 }
        );
      }
      const updated = await prisma.liveClassQuiz.update({
        where: { id: quiz.id },
        data: {
          status: "LIVE",
          launchedAt: new Date(),
          closedAt: null,
        },
        include: { questions: { orderBy: { sortOrder: "asc" } } },
      });
      return NextResponse.json({
        success: true,
        quiz: serializeQuizForViewer(updated, { includeAnswerKey: true }),
      });
    }

    if (quiz.status !== "LIVE") {
      return NextResponse.json({ error: "Kuis tidak sedang live." }, { status: 409 });
    }
    const updated = await prisma.liveClassQuiz.update({
      where: { id: quiz.id },
      data: { status: "CLOSED", closedAt: new Date() },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({
      success: true,
      quiz: serializeQuizForViewer(updated, { includeAnswerKey: true }),
    });
  } catch (error) {
    const failure = reportPjjApiError("pjj.quizzes.action", error, {
      validationMessage: "Aksi kuis tidak valid.",
      fallbackMessage: "Gagal mengubah status kuis.",
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
