import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess } from "@/lib/pjj";
import { reportPjjApiError } from "@/lib/pjj-api-errors";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  isHandRaise: z.boolean().optional().default(false),
});

export async function GET(_request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
  }

  const [questions, openCount] = await Promise.all([
    prisma.liveClassQuestion.findMany({
      where: { sessionId: id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { id: true, name: true } },
        student: { select: { id: true, name: true, nis: true } },
      },
      take: 100,
    }),
    prisma.liveClassQuestion.count({ where: { sessionId: id, status: "OPEN" } }),
  ]);

  return NextResponse.json({
    questions,
    openCount,
    viewer: { role: access.role, studentId: access.studentId ?? null },
  });
}

export async function POST(request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
  }

  try {
    const input = createSchema.parse(await request.json());
    const question = await prisma.liveClassQuestion.create({
      data: {
        sessionId: id,
        userId: userSession.user.id,
        studentId: access.studentId ?? null,
        body: input.body,
        isHandRaise: input.isHandRaise,
        status: "OPEN",
      },
      include: {
        user: { select: { id: true, name: true } },
        student: { select: { id: true, name: true, nis: true } },
      },
    });

    return NextResponse.json({ success: true, question });
  } catch (error) {
    const failure = reportPjjApiError("pjj.questions.create", error, {
      validationMessage: "Pertanyaan tidak valid.",
      fallbackMessage: "Pertanyaan tidak dapat dikirim.",
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
