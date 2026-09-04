import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeLiveKitRoom } from "@/lib/livekit";
import { canManagePjjClass, publishPjjClassNotice } from "@/lib/pjj";
import { cancelLiveSessionWithProvider, closeProviderRoomForCancellation } from "@/lib/pjj-session-lifecycle";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
  }),
  z.object({
    action: z.literal("reschedule"),
    title: z.string().trim().min(3).max(160).optional(),
    subject: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(3000).optional(),
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
  }),
]);

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const input = patchSchema.parse(await req.json().catch(() => null));
    const liveSession = await prisma.liveClassSession.findUnique({
      where: { id },
      select: {
        id: true,
        classRoomId: true,
        status: true,
        title: true,
        subject: true,
        description: true,
        attendanceSessionId: true,
        roomName: true,
        actualStart: true,
      },
    });
    if (!liveSession) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }
    if (!(await canManagePjjClass(session.user.id, liveSession.classRoomId))) {
      return NextResponse.json(
        { error: "Anda tidak ditugaskan pada kelas ini." },
        { status: 403 }
      );
    }
    if (liveSession.status === "CANCELLED" && input.action === "cancel") {
      await closeProviderRoomForCancellation(liveSession, closeLiveKitRoom);
      return NextResponse.json({ success: true, session: liveSession, retried: true });
    }
    if (["ENDED", "CANCELLED"].includes(liveSession.status)) {
      return NextResponse.json(
        { error: "Sesi yang sudah selesai atau dibatalkan tidak bisa diubah." },
        { status: 409 }
      );
    }

    if (input.action === "cancel") {
      const updated = await cancelLiveSessionWithProvider(
        liveSession,
        () =>
          prisma.liveClassSession.update({
            where: { id },
            data: { status: "CANCELLED" },
          }),
        closeLiveKitRoom
      );

      try {
        await publishPjjClassNotice({
          senderId: session.user.id,
          classRoomId: liveSession.classRoomId,
          title: `Sesi PJJ dibatalkan: ${updated.title}`,
          message: `Kelas langsung "${updated.title}" (${updated.subject}) telah dibatalkan.`,
          actionUrl: `/student/pjj`,
          priority: "URGENT",
        });
      } catch (notifyError) {
        console.error("[pjj cancel notify]", notifyError);
      }

      return NextResponse.json({ success: true, session: updated });
    }

    const start = new Date(input.scheduledStart);
    const end = new Date(input.scheduledEnd);
    if (end <= start) {
      return NextResponse.json(
        { error: "Waktu selesai harus setelah waktu mulai." },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.liveClassSession.update({
        where: { id },
        data: {
          title: input.title?.trim() || liveSession.title,
          subject: input.subject?.trim() || liveSession.subject,
          description:
            input.description === undefined
              ? liveSession.description
              : input.description.trim() || null,
          scheduledStart: start,
          scheduledEnd: end,
          status: "SCHEDULED",
        },
      });

      if (liveSession.attendanceSessionId) {
        await tx.attendanceSession.update({
          where: { id: liveSession.attendanceSessionId },
          data: {
            date: new Date(
              Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
            ),
            mapel: next.subject,
            note: `Sesi PJJ: ${next.title}`,
          },
        });
      }

      return next;
    });

    try {
      const when = start.toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      await publishPjjClassNotice({
        senderId: session.user.id,
        classRoomId: liveSession.classRoomId,
        title: `Jadwal PJJ diubah: ${updated.title}`,
        message: `Kelas langsung "${updated.title}" (${updated.subject}) dijadwal ulang ke ${when}.`,
        actionUrl: `/student/pjj`,
        priority: "IMPORTANT",
      });
    } catch (notifyError) {
      console.error("[pjj reschedule notify]", notifyError);
    }

    return NextResponse.json({ success: true, session: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[pjj session PATCH]", error);
    return NextResponse.json({ error: "Gagal memperbarui sesi PJJ" }, { status: 500 });
  }
}
