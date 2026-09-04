import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLiveKitJoinToken } from "@/lib/livekit";
import { getLiveSessionAccess } from "@/lib/pjj";
import { liveClassParticipantRosterMutation } from "@/lib/pjj-livekit-token";
import { canPublishMediaForJoin, type PjjRoomMode } from "@/lib/livekit-policy";
import { reportPjjApiError } from "@/lib/pjj-api-errors";

export const runtime = "nodejs";

const bodySchema = z.object({ liveSessionId: z.string().cuid() });

export async function POST(request: Request) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }
  try {
    const { liveSessionId } = bodySchema.parse(await request.json());
    const [liveSession, access] = await Promise.all([
      prisma.liveClassSession.findUnique({
        where: { id: liveSessionId },
        include: { classRoom: { select: { name: true } } },
      }),
      getLiveSessionAccess(userSession, liveSessionId),
    ]);
    if (!liveSession) return NextResponse.json({ error: "Sesi PJJ tidak ditemukan." }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
    if (["CANCELLED", "ENDED"].includes(liveSession.status)) {
      return NextResponse.json({ error: "Sesi PJJ sudah ditutup." }, { status: 409 });
    }
    const now = Date.now();
    const opensAt = liveSession.scheduledStart.getTime() - 30 * 60 * 1000;
    const closesAt = liveSession.scheduledEnd.getTime() + 2 * 60 * 60 * 1000;
    if (userSession.user.role === "STUDENT" && (now < opensAt || now > closesAt)) {
      return NextResponse.json(
        { error: now < opensAt ? "Ruang dibuka 30 menit sebelum jadwal." : "Waktu masuk sesi telah berakhir." },
        { status: 409 }
      );
    }

    const roomMode = (liveSession.roomMode || "MEETING") as PjjRoomMode;
    const existing = await prisma.liveClassParticipant.findUnique({
      where: {
        sessionId_userId: { sessionId: liveSession.id, userId: userSession.user.id },
      },
      select: { canPublishMedia: true },
    });
    const canPublishMedia = canPublishMediaForJoin({
      role: access.role,
      roomMode,
      canPublishMedia: existing?.canPublishMedia,
    });

    await prisma.liveClassParticipant.upsert(
      liveClassParticipantRosterMutation({
        sessionId: liveSession.id,
        userId: userSession.user.id,
        studentId: access.studentId || null,
        role: access.role,
        roomMode,
        canPublishMedia,
      })
    );

    const credentials = await createLiveKitJoinToken({
      identity: `user:${userSession.user.id}`,
      name: userSession.user.name || "Peserta PJJ",
      roomName: liveSession.roomName,
      role: access.role,
      maxParticipants: liveSession.maxParticipants,
      roomMode,
      canPublishMedia,
      metadata: {
        liveSessionId: liveSession.id,
        studentId: access.studentId || null,
        role: access.role,
        roomMode,
        canPublishMedia,
      },
    });
    return NextResponse.json({
      ...credentials,
      roomName: liveSession.roomName,
      title: liveSession.title,
      className: liveSession.classRoom.name,
      role: access.role,
      roomMode,
      canPublishMedia,
    });
  } catch (error) {
    const failure = reportPjjApiError("livekit.token", error, {
      validationMessage: "Permintaan token tidak valid.",
      fallbackMessage: "Token kelas tidak dapat dibuat.",
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
