import { after, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import { notifyStudentMessage } from "@/lib/student-social-notifications";
import { assertStudentConversationAccess, normalizeSocialText, socialError } from "@/lib/student-social";

type Params = { params: Promise<{ id: string }> };
const postSchema = z.object({ content: z.unknown(), clientMessageId: z.string().min(8).max(80) });

export async function GET(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  try {
    const { id } = await params;
    const { otherId } = await assertStudentConversationAccess(id, session.user.id);
    const cursor = new URL(request.url).searchParams.get("cursor");
    const [messages, other] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, senderId: true, content: true, createdAt: true },
      }),
      prisma.user.findUnique({
        where: { id: otherId },
        select: { id: true, name: true, avatarUrl: true, studentProfile: { select: { id: true, classRoom: { select: { school: { select: { name: true } } } } } } },
      }),
    ]);
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
      data: { lastReadAt: new Date() },
    });
    return NextResponse.json({
      conversation: {
        id,
        otherUser: other
          ? { id: other.id, studentId: other.studentProfile?.id, name: other.name, avatarUrl: other.avatarUrl, schoolName: other.studentProfile?.classRoom.school?.name ?? "Sekolah belum tercantum" }
          : null,
      },
      messages: messages.reverse().map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), isMine: item.senderId === session.user.id })),
      nextCursor: messages.length === 50 ? messages[0]?.id : null,
    });
  } catch (error) {
    const detail = socialError(error);
    return NextResponse.json({ error: detail.message, code: detail.code }, { status: 403 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  try {
    const [{ id }, input] = await Promise.all([params, postSchema.parseAsync(await request.json())]);
    const content = normalizeSocialText(input.content);
    const { otherId } = await assertStudentConversationAccess(id, session.user.id);
    const recent = await prisma.message.count({
      where: { senderId: session.user.id, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent >= 20) throw new Error("RATE_LIMITED");
    const result = await prisma.$transaction(async (tx) => {
      const inserted = await tx.message.createMany({
        data: [{ conversationId: id, senderId: session.user.id, content, clientMessageId: input.clientMessageId }],
        skipDuplicates: true,
      });
      const created = await tx.message.findUnique({
        where: { clientMessageId: input.clientMessageId },
        select: { id: true, conversationId: true, senderId: true, content: true, createdAt: true },
      });
      if (!created) throw new Error("INVALID_MESSAGE");
      if (created.conversationId !== id || created.senderId !== session.user.id) throw new Error("FORBIDDEN");
      if (inserted.count === 1) {
        await tx.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
      }
      return { message: created, inserted: inserted.count === 1 };
    });
    if (result.inserted) {
      after(() => notifyStudentMessage(otherId, session.user.name ?? "Siswa Navalogi", id, content).catch(console.error));
    }
    return NextResponse.json({ message: { ...result.message, createdAt: result.message.createdAt.toISOString(), isMine: true } }, { status: result.inserted ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Data pesan tidak valid." }, { status: 400 });
    const detail = socialError(error);
    const status = ["FORBIDDEN", "MESSAGE_NOT_ALLOWED"].includes(detail.code) ? 403 : 400;
    return NextResponse.json({ error: detail.message, code: detail.code }, { status });
  }
}

export async function PATCH(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  try {
    const { id } = await params;
    await assertStudentConversationAccess(id, session.user.id);
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
      data: { lastReadAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const detail = socialError(error);
    return NextResponse.json({ error: detail.message, code: detail.code }, { status: 403 });
  }
}
