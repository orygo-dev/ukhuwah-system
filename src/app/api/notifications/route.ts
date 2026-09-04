import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  NotificationTargetType,
  UserRole,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageNotifications,
  getNotificationActor,
  notificationVisibilityWhere,
  resolveNotificationAudience,
} from "@/lib/notifications";
import { isSafeNotificationImageUrl } from "@/lib/push-notification-settings";
import { sendNotificationPush } from "@/lib/push-notifications";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    message: z.string().trim().min(5).max(4000),
    category: z.nativeEnum(NotificationCategory).default("GENERAL"),
    priority: z.nativeEnum(NotificationPriority).default("NORMAL"),
    status: z.nativeEnum(NotificationStatus).refine((value) => value !== "ARCHIVED"),
    targetType: z.nativeEnum(NotificationTargetType),
    targetRole: z.nativeEnum(UserRole).nullable().optional(),
    schoolId: z.string().trim().nullable().optional(),
    classRoomId: z.string().trim().nullable().optional(),
    actionUrl: z.string().trim().max(500).nullable().optional(),
    imageUrl: z.string().trim().max(1000).nullable().optional(),
    publishAt: z.string().datetime().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.actionUrl && !isSafeActionUrl(value.actionUrl)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["actionUrl"], message: "Tautan tidak aman." });
    }
    if (value.imageUrl && !isSafeNotificationImageUrl(value.imageUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageUrl"],
        message: "Gambar pemberitahuan tidak valid. Unggah ulang atau gunakan URL https.",
      });
    }
    const publishAt = value.publishAt ? new Date(value.publishAt) : new Date();
    if (value.expiresAt && new Date(value.expiresAt) <= publishAt) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Waktu berakhir harus setelah waktu terbit." });
    }
  });

function isSafeActionUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 12, 1), 50);
  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";
  const notificationId = request.nextUrl.searchParams.get("notificationId")?.trim();
  const visible = notificationVisibilityWhere();
  const recipientWhere = {
    userId: session.user.id,
    ...(unreadOnly ? { readAt: null } : {}),
    notification: {
      is: notificationId ? { AND: [visible, { id: notificationId }] } : visible,
    },
  };

  const [items, unreadCount] = await Promise.all([
    prisma.notificationRecipient.findMany({
      where: recipientWhere,
      orderBy: [{ notification: { publishAt: "desc" } }, { notification: { priority: "desc" } }],
      take: limit,
      select: {
        id: true,
        readAt: true,
        notification: {
          select: {
            id: true,
            title: true,
            message: true,
            category: true,
            priority: true,
            actionUrl: true,
            imageUrl: true,
            publishAt: true,
            expiresAt: true,
            sender: { select: { name: true, role: true } },
          },
        },
      },
    }),
    prisma.notificationRecipient.count({
      where: { userId: session.user.id, readAt: null, notification: { is: visible } },
    }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      notification: item.notification
        ? {
            ...item.notification,
            imageUrl: item.notification.imageUrl
              ? toSameOriginUploadUrl(item.notification.imageUrl)
              : item.notification.imageUrl,
          }
        : item.notification,
    })),
    unreadCount,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageNotifications(session.user.role)) {
    return NextResponse.json({ error: "Anda tidak dapat membuat pemberitahuan." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }

  const actor = await getNotificationActor(session.user.id);
  if (!actor) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  try {
    const audience = await resolveNotificationAudience(actor, parsed.data);
    if (parsed.data.status === "PUBLISHED" && audience.recipientIds.length === 0) {
      return NextResponse.json({ error: "Target belum memiliki akun penerima aktif." }, { status: 400 });
    }

    const publishAt = parsed.data.publishAt ? new Date(parsed.data.publishAt) : new Date();
    const notification = await prisma.notification.create({
      data: {
        senderId: actor.id,
        title: parsed.data.title,
        message: parsed.data.message,
        category: parsed.data.category,
        priority: parsed.data.priority,
        status: parsed.data.status,
        targetType: parsed.data.targetType,
        targetRole: audience.targetRole,
        schoolId: audience.schoolId,
        classRoomId: audience.classRoomId,
        targetLabel: audience.targetLabel,
        actionUrl: parsed.data.actionUrl || null,
        imageUrl: parsed.data.imageUrl
          ? toSameOriginUploadUrl(parsed.data.imageUrl)
          : null,
        publishAt,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
        recipients:
          parsed.data.status === "PUBLISHED"
            ? { create: audience.recipientIds.map((userId) => ({ userId })) }
            : undefined,
      },
      select: { id: true, status: true, publishAt: true, targetLabel: true, _count: { select: { recipients: true } } },
    });

    if (notification.status === "PUBLISHED") {
      after(async () => {
        try {
          if (notification.publishAt <= new Date()) {
            await sendNotificationPush(notification.id);
          }
        } catch (error) {
          console.error("[notification push]", error);
        }
      });
    }

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code.startsWith("FORBIDDEN") ? 403 : 400;
    const message =
      code === "SCHOOL_REQUIRED"
        ? "Akun admin sekolah belum terhubung ke sekolah yang valid."
        : code === "FORBIDDEN_TARGET"
          ? "Target berada di luar kewenangan Anda."
          : "Target pemberitahuan tidak valid.";
    return NextResponse.json({ error: message }, { status });
  }
}
