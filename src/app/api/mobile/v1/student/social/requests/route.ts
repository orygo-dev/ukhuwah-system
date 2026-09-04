import { after, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import { notifyStudentMessageRequest } from "@/lib/student-social-notifications";
import {
  findOrCreateStudentConversation,
  normalizeSocialText,
  socialError,
  socialPair,
  studentRelationship,
} from "@/lib/student-social";

const schema = z.object({ studentId: z.string().min(1), message: z.unknown() });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  try {
    const input = schema.parse(await request.json());
    const content = normalizeSocialText(input.message, 500);
    const { viewer, targetUserId } = await socialPair(session.user.id, input.studentId);
    const relation = await studentRelationship(viewer.id, targetUserId);
    if (relation.blocked) throw new Error("BLOCKED");
    if (relation.mutual) {
      const conversation = await findOrCreateStudentConversation(viewer.id, targetUserId);
      return NextResponse.json({ status: "ACCEPTED", conversationId: conversation.id });
    }
    if (!relation.following) {
      return NextResponse.json(
        { error: "Ikuti siswa ini sebelum mengirim permintaan pesan." },
        { status: 400 },
      );
    }
    if (relation.request?.status === "REJECTED") {
      return NextResponse.json(
        { error: "Permintaan sebelumnya telah ditolak dan tidak dapat dikirim ulang." },
        { status: 409 },
      );
    }
    if (relation.request?.status === "PENDING") {
      return NextResponse.json({
        requestId: relation.request.id,
        status: relation.request.status,
      });
    }
    if (relation.request?.status === "ACCEPTED" && relation.request.conversationId) {
      return NextResponse.json({
        status: relation.request.status,
        conversationId: relation.request.conversationId,
      });
    }
    const recent = await prisma.studentMessageRequest.count({
      where: { senderId: viewer.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    if (recent >= 10) throw new Error("RATE_LIMITED");
    const created = await prisma.studentMessageRequest.upsert({
      where: { senderId_recipientId: { senderId: viewer.id, recipientId: targetUserId } },
      update: {},
      create: { senderId: viewer.id, recipientId: targetUserId, message: content },
      select: { id: true, status: true },
    });
    after(() =>
      notifyStudentMessageRequest(targetUserId, viewer.name, created.id).catch(console.error),
    );
    return NextResponse.json({ requestId: created.id, status: created.status }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Data permintaan tidak valid." }, { status: 400 });
    }
    const detail = socialError(error);
    return NextResponse.json({ error: detail.message, code: detail.code }, { status: 400 });
  }
}
