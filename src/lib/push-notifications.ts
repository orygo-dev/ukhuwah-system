import { applicationDefault, cert, deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Message, type MulticastMessage } from "firebase-admin/messaging";
import { prisma } from "@/lib/prisma";
import { toSameOriginUploadUrl } from "@/lib/upload-url";
import {
  getPushNotificationRuntimeConfig,
  parseFirebaseServiceAccountJson,
} from "@/lib/push-notification-settings";

type FcmError = { code?: string; message?: string } | Error | unknown;

function getFcmErrorCode(error: FcmError): string {
  if (error === null || error === undefined) return "";
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.code === "string") return obj.code;
  }
  return "";
}

function getErrorMessage(error: FcmError): string {
  if (error === null || error === undefined) return "Unknown error";
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
  }
  return String(error);
}

type MinimalPushConfig = { projectId?: string | null };

export async function validatePushCredential(): Promise<{
  valid: boolean;
  projectId: string;
  error?: string;
}> {
  try {
    const runtime = await pushRuntime();
    if (!runtime) {
      const config = await getPushNotificationRuntimeConfig();
      return {
        valid: false,
        projectId: config.projectId || "",
        error: !config.enabled
          ? "Push notifikasi belum diaktifkan."
          : !config.configured
            ? "Kredensial Firebase belum lengkap. Upload service account JSON dan isi Project ID."
            : "Tidak dapat menginisialisasi Firebase Admin.",
      };
    }
    const dummyMessage: Message = {
      token: "fcm-dry-run-validate-only",
      notification: { title: "Dry run validate", body: "Credential check" },
    };
    const config = await getPushNotificationRuntimeConfig();
    try {
      await getMessaging(runtime.app).send(dummyMessage, true);
      return { valid: true, projectId: config.projectId };
    } catch (error: unknown) {
      const code = getFcmErrorCode(error);
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-argument"
      ) {
        return { valid: true, projectId: config.projectId };
      }
      if (code === "messaging/authentication-error" || code === "messaging/invalid-credentials") {
        return {
          valid: false,
          projectId: config.projectId,
          error: "Kredensial service account Firebase tidak sah atau sudah dicabut. Generate ulang private key dari Firebase Console.",
        };
      }
      if (code === "messaging/quota-exceeded") {
        return {
          valid: true,
          projectId: config.projectId,
          error: "Quota FCM tercapai, tapi kredensial valid.",
        };
      }
      return {
        valid: false,
        projectId: config.projectId,
        error: getErrorMessage(error),
      };
    }
  } catch (error: unknown) {
    const config: MinimalPushConfig = await getPushNotificationRuntimeConfig().catch(() => ({
      projectId: "",
    }));
    return {
      valid: false,
      projectId: (config.projectId as string) || "",
      error: getErrorMessage(error),
    };
  }
}

type PushRuntime = {
  app: App;
  channelId: string;
};

const globalPush = globalThis as typeof globalThis & {
  __genproPushApp?: App;
  __genproPushSignature?: string;
};

function absoluteUrl(value: string | null | undefined) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return undefined;
  const sameOrigin = toSameOriginUploadUrl(trimmed);
  const raw = sameOrigin.startsWith("/") ? sameOrigin : trimmed;
  try {
    if (raw.startsWith("/")) throw new Error("relative");
    return new URL(raw).toString();
  } catch {
    const base =
      process.env.AUTH_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      process.env.PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL?.trim()
        ? `https://${process.env.VERCEL_URL.trim()}`
        : "");
    if (!base) return undefined;
    return new URL(raw, base).toString();
  }
}

async function pushRuntime(): Promise<PushRuntime | null> {
  const config = await getPushNotificationRuntimeConfig();
  if (!config.enabled || !config.configured) return null;
  const signature = `${config.projectId}:${config.credentialMode}:${config.serverKeyMasked}`;
  if (globalPush.__genproPushApp && globalPush.__genproPushSignature !== signature) {
    await deleteApp(globalPush.__genproPushApp).catch(() => undefined);
    globalPush.__genproPushApp = undefined;
  }
  if (!globalPush.__genproPushApp) {
    let credential;
    if (config.credentialMode === "SERVICE_ACCOUNT") {
      const account = parseFirebaseServiceAccountJson(config.credential);
      if (!account) throw new Error("Kredensial service account Firebase tidak valid.");
      credential = cert({
        projectId: account.projectId,
        clientEmail: account.clientEmail,
        privateKey: account.privateKey,
      });
    } else {
      credential = applicationDefault();
    }
    const existing = getApps().find((app) => app.name === "genpro-push");
    globalPush.__genproPushApp =
      existing ||
      initializeApp(
        { credential, projectId: config.projectId },
        "genpro-push"
      );
    globalPush.__genproPushSignature = signature;
  }
  return { app: globalPush.__genproPushApp, channelId: config.androidChannelId };
}

