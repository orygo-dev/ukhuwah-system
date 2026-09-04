import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  allowedReadingStatus,
  createReadingSlug,
  getReadingActor,
  publishedReadingWhere,
} from "@/lib/reading";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

const safeUrl = z
  .string()
  .trim()
  .max(3000)
  .refine((value) => {
    if (!value) return true;
    if (value.includes("..") || value.includes("\\")) return false;
    if (value.startsWith("/uploads/reading/") || value.startsWith("/api/media/reading/")) return true;
    try {
      const parsed = new URL(value);
      if (!/^https?:$/i.test(parsed.protocol)) return false;
      return (
        parsed.pathname.startsWith("/uploads/reading/") ||
        parsed.pathname.startsWith("/api/media/reading/") ||
        /^https?:$/i.test(parsed.protocol)
      );
    } catch {
      return false;
    }
  }, "URL harus memakai http(s) atau file Zona Baca");

const bookSchema = z.object({
  title: z.string().trim().min(3).max(180),
  authorName: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(2).max(80),
  targetLevel: z.string().trim().min(2).max(50).default("SMA/SMK"),
  coverUrl: safeUrl.optional().default(""),
  contentType: z.enum(["ARTICLE", "PDF", "EXTERNAL_LINK"]),
  contentUrl: safeUrl.optional().default(""),
  contentText: z.string().trim().max(100000).optional().default(""),
  pageCount: z.number().int().min(1).max(10000).default(1),
  estimatedMinutes: z.number().int().min(1).max(1440).default(10),
  licenseName: z.string().trim().max(150).optional().default(""),
  rightsHolder: z.string().trim().max(180).optional().default(""),
  sourceUrl: safeUrl.optional().default(""),
  scope: z.enum(["GLOBAL", "SCHOOL", "CLASS"]),
  classRoomId: z.string().trim().optional().nullable(),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED"]).default("DRAFT"),
});

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.errors[0]?.message || "Data tidak valid" }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Gagal memproses data";
  return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 500 });
}

export async function GET() {
  const actor = await getReadingActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const where =
    actor.role === "STUDENT"
      ? { status: "PUBLISHED" as const }
      : actor.role === "SUPER_ADMIN"
        ? { status: { not: "ARCHIVED" as const } }
        : actor.role === "SCHOOL_ADMIN"
          ? { schoolId: actor.schoolId ?? "__none__", status: { not: "ARCHIVED" as const } }
          : { OR: [{ createdById: actor.id }, publishedReadingWhere(actor)], status: { not: "ARCHIVED" as const } };
  const books = await prisma.readingBook.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      createdBy: { select: { name: true } },
      school: { select: { name: true } },
      classRoom: { select: { name: true } },
      progress: actor.studentId
        ? {
            where: { studentId: actor.studentId },
            select: { progressPercent: true, currentPage: true, lastReadAt: true },
          }
        : false,
    },
  });
  return NextResponse.json({
    books: books.map((book) => ({
      ...book,
      coverUrl: book.coverUrl ? toSameOriginUploadUrl(book.coverUrl) : book.coverUrl,
      contentUrl: book.contentUrl ? toSameOriginUploadUrl(book.contentUrl) : book.contentUrl,
      contentText: book.contentType === "ARTICLE" ? book.contentText : null,
      progress: Array.isArray(book.progress) ? book.progress : [],
    })),
  });
}

export async function POST(req: Request) {
  try {
    const actor = await getReadingActor();
    if (!actor || !["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const input = bookSchema.parse(await req.json());
    if (actor.role === "TEACHER" && input.scope === "GLOBAL") throw new Error("FORBIDDEN");
    if (actor.role === "SCHOOL_ADMIN" && input.scope !== "SCHOOL") throw new Error("FORBIDDEN");
    if (input.scope === "CLASS" && !input.classRoomId) {
      return NextResponse.json({ error: "Kelas wajib dipilih" }, { status: 400 });
    }
    if (input.contentType === "ARTICLE" && !input.contentText) {
      return NextResponse.json({ error: "Isi artikel wajib diisi" }, { status: 400 });
    }
    if (input.contentType !== "ARTICLE" && !input.contentUrl) {
      return NextResponse.json({ error: "URL konten wajib diisi" }, { status: 400 });
    }

    let schoolId = actor.schoolId;
    if (input.scope === "SCHOOL" && !schoolId && actor.role === "TEACHER") {
      const teacherRoom = await prisma.classRoom.findFirst({
        where: {
          schoolId: { not: null },
          OR: [
            { teacherId: actor.id },
            { teacherAssignments: { some: { teacherId: actor.id, isActive: true } } },
          ],
        },
        select: { school: { select: { id: true } } },
      });
      schoolId = teacherRoom?.school?.id ?? null;
    }
    if (input.classRoomId) {
      const room = await prisma.classRoom.findFirst({
        where:
          actor.role === "SUPER_ADMIN"
            ? { id: input.classRoomId }
            : actor.role === "SCHOOL_ADMIN"
              ? { id: input.classRoomId, schoolId: actor.schoolId }
              : { id: input.classRoomId, OR: [{ teacherId: actor.id }, { teacherAssignments: { some: { teacherId: actor.id, isActive: true } } }] },
        select: { school: { select: { id: true } } },
      });
      if (!room) throw new Error("FORBIDDEN");
      schoolId = room.school?.id ?? null;
    }
    if (input.scope === "GLOBAL") schoolId = null;
    if (input.scope === "SCHOOL" && !schoolId) {
      return NextResponse.json({ error: "Akun belum terhubung ke sekolah yang aktif" }, { status: 400 });
    }

    const status = allowedReadingStatus(actor, input.status, input.scope);
    const book = await prisma.readingBook.create({
      data: {
        slug: createReadingSlug(input.title),
        title: input.title,
        authorName: input.authorName,
        description: input.description,
        category: input.category,
        targetLevel: input.targetLevel,
        coverUrl: input.coverUrl ? toSameOriginUploadUrl(input.coverUrl) : null,
        contentType: input.contentType,
        contentUrl: input.contentUrl ? toSameOriginUploadUrl(input.contentUrl) : null,
        contentText: input.contentText || null,
        pageCount: input.pageCount,
        estimatedMinutes: input.estimatedMinutes,
        licenseName: input.licenseName || null,
        rightsHolder: input.rightsHolder || null,
        sourceUrl: input.sourceUrl || null,
        scope: input.scope,
        status,
        schoolId,
        classRoomId: input.scope === "CLASS" ? input.classRoomId : null,
        createdById: actor.id,
        reviewerId: status === "PUBLISHED" ? actor.id : null,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
    });
    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
