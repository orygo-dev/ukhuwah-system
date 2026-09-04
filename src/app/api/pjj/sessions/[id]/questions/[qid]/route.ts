import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess } from "@/lib/pjj";
import { reportPjjApiError } from "@/lib/pjj-api-errors";

type Params = { params: Promise<{ id: string; qid: string }> };

const patchSchema = z.object({
  status: z.enum(["OPEN", "ANSWERED", "DISMISSED"]),
});

export async function PATCH(request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id, qid } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed || access.role === "STUDENT") {
    return NextResponse.json(
      { error: "Hanya guru/moderator yang dapat memperbarui antrean pertanyaan." },
      { status: 403 }
    );
  }

  try {
    const input = patchSchema.parse(await request.json());
    const existing = await prisma.liveClassQuestion.findFirst({
      where: { id: qid, sessionId: id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pertanyaan tidak ditemukan." }, { status: 404 });
    }

    const question = await prisma.liveClassQuestion.update({
      where: { id: qid },
      data: {
        status: input.status,
        answeredAt: input.status === "ANSWERED" ? new Date() : null,
      },
      include: {
        user: { select: { id: true, name: true } },
        student: { select: { id: true, name: true, nis: true } },
      },
    });

    return NextResponse.json({ success: true, question });
  } catch (error) {
    const failure = reportPjjApiError("pjj.questions.update", error, {
      validationMessage: "Data pertanyaan tidak valid.",
      fallbackMessage: "Pertanyaan tidak dapat diperbarui.",
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
