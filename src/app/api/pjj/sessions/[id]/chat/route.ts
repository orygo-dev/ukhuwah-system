import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { publishServerRoomData } from "@/lib/livekit";
import { getLiveSessionAccess } from "@/lib/pjj";
import { prisma } from "@/lib/prisma";
import { encodeRoomData } from "@/components/pjj/room/live-room-data";
import { readRequestJson } from "@/lib/http-json";

const createSchema = z.object({
  clientMessageId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});

type Params = { params: Promise<{ id: string }> };

function responseMessage(message: {
  id: string;
  body: string;
  createdAt: Date;
  sender: { id: string; name: string };
}) {
  return {
    id: message.id,
    body: message.body,
    senderName: message.sender.name,
    senderIdentity: `user:${message.sender.id}`,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  const { id } = await params;
  const access = await getLiveSessionAccess(session, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
  }
  try {
    const rows = await prisma.liveClassChatMessage.findMany({
      where: { sessionId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
      include: { sender: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ messages: rows.reverse().map(responseMessage) });
  } catch (error) {
    console.error("[pjj chat history]", error);
    return NextResponse.json({ error: "Gagal memuat chat." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  const { id } = await params;
  const access = await getLiveSessionAccess(session, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
  }

  try {
    const raw = await readRequestJson(request);
    if (raw == null) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const input = createSchema.parse(raw);
    const liveSession = await prisma.liveClassSession.findUnique({
      where: { id },
      select: { roomName: true, status: true },
    });
    if (!liveSession || ["ENDED", "CANCELLED"].includes(liveSession.status)) {
      return NextResponse.json({ error: "Sesi chat sudah ditutup." }, { status: 409 });
    }
    const row = await prisma.liveClassChatMessage.upsert({
      where: {
        sessionId_senderId_clientMessageId: {
          sessionId: id,
          senderId: session.user.id,
          clientMessageId: input.clientMessageId,
        },
      },
      create: {
        sessionId: id,
        senderId: session.user.id,
        clientMessageId: input.clientMessageId,
        body: input.body,
      },
      update: {},
      include: { sender: { select: { id: true, name: true } } },
    });
    const message = responseMessage(row);
    try {
      await publishServerRoomData(
        liveSession.roomName,
        encodeRoomData({ type: "chat:persisted", ...message }),
        "pjj.chat"
      );
    } catch (broadcastError) {
      // Persistence is authoritative; a reconnect/history refresh recovers this.
      console.error("[pjj chat broadcast]", broadcastError);
    }
    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors[0]?.message || "Pesan tidak valid."
        : "Gagal mengirim pesan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

