import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  muteAllStudentMicrophones,
  muteParticipantMicrophone,
  removeParticipantFromRoom,
} from "@/lib/livekit";
import { getLiveSessionAccess } from "@/lib/pjj";
import { reportPjjApiError } from "@/lib/pjj-api-errors";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mute"),
    identity: z.string().trim().min(3).max(200),
    muted: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("muteAll"),
  }),
  z.object({
    action: z.literal("remove"),
    identity: z.string().trim().min(3).max(200),
  }),
]);

export async function POST(request: Request, { params }: Params) {
  const userSession = await auth();
  if (!userSession?.user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getLiveSessionAccess(userSession, id);
  if (!access.allowed || access.role === "STUDENT") {
    return NextResponse.json(
      { error: "Hanya guru/moderator yang dapat mengontrol peserta." },
      { status: 403 }
    );
  }

  try {
    const input = bodySchema.parse(await request.json());
    const liveSession = await prisma.liveClassSession.findUnique({
      where: { id },
      select: { id: true, roomName: true },
    });
    if (!liveSession) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }

    const hostIdentity = `user:${userSession.user.id}`;

    if (input.action === "mute") {
      if (input.identity === hostIdentity) {
        return NextResponse.json({ error: "Tidak dapat mem-mute diri sendiri lewat panel ini." }, { status: 400 });
      }
      const result = await muteParticipantMicrophone(
        liveSession.roomName,
        input.identity,
        input.muted
      );
      return NextResponse.json({ success: true, ...result });
    }

    if (input.action === "muteAll") {
      const result = await muteAllStudentMicrophones(liveSession.roomName, [hostIdentity]);
      return NextResponse.json({ success: true, ...result });
    }

    if (input.identity === hostIdentity) {
      return NextResponse.json({ error: "Tidak dapat mengeluarkan diri sendiri." }, { status: 400 });
    }
    await removeParticipantFromRoom(liveSession.roomName, input.identity);
    return NextResponse.json({ success: true, removed: true });
  } catch (error) {
    const failure = reportPjjApiError("pjj.moderate", error, {
      validationMessage: "Permintaan moderasi tidak valid.",
      fallbackMessage: "Moderasi tidak dapat dijalankan.",
    });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
