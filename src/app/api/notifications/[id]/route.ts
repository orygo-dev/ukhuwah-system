import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNotificationActor, resolveNotificationAudience } from "@/lib/notifications";
import { sendNotificationPush } from "@/lib/push-notifications";

const schema = z.object({ action: z.enum(["publish", "archive"]) });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Aksi tidak valid." }, { status: 400 });

  const { id } = await context.params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return NextResponse.json({ error: "Pemberitahuan tidak ditemukan." }, { status: 404 });

  const ownsNotification = notification.senderId === session.user.id;
  if (!ownsNotification && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.action === "archive") {
    const updated = await prisma.notification.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
      select: { id: true, status: true },
    });
    return NextResponse.json({ notification: updated });
  }

  if (!ownsNotification || notification.status !== "DRAFT") {
    return NextResponse.json({ error: "Draf ini tidak dapat diterbitkan." }, { status: 400 });
  }
  const actor = await getNotificationActor(session.user.id);
  if (!actor) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  try {
    const audience = await resolveNotificationAudience(actor, {
      targetType: notification.targetType,
      targetRole: notification.targetRole,
      schoolId: notification.schoolId,
      classRoomId: notification.classRoomId,
    });
    if (audience.recipientIds.length === 0) {
      return NextResponse.json({ error: "Target belum memiliki akun penerima aktif." }, { status: 400 });
    }
    const updated = await prisma.notification.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        recipients: { create: audience.recipientIds.map((userId) => ({ userId })) },
      },
      select: { id: true, status: true, _count: { select: { recipients: true } } },
    });
    after(async () => {
      try {
        await sendNotificationPush(updated.id);
      } catch (error) {
        console.error("[notification push]", error);
      }
    });
    return NextResponse.json({ notification: updated });
  } catch {
    return NextResponse.json({ error: "Target pemberitahuan tidak lagi valid." }, { status: 400 });
  }
}
