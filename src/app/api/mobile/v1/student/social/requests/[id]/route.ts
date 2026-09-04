import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { directConversationKey } from "@/lib/chat";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import { blockExists, socialError } from "@/lib/student-social";

type Params = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["ACCEPT", "REJECT"]) });

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  try {
    const [{ id }, input] = await Promise.all([params, schema.parseAsync(await request.json())]);
    const item = await prisma.studentMessageRequest.findFirst({
      where: { id, recipientId: session.user.id, status: "PENDING" },
      select: { id: true, senderId: true, recipientId: true, message: true },
    });
    if (!item) return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });
    if (await blockExists(item.senderId, item.recipientId)) throw new Error("BLOCKED");
    if (input.action === "REJECT") {
      await prisma.studentMessageRequest.update({
        where: { id: item.id },
        data: { status: "REJECTED", respondedAt: new Date() },
      });
      return NextResponse.json({ status: "REJECTED" });
    }
    const directKey = directConversationKey(item.senderId, item.recipientId);
    const result = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({
        where: { directKey },
        update: {},
        create: {
          directKey,
          participants: { create: [{ userId: item.senderId }, { userId: item.recipientId }] },
        },
        select: { id: true },
      });
      await tx.message.upsert({
        where: { clientMessageId: `request:${item.id}` },
        update: {},
        create: {
          conversationId: conversation.id,
          senderId: item.senderId,
          content: item.message,
          clientMessageId: `request:${item.id}`,
        },
      });
      await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      await tx.studentMessageRequest.update({
        where: { id: item.id },
        data: { status: "ACCEPTED", respondedAt: new Date(), conversationId: conversation.id },
      });
      return conversation;
    });
    return NextResponse.json({ status: "ACCEPTED", conversationId: result.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Tindakan tidak valid." }, { status: 400 });
    }
    const detail = socialError(error);
    return NextResponse.json({ error: detail.message, code: detail.code }, { status: 400 });
  }
}
