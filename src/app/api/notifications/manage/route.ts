import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageNotifications,
  getNotificationActor,
  notificationTargetOptions,
} from "@/lib/notifications";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageNotifications(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actor = await getNotificationActor(session.user.id);
  if (!actor) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  const [items, options] = await Promise.all([
    prisma.notification.findMany({
      where: session.user.role === "SUPER_ADMIN" ? {} : { senderId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        message: true,
        category: true,
        priority: true,
        status: true,
        targetType: true,
        targetLabel: true,
        actionUrl: true,
        imageUrl: true,
        publishAt: true,
        expiresAt: true,
        createdAt: true,
        sender: { select: { id: true, name: true, role: true } },
        _count: { select: { recipients: true } },
        recipients: { where: { readAt: { not: null } }, select: { id: true } },
      },
    }),
    notificationTargetOptions(actor),
  ]);

  return NextResponse.json({
    items: items.map(({ recipients, ...item }) => ({
      ...item,
      imageUrl: item.imageUrl ? toSameOriginUploadUrl(item.imageUrl) : item.imageUrl,
      readCount: recipients.length,
    })),
    options,
    actor: { role: actor.role, schoolName: actor.school?.name ?? null },
  });
}
