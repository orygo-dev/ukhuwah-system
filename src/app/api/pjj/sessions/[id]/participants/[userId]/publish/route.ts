import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateParticipantPublishPermission } from "@/lib/livekit";
import { getLiveSessionAccess } from "@/lib/pjj";
import { isPjjModeratorRole, type PjjLiveRole } from "@/lib/livekit-policy";
import { reportPjjApiError } from "@/lib/pjj-api-errors";

type Params = { params: Promise<{ id: string; userId: string }> };

const bodySchema = z.object({
  canPublishMedia: z.boolean(),
});

export async function POST(request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id, userId } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed || access.role === "STUDENT") {
    return NextResponse.json(
      { error: "Hanya guru/moderator yang dapat mengatur publish peserta." },
      { status: 403 }
    );
  }

  try {
    const input = bodySchema.parse(await request.json());
    const liveSession = await prisma.liveClassSession.findUnique({
      where: { id },
      select: { id: true, roomName: true, roomMode: true },
    });
    if (!liveSession) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }
    if (liveSession.roomMode !== "CLASSROOM") {
      return NextResponse.json(
        { error: "Promote/demote hanya berlaku untuk mode classroom." },
        { status: 400 }
      );
    }

    const participant = await prisma.liveClassParticipant.findUnique({
      where: { sessionId_userId: { sessionId: id, userId } },
      select: { id: true, role: true, userId: true },
    });
    if (!participant) {
      return NextResponse.json({ error: "Peserta tidak ditemukan di sesi ini." }, { status: 404 });
    }
    if (isPjjModeratorRole(participant.role as PjjLiveRole)) {
      return NextResponse.json(
        { error: "Hak publish moderator tidak diubah lewat promote." },
        { status: 400 }
      );
    }

    const updated = await prisma.liveClassParticipant.update({
      where: { id: participant.id },
      data: { canPublishMedia: input.canPublishMedia },
      select: {
        userId: true,
        canPublishMedia: true,
        role: true,
        user: { select: { name: true } },
      },
    });

    try {
      await updateParticipantPublishPermission({
        roomName: liveSession.roomName,
        identity: `user:${userId}`,
        canPublish: input.canPublishMedia,
        canModerate: false,
      });
    } catch (liveKitError) {
      // Participant may be offline; DB flag still applies on next token join.
      console.warn("[pjj publish promote] livekit update skipped", liveKitError);
    }

    return NextResponse.json({
      success: true,
      participant: updated,
    });
  } catch (error) {
    const failure = reportPjjApiError("pjj.publish", error, {
      validationMessage: "Permintaan promote tidak valid.",
      fallbackMessage: "Gagal mengubah hak publish peserta.",
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