const invalidTokenCodes = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

type SendPushOptions = {
  platform?: string;
  appId?: string;
};

export type DirectUserPush = {
  title: string;
  body: string;
  data: Record<string, string>;
  appId?: string;
};

export async function sendUserPush(userId: string, push: DirectUserPush) {
  const runtime = await pushRuntime();
  if (!runtime) return { sent: 0, failed: 0, skipped: true };
  const devices = await prisma.pushDeviceToken.findMany({
    where: {
      userId,
      active: true,
      ...(push.appId ? { appId: push.appId } : {}),
    },
    select: { token: true },
  });
  const tokens = Array.from(new Set(devices.map((device) => device.token)));
  if (tokens.length === 0) return { sent: 0, failed: 0, skipped: true };

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];
  for (let offset = 0; offset < tokens.length; offset += 500) {
    const batch = tokens.slice(offset, offset + 500);
    const result = await getMessaging(runtime.app).sendEachForMulticast({
      tokens: batch,
      notification: { title: push.title, body: push.body },
      data: push.data,
      android: {
        priority: "high",
        notification: {
          channelId: runtime.channelId,
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
          icon: "ic_stat_genpro",
          color: "#0B6EF3",
        },
      },
    });
    sent += result.successCount;
    failed += result.failureCount;
    result.responses.forEach((response, index) => {
      if (!response.success && invalidTokenCodes.has(response.error?.code || "")) {
        invalidTokens.push(batch[index]);
      }
    });
  }
  if (invalidTokens.length > 0) {
    await prisma.pushDeviceToken.updateMany({
      where: { token: { in: invalidTokens } },
      data: { active: false },
    });
  }
  return { sent, failed, skipped: false };
}

export async function sendNotificationPush(
  notificationId: string,
  options?: SendPushOptions
) {
  const runtime = await pushRuntime();
  if (!runtime) return { sent: 0, failed: 0, skipped: true };
  const deviceWhere = {
    active: true,
    ...(options?.platform ? { platform: options.platform } : {}),
    ...(options?.appId ? { appId: options.appId } : {}),
  };
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      message: true,
      category: true,
      priority: true,
      actionUrl: true,
      imageUrl: true,
      recipients: {
        select: {
          user: {
            select: {
              pushDeviceTokens: {
                  where: deviceWhere,
                select: { token: true },
              },
            },
          },
        },
      },
    },
  });
  if (!notification) return { sent: 0, failed: 0, skipped: true };
  const tokens = Array.from(
    new Set(
      notification.recipients.flatMap((recipient) =>
        recipient.user.pushDeviceTokens.map((device) => device.token)
      )
    )
  );
  if (tokens.length === 0) return { sent: 0, failed: 0, skipped: true };

  const imageUrl = absoluteUrl(notification.imageUrl);
  const link = absoluteUrl(notification.actionUrl) || absoluteUrl("/");
  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];
  for (let offset = 0; offset < tokens.length; offset += 500) {
    const batch = tokens.slice(offset, offset + 500);
    const message: MulticastMessage = {
      tokens: batch,
      notification: {
        title: notification.title,
        body: notification.message,
        ...(imageUrl ? { imageUrl } : {}),
      },
      data: {
        notificationId: notification.id,
        actionUrl: notification.actionUrl || "",
        category: notification.category,
        imageUrl: imageUrl || "",
      },
      android: {
        priority: notification.priority === "NORMAL" ? "normal" : "high",
        notification: {
          channelId: runtime.channelId,
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
          icon: "ic_stat_genpro",
          color: "#0B6EF3",
          ...(imageUrl ? { imageUrl } : {}),
        },
      },
      webpush: {
        headers: {
          Urgency: notification.priority === "URGENT" ? "high" : "normal",
        },
        notification: {
          ...(imageUrl ? { image: imageUrl } : {}),
        },
        ...(link ? { fcmOptions: { link } } : {}),
      },
    };
    const result = await getMessaging(runtime.app).sendEachForMulticast(message);
    sent += result.successCount;
    failed += result.failureCount;
    result.responses.forEach((response, index) => {
      if (!response.success && invalidTokenCodes.has(response.error?.code || "")) {
        invalidTokens.push(batch[index]);
      }
    });
  }
  if (invalidTokens.length > 0) {
    await prisma.pushDeviceToken.updateMany({
      where: { token: { in: invalidTokens } },
      data: { active: false },
    });
  }
  return { sent, failed, skipped: false };
}
