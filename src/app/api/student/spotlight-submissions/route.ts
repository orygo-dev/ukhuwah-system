import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getContentReviewSettings,
  initialStudentContentStatus,
} from "@/lib/content-review";
import { prisma } from "@/lib/prisma";
import {
  isUploadedSpotlightPath,
  studentSpotlightVideoHint,
} from "@/lib/spotlight-video";

const submitSchema = z.object({
  caption: z.string().trim().min(10, "Caption minimal 10 karakter").max(2000),
  videoUrl: z
    .string()
    .trim()
    .refine(isUploadedSpotlightPath, studentSpotlightVideoHint()),
  thumbnailUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || isUploadedSpotlightPath(value),
      "Thumbnail tidak valid."
    ),
  visibility: z.enum(["CLASS", "SCHOOL", "GLOBAL"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya akun siswa yang dapat mengirim Zona Kreasi." },
      { status: 403 }
    );
  }

  try {
    const body = submitSchema.parse(await req.json().catch(() => null));
    const student = await prisma.student.findFirst({
      where: { userId: session.user.id, isActive: true },
      include: { classRoom: { select: { id: true, isActive: true } } },
    });
    if (!student) {
      return NextResponse.json(
        { error: "Akun siswa belum terhubung ke data siswa." },
        { status: 404 }
      );
    }
    if (!student.classRoom.isActive) {
      return NextResponse.json(
        { error: "Kelas sudah tidak aktif dan tidak dapat menerima Zona Kreasi baru." },
        { status: 400 }
      );
    }

    const reviewSettings = await getContentReviewSettings();
    const status = initialStudentContentStatus("spotlight", reviewSettings);
    const publishedAt = status === "PUBLISHED" ? new Date() : null;

    const submission = await prisma.studentSpotlightSubmission.create({
      data: {
        classRoomId: student.classRoomId,
        studentId: student.id,
        caption: body.caption,
        videoUrl: body.videoUrl.trim(),
        thumbnailUrl: body.thumbnailUrl?.trim() || null,
        visibility: body.visibility ?? "GLOBAL",
        status,
        publishedAt,
      },
      include: {
        classRoom: { select: { id: true, name: true, jenjang: true, tahunAjaran: true } },
        student: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      submission,
      reviewEnabled: reviewSettings.spotlight.reviewEnabled,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data Zona Kreasi tidak valid" },
        { status: 400 }
      );
    }
    console.error("[student spotlight submissions POST]", err);
    return NextResponse.json({ error: "Gagal mengirim Zona Kreasi" }, { status: 500 });
  }
}
