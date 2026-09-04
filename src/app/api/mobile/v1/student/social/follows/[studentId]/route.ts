import { after, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import { notifyStudentFollow } from "@/lib/student-social-notifications";
import { socialError, socialPair } from "@/lib/student-social";
import { consumeSecurityRateLimit, rateLimitHeaders } from "@/lib/security-rate-limit";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ studentId: string }> };

async function enforceFollowRateLimit(userId: string) {
  const result = await consumeSecurityRateLimit({
    bucket: "student-social-follow",
    identity: userId,
    limit: 40,
    windowMs: 60_000,
  });
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Terlalu banyak perubahan mengikuti. Coba lagi sebentar.", code: "RATE_LIMITED" },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  const rateLimited = await enforceFollowRateLimit(session.user.id);
  if (rateLimited) return rateLimited;
  try {
    const { studentId } = await params;
    const { targetUserId, viewer } = await socialPair(session.user.id, studentId);
    const result = await prisma.$transaction(
      async (tx) => {
        const blocked = await tx.studentBlock.findFirst({
          where: {
            OR: [
              { blockerId: viewer.id, blockedId: targetUserId },
              { blockerId: targetUserId, blockedId: viewer.id },
            ],
          },
          select: { id: true },
        });
        if (blocked) throw new Error("BLOCKED");
        const inserted = await tx.studentFollow.createMany({
          data: [{ followerId: viewer.id, followingId: targetUserId }],
          skipDuplicates: true,
        });
        const reverse = await tx.studentFollow.findUnique({
          where: {
            followerId_followingId: { followerId: targetUserId, followingId: viewer.id },
          },
          select: { id: true },
        });
        return { created: inserted.count === 1, mutual: Boolean(reverse) };
      },
      { isolationLevel: "Serializable" },
    );
    if (result.created) {
      after(() => notifyStudentFollow(viewer.id, targetUserId, viewer.name).catch(console.error));
    }
    return NextResponse.json({ following: true, mutual: result.mutual });
  } catch (error) {
    const detail = socialError(error);
    return NextResponse.json({ error: detail.message, code: detail.code }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  const rateLimited = await enforceFollowRateLimit(session.user.id);
  if (rateLimited) return rateLimited;
  try {
    const { studentId } = await params;
    const { targetUserId } = await socialPair(session.user.id, studentId);
    await prisma.studentFollow.deleteMany({
      where: { followerId: session.user.id, followingId: targetUserId },
    });
    return NextResponse.json({ following: false, mutual: false });
  } catch (error) {
    const detail = socialError(error);
    return NextResponse.json({ error: detail.message, code: detail.code }, { status: 400 });
  }
}
