import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getContentReviewSettings,
  initialStudentContentStatus,
} from "@/lib/content-review";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_STUDENT_BOARD_VISIBILITY,
  studentBoardVisibilityClauses,
} from "@/lib/student-board-visibility";

const submitPostSchema = z.object({
  title: z.string().trim().min(3, "Judul karya minimal 3 karakter").max(160),
  category: z.string().trim().min(2, "Kategori wajib diisi").max(80),
  content: z
    .string()
    .trim()
    .min(20, "Isi karya minimal 20 karakter")
    .max(12000),
  imageUrl: z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;
      if (value.includes("..") || value.includes("\\")) return false;
      if (value.startsWith("/uploads/mading/")) return true;
      try {
        const parsed = new URL(value);
        if (!/^https?:$/i.test(parsed.protocol)) return false;
        return (
          parsed.pathname.startsWith("/uploads/mading/") ||
          /^https?:$/i.test(parsed.protocol)
        );
      } catch {
        return false;
      }
    }, "URL gambar tidak valid")
    .optional(),
  visibility: z.enum(["CLASS", "SCHOOL", "GLOBAL"]).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya akun siswa yang dapat membuka mading siswa." },
      { status: 403 },
    );
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: {
      id: true,
      classRoomId: true,
      classRoom: { select: { schoolId: true, isActive: true } },
    },
  });
  if (!student || !student.classRoom.isActive) {
    return NextResponse.json(
      { error: "Akun siswa belum terhubung ke kelas aktif." },
      { status: 404 },
    );
  }

  const posts = await prisma.studentBoardPost.findMany({
    where: {
      status: "PUBLISHED",
      OR: studentBoardVisibilityClauses({
        classRoomId: student.classRoomId,
        schoolId: student.classRoom.schoolId,
      }),
    },
    take: 80,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      student: { select: { id: true, name: true } },
      classRoom: {
        select: {
          id: true,
          name: true,
          school: { select: { id: true, name: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
      likes: {
        where: { userId: session.user.id },
        select: { id: true },
        take: 1,
      },
      bookmarks: {
        where: { userId: session.user.id },
        select: { id: true },
        take: 1,
      },
      reports: {
        where: { reporterId: session.user.id },
        select: { id: true },
        take: 1,
      },
    },
  });
  return NextResponse.json({
    posts: posts.map((post) => ({
      ...post,
      isOwner: post.authorId === session.user.id,
      reportedByMe: post.reports.length > 0,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya akun siswa yang dapat mengirim karya mading." },
      { status: 403 },
    );
  }

  try {
    const body = submitPostSchema.parse(await req.json().catch(() => null));
    const student = await prisma.student.findFirst({
      where: { userId: session.user.id, isActive: true },
      include: {
        classRoom: { select: { id: true, isActive: true, schoolId: true } },
      },
    });
    if (!student) {
      return NextResponse.json(
        { error: "Akun siswa belum terhubung ke data siswa." },
        { status: 404 },
      );
    }
    if (!student.classRoom.isActive) {
      return NextResponse.json(
        {
          error: "Kelas sudah tidak aktif dan tidak dapat menerima karya baru.",
        },
        { status: 400 },
      );
    }

    const reviewSettings = await getContentReviewSettings();
    const status = initialStudentContentStatus("mading", reviewSettings);
    const publishedAt = status === "PUBLISHED" ? new Date() : null;

    const post = await prisma.studentBoardPost.create({
      data: {
        classRoomId: student.classRoomId,
        studentId: student.id,
        authorId: session.user.id,
        title: body.title,
        category: body.category,
        content: body.content,
        imageUrl: body.imageUrl || null,
        visibility: body.visibility ?? DEFAULT_STUDENT_BOARD_VISIBILITY,
        status,
        publishedAt,
      },
      include: {
        classRoom: {
          select: { id: true, name: true, jenjang: true, tahunAjaran: true },
        },
        student: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      post,
      reviewEnabled: reviewSettings.mading.reviewEnabled,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data karya tidak valid" },
        { status: 400 },
      );
    }
    console.error("[student board posts POST]", err);
    return NextResponse.json(
      { error: "Gagal mengirim karya mading" },
      { status: 500 },
    );
  }
}
