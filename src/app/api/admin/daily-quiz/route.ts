import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createOrReplaceDailyQuiz } from "@/lib/daily-quiz-generate";
import {
  getDailyQuizSettings,
  jakartaDateKey,
  mergeDailyQuizSettings,
  upsertDailyQuizSettings,
} from "@/lib/daily-quiz";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  questionCount: z.coerce.number().int().min(3).max(15),
  themePool: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  level: z.string().trim().min(1).max(80),
});

const generateSchema = z.object({
  action: z.literal("generate"),
  dateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  theme: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(140).optional(),
  publish: z.boolean().optional(),
});

const settingsActionSchema = z.object({
  action: z.literal("settings"),
  settings: settingsSchema,
});

const bodySchema = z.discriminatedUnion("action", [
  generateSchema,
  settingsActionSchema,
]);

export async function GET() {
  try {
    const session = await requireSuperAdmin();
    const todayKey = jakartaDateKey();
    const [settings, quizzes, today] = await Promise.all([
      getDailyQuizSettings(),
      prisma.dailyQuiz.findMany({
        orderBy: { dateKey: "desc" },
        take: 30,
        include: {
          createdBy: { select: { name: true } },
          _count: { select: { attempts: true, questions: true } },
        },
      }),
      prisma.dailyQuiz.findUnique({
        where: { dateKey: todayKey },
        include: {
          questions: { orderBy: { sortOrder: "asc" } },
          _count: { select: { attempts: true, questions: true } },
        },
      }),
    ]);

    return NextResponse.json({
      todayKey,
      settings,
      today,
      quizzes,
      actorId: session.user.id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal memuat quiz harian" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = bodySchema.parse(await req.json().catch(() => null));

    if (body.action === "settings") {
      const settings = await upsertDailyQuizSettings(
        mergeDailyQuizSettings(body.settings)
      );
      return NextResponse.json({
        settings,
        message: "Pengaturan quiz harian disimpan.",
      });
    }

    const { quiz, providerName } = await createOrReplaceDailyQuiz({
      dateKey: body.dateKey,
      theme: body.theme,
      title: body.title,
      publish: body.publish,
      createdById: session.user.id,
      useAi: true,
    });

    return NextResponse.json({
      quiz,
      providerName,
      message: quiz.status === "PUBLISHED"
        ? "Quiz harian nasional berhasil digenerate dan dipublikasikan."
        : "Quiz harian nasional berhasil digenerate (draft).",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    const msg = error instanceof Error ? error.message : "Gagal memproses";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[admin daily-quiz POST]", error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
