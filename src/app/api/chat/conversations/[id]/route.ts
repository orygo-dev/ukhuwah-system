import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assertConversationAccess,
  getConversationRecipientId,
  markConversationRead,
  userAllowsMessages,
} from "@/lib/chat";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";
import { readRequestJson } from "@/lib/http-json";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Pesan guru hanya tersedia untuk akun guru.");
  }

  const { id } = await params;
  try {
    await assertConversationAccess(id, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    messages: messages.reverse().map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      senderId: m.senderId,
      isMine: m.senderId === session.user.id,
      senderName: m.sender.name,
    })),
    nextCursor: messages.length === 50 ? messages[0]?.id : null,
  });
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Pesan guru hanya tersedia untuk akun guru.");
  }

  const { id } = await params;
  try {
    await assertConversationAccess(id, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await readRequestJson(req);
  if (raw == null) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const body = raw as { content?: unknown };
  const content = String(body.content || "").trim();
  if (!content || content.length > 2000) {
    return NextResponse.json(
      { error: "Pesan harus 1–2000 karakter" },
      { status: 400 }
    );
  }

  const recipientId = await getConversationRecipientId(id, session.user.id);
  if (!recipientId) {
    return NextResponse.json({ error: "Penerima tidak ditemukan" }, { status: 400 });
  }
  const recipientAllows = await userAllowsMessages(recipientId);
  if (!recipientAllows) {
    return NextResponse.json(
      { error: "Guru ini tidak menerima pesan baru" },
      { status: 400 }
    );
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId: id,
        senderId: session.user.id,
        content,
      },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });
    await tx.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    return created;
  });

  return NextResponse.json({
    message: {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      senderId: message.senderId,
      isMine: true,
      senderName: message.sender.name,
    },
  });
}

export async function PATCH(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Pesan guru hanya tersedia untuk akun guru.");
  }

  const { id } = await params;
  try {
    await assertConversationAccess(id, session.user.id);
    await markConversationRead(id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
