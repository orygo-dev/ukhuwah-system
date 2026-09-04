import { NextResponse } from "next/server";
import { z } from "zod";
import { DailyQuizStatus } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.nativeEnum(DailyQuizStatus).optional(),
  title: z.string().trim().min(1).max(140).optional(),
  theme: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(3000).optional().nullable(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const input = patchSchema.parse(await req.json().catch(() => null));

    const existing = await prisma.dailyQuiz.findUnique({
      where: { id },
      select: { id: true, status: true, questionCount: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Quiz tidak ditemukan" }, { status: 404 });
    }
    if (input.status === "PUBLISHED" && existing.questionCount < 1) {
      return NextResponse.json(
        { error: "Quiz tanpa soal tidak bisa dipublikasikan." },
        { status: 400 }
      );
    }

    const quiz = await prisma.dailyQuiz.update({
      where: { id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status
          ? {
              status: input.status,
              publishedAt:
                input.status === "PUBLISHED"
                  ? new Date()
                  : input.status === "DRAFT"
                    ? null
                    : undefined,
            }
          : {}),
      },
      include: {
        _count: { select: { attempts: true, questions: true } },
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ quiz, message: "Quiz harian diperbarui." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    const msg = error instanceof Error ? error.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg || "Gagal memperbarui" }, { status: 400 });
  }
}
