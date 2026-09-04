import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { prisma } from "@/lib/prisma";
import { sendNotificationPush } from "@/lib/push-notifications";
import { canModerateStudentSpotlightReports } from "@/lib/student-spotlight-reports";

type Params = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  action: z.enum(["KEEP", "HIDE", "RESTORE", "REMOVE"]),
  note: z.string().trim().max(2000).optional(),
});

const actionMessage = {
  KEEP: "Laporan ditutup dan Zona Kreasi tetap ditayangkan.",
  HIDE: "Zona Kreasi disembunyikan dari seluruh feed siswa.",
  RESTORE: "Zona Kreasi dipulihkan ke feed siswa.",
  REMOVE: "Zona Kreasi dihapus secara aman dari feed siswa.",
} as const;

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canModerateStudentSpotlightReports(session.user.role)) {
    return NextResponse.json(
      { error: "Anda tidak memiliki akses moderasi laporan Zona Kreasi." },
      { status: 403 }
    );
  }

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Tindakan moderasi tidak valid." },
      { status: 400 }
    );
  }
  if (["HIDE", "REMOVE"].includes(parsed.data.action) && !parsed.data.note) {
    return NextResponse.json(
      { error: "Catatan moderator wajib diisi untuk menyembunyikan atau menghapus konten." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const submission = await prisma.studentSpotlightSubmission.findUnique({
    where: { id },
    include: {
      classRoom: true,
      student: { select: { id: true, name: true, userId: true } },
      reports: { where: { status: "OPEN" }, select: { id: true } },
    },
  });
  if (!submission || submission.reports.length === 0) {
    return NextResponse.json(
      { error: "Laporan Zona Kreasi tidak ditemukan atau sudah ditangani." },
      { status: 404 }
    );
  }
  const room = await getClassRoomForUser(submission.classRoomId, session.user);
  if (!room) {
    return NextResponse.json(
      { error: "Laporan Zona Kreasi berada di luar kewenangan Anda." },
      { status: 404 }
    );
  }

  const now = new Date();
  const status =
    parsed.data.action === "KEEP" || parsed.data.action === "RESTORE"
      ? "PUBLISHED"
      : parsed.data.action === "REMOVE"
        ? "REJECTED"
        : "ARCHIVED";
  const reportStatus =
    parsed.data.action === "KEEP" || parsed.data.action === "RESTORE"
      ? "DISMISSED"
      : "ACTIONED";

  const creatorNotificationId = await prisma.$transaction(async (tx) => {
    await tx.studentSpotlightSubmission.update({
      where: { id: submission.id },
      data: {
        status,
        reviewerId: session.user.id,
        reviewedAt: now,
        reviewNote: parsed.data.note || null,
        moderationNote: parsed.data.note || null,
        hiddenByReportsAt: status === "PUBLISHED" ? null : submission.hiddenByReportsAt ?? now,
        publishedAt: status === "PUBLISHED" ? submission.publishedAt ?? now : submission.publishedAt,
      },
    });
    await tx.studentSpotlightReport.updateMany({
      where: { submissionId: submission.id, status: "OPEN" },
      data: {
        status: reportStatus,
        reviewerId: session.user.id,
        reviewedAt: now,
        reviewNote: parsed.data.note || null,
      },
    });

    if (submission.student.userId) {
      const creatorMessage =
        parsed.data.action === "KEEP" || parsed.data.action === "RESTORE"
          ? "Laporan atas Zona Kreasi Anda telah diperiksa dan konten tetap dapat ditampilkan."
          : `Zona Kreasi Anda telah dimoderasi. ${parsed.data.note || "Hubungi guru untuk informasi lebih lanjut."}`;
      const notification = await tx.notification.create({
        data: {
          senderId: session.user.id,
          title: "Pembaruan Moderasi Zona Kreasi",
          message: creatorMessage,
          category: "GENERAL",
          priority: status === "PUBLISHED" ? "NORMAL" : "IMPORTANT",
          status: "PUBLISHED",
          targetType: "ROLE",
          targetRole: "STUDENT",
          targetLabel: submission.student.name,
          actionUrl: "/student/spotlight",
          publishAt: now,
          publishedAt: now,
          recipients: { create: [{ userId: submission.student.userId }] },
        },
        select: { id: true },
      });
      return notification.id;
    }
    return null;
  });

  if (creatorNotificationId) {
    await sendNotificationPush(creatorNotificationId).catch((error) => {
      console.error("[spotlight moderation push]", error);
    });
  }

  return NextResponse.json({ message: actionMessage[parsed.data.action] });
}
