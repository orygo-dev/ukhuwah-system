import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { allowedReadingStatus, canManageReadingBook, getReadingActor } from "@/lib/reading";

const updateSchema = z.object({
  status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"]),
  reviewNote: z.string().trim().max(5000).optional().default(""),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getReadingActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const book = await prisma.readingBook.findUnique({
      where: { id },
      select: { id: true, createdById: true, schoolId: true, scope: true },
    });
    if (!book || !canManageReadingBook(actor, book)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const input = updateSchema.parse(await req.json());
    const status = allowedReadingStatus(actor, input.status, book.scope);
    const updated = await prisma.readingBook.update({
      where: { id },
      data: {
        status,
        reviewNote: input.reviewNote || null,
        reviewerId: ["PUBLISHED", "REJECTED"].includes(status) ? actor.id : undefined,
        publishedAt: status === "PUBLISHED" ? new Date() : status === "DRAFT" ? null : undefined,
      },
    });
    return NextResponse.json({ book: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal memperbarui bacaan" }, { status: 500 });
  }
}
