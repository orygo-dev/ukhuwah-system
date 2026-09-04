import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import { socialError, socialPair } from "@/lib/student-social";

type Params = { params: Promise<{ studentId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  try {
    const { studentId } = await params;
    const { targetUserId } = await socialPair(session.user.id, studentId);
    await prisma.$transaction([
      prisma.studentBlock.upsert({
        where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: targetUserId } },
        update: {},
        create: { blockerId: session.user.id, blockedId: targetUserId },
      }),
      prisma.studentFollow.deleteMany({
        where: {
          OR: [
            { followerId: session.user.id, followingId: targetUserId },
            { followerId: targetUserId, followingId: session.user.id },
          ],
        },
      }),
      prisma.studentMessageRequest.updateMany({
        where: {
          status: "PENDING",
          OR: [
            { senderId: session.user.id, recipientId: targetUserId },
            { senderId: targetUserId, recipientId: session.user.id },
          ],
        },
        data: { status: "REJECTED", respondedAt: new Date() },
      }),
    ]);
    return NextResponse.json({ blocked: true });
  } catch (error) {
    const detail = socialError(error);
    return NextResponse.json({ error: detail.message, code: detail.code }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  try {
    const { studentId } = await params;
    const { targetUserId } = await socialPair(session.user.id, studentId);
    await prisma.studentBlock.deleteMany({
      where: { blockerId: session.user.id, blockedId: targetUserId },
    });
    return NextResponse.json({ blocked: false });
  } catch (error) {
    const detail = socialError(error);
    return NextResponse.json({ error: detail.message, code: detail.code }, { status: 400 });
  }
}
