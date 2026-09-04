import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getReadingActor, publishedReadingWhere } from "@/lib/reading";

const schema = z.object({
  bookId: z.string().min(1),
  progressPercent: z.number().int().min(0).max(100),
  currentPage: z.number().int().min(1).max(10000).default(1),
  secondsReadDelta: z.number().int().min(0).max(3600).default(0),
});

export async function POST(req: Request) {
  try {
    const actor = await getReadingActor();
    if (!actor?.studentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const input = schema.parse(await req.json());
    const book = await prisma.readingBook.findFirst({
      where: { id: input.bookId, ...publishedReadingWhere(actor) },
      select: { id: true, pageCount: true },
    });
    if (!book) return NextResponse.json({ error: "Bacaan tidak tersedia" }, { status: 404 });

    const existing = await prisma.readingProgress.findUnique({
      where: { bookId_studentId: { bookId: input.bookId, studentId: actor.studentId } },
      select: { progressPercent: true },
    });
    const progressPercent = Math.max(existing?.progressPercent ?? 0, input.progressPercent);
    const progress = await prisma.readingProgress.upsert({
      where: { bookId_studentId: { bookId: input.bookId, studentId: actor.studentId } },
      create: {
        bookId: input.bookId,
        studentId: actor.studentId,
        progressPercent,
        currentPage: Math.min(input.currentPage, book.pageCount),
        secondsRead: input.secondsReadDelta,
        completedAt: progressPercent === 100 ? new Date() : null,
      },
      update: {
        progressPercent,
        currentPage: Math.min(input.currentPage, book.pageCount),
        secondsRead: { increment: input.secondsReadDelta },
        lastReadAt: new Date(),
        completedAt: progressPercent === 100 ? new Date() : undefined,
      },
    });
    return NextResponse.json({ progress });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Data progres tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menyimpan progres" }, { status: 500 });
  }
}
