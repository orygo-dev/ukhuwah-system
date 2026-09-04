import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SPOTLIGHT_AUTO_HIDE_REPORT_COUNT,
  SPOTLIGHT_DAILY_REPORT_LIMIT,
  STUDENT_SPOTLIGHT_REPORT_REASONS,
} from "@/lib/student-spotlight-reports";

type Params = { params: Promise<{ id: string }> };

const reportSchema = z
  .object({
    reason: z.enum(STUDENT_SPOTLIGHT_REPORT_REASONS),
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
      { error: "Hanya siswa yang dapat melaporkan Zona Kreasi siswa." },
      { status: 403 }
    );
  }

  const parsed = reportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Laporan tidak valid." },
      { status: 400 }
    );
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true, classRoom: { isActive: true } },
    select: {
      id: true,
      classRoomId: true,
      classRoom: { select: { schoolId: true } },
    },
  });
  if (!student) {
    return NextResponse.json(
      { error: "Akun siswa belum terhubung ke kelas aktif." },
      { status: 404 }
    );
  }

  const { id } = await params;
  const schoolVisibility = student.classRoom.schoolId
    ? {
        visibility: "SCHOOL" as const,
        classRoom: { schoolId: student.classRoom.schoolId },
      }
    : { visibility: "SCHOOL" as const, classRoomId: student.classRoomId };
  const submission = await prisma.studentSpotlightSubmission.findFirst({
    where: {
      id,
      status: "PUBLISHED",
      OR: [
        { visibility: "GLOBAL" },
        { visibility: "CLASS", classRoomId: student.classRoomId },
        schoolVisibility,
      ],
    },
    select: {
      id: true,
      studentId: true,
      status: true,
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
  if (!submission) {
    return NextResponse.json(
      { error: "Zona Kreasi tidak ditemukan atau sudah tidak ditayangkan." },
      { status: 404 }
    );
  }
  if (submission.studentId === student.id) {
    return NextResponse.json(
      { error: "Anda tidak dapat melaporkan Zona Kreasi milik sendiri." },
      { status: 400 }
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyReports = await prisma.studentSpotlightReport.count({
    where: { reporterId: session.user.id, createdAt: { gte: since } },
  });
  if (dailyReports >= SPOTLIGHT_DAILY_REPORT_LIMIT) {
    return NextResponse.json(
      { error: "Batas laporan harian tercapai. Coba lagi besok." },
      { status: 429 }
    );
  }

  const schoolAdmins = submission.classRoom.schoolId
    ? await prisma.user.findMany({
        where: {
          schoolId: submission.classRoom.schoolId,
          role: "SCHOOL_ADMIN",
        },
        select: { id: true },
      })
    : [];
  const moderatorIds = Array.from(
    new Set([
      submission.classRoom.teacherId,
      ...submission.classRoom.teacherAssignments.map((assignment) => assignment.teacherId),
      ...schoolAdmins.map((admin) => admin.id),
    ])
  ).filter((userId) => userId !== session.user.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.studentSpotlightReport.create({
        data: {
          submissionId: submission.id,
          reporterId: session.user.id,
          reason: parsed.data.reason,
          details: parsed.data.details || null,
        },
      });
      const reportCount = await tx.studentSpotlightReport.count({
        where: { submissionId: submission.id, status: "OPEN" },
      });
      const shouldHide = reportCount >= SPOTLIGHT_AUTO_HIDE_REPORT_COUNT;
      if (shouldHide) {
        await tx.studentSpotlightSubmission.updateMany({
          where: { id: submission.id, status: "PUBLISHED" },
          data: { status: "ARCHIVED", hiddenByReportsAt: new Date() },
        });
      }
      if (reportCount === 1 && moderatorIds.length > 0) {
        const now = new Date();
        await tx.notification.create({
          data: {
            senderId: session.user.id,
            title: "Laporan Zona Kreasi baru",
            message: `Sebuah Zona Kreasi dari ${submission.classRoom.name} dilaporkan dan perlu diperiksa.`,
            category: "GENERAL",
            priority: "IMPORTANT",
            status: "PUBLISHED",
            targetType: "CLASS",
            classRoomId: submission.classRoom.id,
            targetLabel: submission.classRoom.name,
            actionUrl: "/dashboard/spotlight-siswa",
            publishAt: now,
            publishedAt: now,
            recipients: {
              create: moderatorIds.map((userId) => ({ userId })),
            },
          },
        });
      }
      return { reportCount, hidden: shouldHide };
    });

    return NextResponse.json(
      {
        message: result.hidden
          ? "Laporan diterima. Konten sementara disembunyikan untuk diperiksa moderator."
          : "Laporan diterima dan akan diperiksa moderator.",
        ...result,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Anda sudah melaporkan Zona Kreasi ini." },
        { status: 409 }
      );
    }
    console.error("[student spotlight report POST]", error);
    return NextResponse.json(
      { error: "Laporan belum dapat dikirim. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
