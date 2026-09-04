import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAppDisplayConfig, LOCKED_SPLASH, resolveAppName } from "@/lib/app-display";
import { notificationVisibilityWhere } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  MOBILE_API_VERSION,
  mobileUnauthorized,
  serializeMobileUser,
} from "@/lib/mobile-api";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();

  const [display, unreadCount, account] = await Promise.all([
    getAppDisplayConfig(),
    prisma.notificationRecipient.count({
      where: {
        userId: session.user.id,
        readAt: null,
        notification: { is: notificationVisibilityWhere() },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        avatarUrl: true,
        school: { select: { id: true, name: true } },
        studentProfile: {
          select: {
            id: true,
            nis: true,
            name: true,
            classRoom: {
              select: {
                id: true,
                name: true,
                jenjang: true,
                tahunAjaran: true,
                deliveryMode: true,
                teacher: { select: { id: true, name: true } },
                school: {
                  select: {
                    id: true,
                    name: true,
                    city: true,
                    province: true,
                    regency: {
                      select: {
                        name: true,
                        province: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const rawAvatar = account?.avatarUrl ?? session.user.avatarUrl ?? null;

  return NextResponse.json({
    apiVersion: MOBILE_API_VERSION,
    user: {
      ...serializeMobileUser(session),
      avatarUrl: rawAvatar ? toSameOriginUploadUrl(rawAvatar) : null,
    },
    context: {
      school: account?.school ?? account?.studentProfile?.classRoom.school ?? null,
      student: account?.studentProfile ?? null,
    },
    counters: { unreadNotifications: unreadCount },
    features: {
      assignments: true,
      quizzes: true,
      exams: true,
      tka: true,
      reading: true,
      pjj: true,
      notifications: true,
      liveKit: true,
    },
    display: {
      appName: resolveAppName(display),
      logoUrl: display.branding.logoUrl,
      authLogoUrl: display.branding.authLogoUrl,
      splash: LOCKED_SPLASH,
    },
  });
}
