import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getReadingActor, publishedReadingWhere } from "@/lib/reading";

const schema = z.object({ bookId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const actor = await getReadingActor();
    if (!actor?.studentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { bookId } = schema.parse(await req.json());
    const book = await prisma.readingBook.findFirst({ where: { id: bookId, ...publishedReadingWhere(actor) }, select: { id: true } });
    if (!book) return NextResponse.json({ error: "Bacaan tidak tersedia" }, { status: 404 });
    const existing = await prisma.readingFavorite.findUnique({
      where: { bookId_studentId: { bookId, studentId: actor.studentId } },
    });
    if (existing) {
      await prisma.readingFavorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorite: false });
    }
    await prisma.readingFavorite.create({ data: { bookId, studentId: actor.studentId } });
    return NextResponse.json({ favorite: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    return NextResponse.json({ error: "Gagal mengubah favorit" }, { status: 500 });
  }
}
