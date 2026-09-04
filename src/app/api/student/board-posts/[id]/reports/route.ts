import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  STUDENT_BOARD_DAILY_REPORT_LIMIT,
  STUDENT_BOARD_REPORT_REASONS,
} from "@/lib/student-board-reports";
import { studentBoardVisibilityClauses } from "@/lib/student-board-visibility";

type Params = { params: Promise<{ id: string }> };

const reportSchema = z
  .object({
    reason: z.enum(STUDENT_BOARD_REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.reason === "OTHER" && (!value.details || value.details.length < 5)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["details"],
        message: "Jelaskan alasan laporan minimal 5 karakter.",
      });
    }
  });

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya siswa yang dapat melaporkan konten mading." },
      { status: 403 },
    );
  }

  const parsed = reportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Laporan tidak valid." },
      { status: 400 },
    );
  }

  const student = await prisma.student.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
      classRoom: { isActive: true },
    },
    select: {
      id: true,
      classRoomId: true,
      classRoom: { select: { schoolId: true } },
    },
  });
  if (!student) {
    return NextResponse.json(
      { error: "Akun siswa belum terhubung ke kelas aktif." },
      { status: 404 },
    );
  }

  const { id } = await params;
  const post = await prisma.studentBoardPost.findFirst({
    where: {
      id,
      status: "PUBLISHED",
      OR: studentBoardVisibilityClauses({
        classRoomId: student.classRoomId,
        schoolId: student.classRoom.schoolId,
      }),
    },
    select: {
      id: true,
      studentId: true,
      authorId: true,
      title: true,
      classRoom: {
        select: {
          id: true,
          name: true,
          teacherId: true,
          schoolId: true,
          teacherAssignments: {
            where: { isActive: true },
            select: { teacherId: true },
          },
        },
      },
    },
  });
  if (!post) {
    return NextResponse.json(
      { error: "Mading tidak ditemukan atau tidak dapat diakses." },
      { status: 404 },
    );
  }
  if (post.studentId === student.id || post.authorId === session.user.id) {
    return NextResponse.json(
      { error: "Anda tidak dapat melaporkan mading milik sendiri." },
      { status: 400 },
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyReports = await prisma.studentBoardPostReport.count({
    where: { reporterId: session.user.id, createdAt: { gte: since } },
  });
  if (dailyReports >= STUDENT_BOARD_DAILY_REPORT_LIMIT) {
    return NextResponse.json(
      { error: "Batas laporan harian tercapai. Coba lagi besok." },
      { status: 429 },
    );
  }

  const schoolAdmins = post.classRoom.schoolId
    ? await prisma.user.findMany({
        where: {
          schoolId: post.classRoom.schoolId,
          role: "SCHOOL_ADMIN",
        },
        select: { id: true },
      })
    : [];
  const moderatorIds = Array.from(
    new Set([
      post.classRoom.teacherId,
      ...post.classRoom.teacherAssignments.map((assignment) => assignment.teacherId),
      ...schoolAdmins.map((admin) => admin.id),
    ]),
  ).filter((userId) => userId !== session.user.id);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.studentBoardPostReport.create({
        data: {
          postId: post.id,
          reporterId: session.user.id,
          reason: parsed.data.reason,
          details: parsed.data.details || null,
        },
      });
      const reportCount = await tx.studentBoardPostReport.count({
        where: { postId: post.id },
      });
      if (reportCount !== 1 || moderatorIds.length === 0) return;
      const now = new Date();
      await tx.notification.create({
        data: {
          senderId: session.user.id,
          title: "Laporan mading baru",
          message: `Mading “${post.title}” dilaporkan dan perlu diperiksa.`,
          category: "GENERAL",
          priority: "IMPORTANT",
          status: "PUBLISHED",
          targetType: "CLASS",
          classRoomId: post.classRoom.id,
          targetLabel: post.classRoom.name,
          actionUrl: "/dashboard/mading",
          publishAt: now,
          publishedAt: now,
          recipients: {
            create: moderatorIds.map((userId) => ({ userId })),
          },
        },
      });
    });

    return NextResponse.json(
      { message: "Laporan diterima dan akan diperiksa moderator." },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Anda sudah melaporkan mading ini." },
        { status: 409 },
      );
    }
    console.error("[student board report POST]", error);
    return NextResponse.json(
      { error: "Laporan belum dapat dikirim. Silakan coba lagi." },
      { status: 500 },
    );
  }
}
