import { NextResponse } from "next/server";
import { StudentBoardPostStatus, StudentBoardVisibility } from "@prisma/client";
import { z } from "zod";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";
import { auth } from "@/lib/auth";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { canReviewContent, getContentReviewSettings } from "@/lib/content-review";
import { prisma } from "@/lib/prisma";
import { DEFAULT_STUDENT_BOARD_VISIBILITY } from "@/lib/student-board-visibility";

const createPostSchema = z.object({
  classRoomId: z.string().min(1, "Kelas wajib dipilih"),
  title: z.string().trim().min(3, "Judul mading minimal 3 karakter").max(160),
  category: z.string().trim().min(2, "Kategori wajib diisi").max(80),
  content: z.string().trim().min(20, "Isi mading minimal 20 karakter").max(12000),
  imageUrl: z.string().trim().url("URL gambar tidak valid").optional().or(z.literal("")),
  visibility: z.nativeEnum(StudentBoardVisibility).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reviewSettings = await getContentReviewSettings();
  // Teachers may still manage their own posts; reviewers use configured roles.
  if (
    !canReviewContent(session.user.role, "mading", reviewSettings) &&
    session.user.role !== "TEACHER"
  ) {
    return forbiddenRoleResponse("Anda tidak memiliki akses manajemen mading.");
  }

  const { searchParams } = new URL(req.url);
  const classRoomId = searchParams.get("classRoomId");
  const status = searchParams.get("status") as StudentBoardPostStatus | null;

  if (classRoomId) {
    const room = await getClassRoomForUser(classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
  }

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });
  const schoolId = account?.schoolId ?? session.user.schoolId ?? null;
  const baseWhere =
    session.user.role === "SUPER_ADMIN"
      ? {}
      : session.user.role === "SCHOOL_ADMIN"
        ? { classRoom: { schoolId: schoolId ?? "__unassigned_school__" } }
        : {
            OR: [
              { authorId: session.user.id },
              { classRoom: { teacherId: session.user.id } },
              {
                classRoom: {
                  teacherAssignments: {
                    some: { teacherId: session.user.id, isActive: true },
                  },
                },
              },
            ],
          };

  const posts = await prisma.studentBoardPost.findMany({
    where: {
      ...baseWhere,
      ...(classRoomId ? { classRoomId } : {}),
      ...(status && status in StudentBoardPostStatus ? { status } : { status: { not: "ARCHIVED" } }),
    },
    take: 80,
    orderBy: [{ updatedAt: "desc" }],
    include: {
      classRoom: {
        select: { id: true, name: true, jenjang: true, tahunAjaran: true, schoolId: true },
      },
      author: { select: { id: true, name: true } },
      student: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      reports: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reason: true,
          details: true,
          createdAt: true,
          reporter: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat membuat mading dari dashboard guru.");
  }

  try {
    const body = createPostSchema.parse(await req.json().catch(() => null));
    const room = await getClassRoomForUser(body.classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    if (!room.isActive) {
      return NextResponse.json(
        { error: "Kelas sudah dinonaktifkan dan tidak bisa diberi mading baru." },
        { status: 400 }
      );
    }

    const status = body.status ?? "PUBLISHED";
    const now = new Date();
    const post = await prisma.studentBoardPost.create({
      data: {
        classRoomId: body.classRoomId,
        authorId: session.user.id,
        title: body.title,
        category: body.category,
        content: body.content,
        imageUrl: body.imageUrl || null,
        visibility: body.visibility ?? DEFAULT_STUDENT_BOARD_VISIBILITY,
        status,
        publishedAt: status === "PUBLISHED" ? now : null,
        reviewedAt: status === "PUBLISHED" ? now : null,
        reviewerId: status === "PUBLISHED" ? session.user.id : null,
      },
      include: {
        classRoom: { select: { id: true, name: true, jenjang: true, tahunAjaran: true } },
        author: { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        reports: {
          select: {
            id: true,
            reason: true,
            details: true,
            createdAt: true,
            reporter: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({ post });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data mading tidak valid" },
        { status: 400 }
      );
    }
    console.error("[student-board posts POST]", err);
    return NextResponse.json({ error: "Gagal membuat mading" }, { status: 500 });
  }
}
