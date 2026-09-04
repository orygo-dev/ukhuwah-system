import { prisma } from "@/lib/prisma";
import { decrypt, encrypt, maskSecret } from "@/lib/encryption";

export const PUSH_NOTIFICATION_SETTING_KEY = "integration.push_notification";

type StoredPushConfig = {
  enabled: boolean;
  provider: "FCM";
  projectId: string;
  serverKeyEncrypted: string;
  androidChannelId: string;
  webApiKey?: string;
  webAuthDomain?: string;
  webMessagingSenderId?: string;
  webAppId?: string;
  webVapidKey?: string;
  updatedById?: string;
};

export type PushNotificationWebConfig = {
  configured: boolean;
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export type PushNotificationPublicConfig = {
  enabled: boolean;
  provider: "FCM";
  projectId: string;
  androidChannelId: string;
  configured: boolean;
  credentialMode: "SERVICE_ACCOUNT" | "ADC" | "MISSING";
  serverKeyMasked: string;
  web: PushNotificationWebConfig;
  updatedById?: string;
};

export type PushNotificationConfigInput = {
  enabled: boolean;
  provider?: "FCM";
  projectId?: string;
  serverKey?: string;
  androidChannelId?: string;
  webApiKey?: string;
  webAuthDomain?: string;
  webMessagingSenderId?: string;
  webAppId?: string;
  webVapidKey?: string;
};

export const DEFAULT_PUSH_NOTIFICATION_CONFIG: PushNotificationPublicConfig = {
  enabled: false,
  provider: "FCM",
  projectId: "",
  androidChannelId: "genpro_default",
  configured: false,
  credentialMode: "MISSING",
  serverKeyMasked: "",
  web: {
    configured: false,
    apiKey: "",
    authDomain: "",
    projectId: "",
    messagingSenderId: "",
    appId: "",
    vapidKey: "",
  },
};

export type FirebaseServiceAccountCredential = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  normalizedJson: string;
};

function unwrapCredentialText(value: string) {
  let normalized = value.replace(/^\uFEFF/, "").trim();
  if (normalized.startsWith("```")) {
    normalized = normalized.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return normalized;
}

export function parseFirebaseServiceAccountJson(
  value: string
): FirebaseServiceAccountCredential | null {
  try {
    let parsed: unknown = JSON.parse(unwrapCredentialText(value));
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const projectId = String(record.project_id ?? record.projectId ?? "").trim();
    const clientEmail = String(record.client_email ?? record.clientEmail ?? "").trim();
    const privateKey = String(record.private_key ?? record.privateKey ?? "")
      .replace(/\\n/g, "\n")
      .trim();
    if (
      !projectId ||
      !clientEmail.includes("@") ||
      !privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
      !privateKey.includes("-----END PRIVATE KEY-----")
    ) {
      return null;
    }
    return {
      projectId,
      clientEmail,
      privateKey,
      normalizedJson: JSON.stringify({
        ...record,
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
      }),
    };
  } catch {
    return null;
  }
}

function runtimeCredential(stored: StoredPushConfig | null) {
  if (stored?.serverKeyEncrypted) {
    try {
      return decrypt(stored.serverKeyEncrypted);
    } catch {
      return "";
    }
  }
  return (
    process.env.FCM_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.FCM_SERVER_KEY?.trim() ||
    ""
  );
}

async function readStoredConfig(): Promise<StoredPushConfig | null> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: PUSH_NOTIFICATION_SETTING_KEY },
    select: { value: true },
  });
  if (!setting?.value || typeof setting.value !== "object") return null;
  return setting.value as StoredPushConfig;
}

export async function getPushNotificationPublicConfig(): Promise<PushNotificationPublicConfig> {
  const stored = await readStoredConfig();
  const envProject = process.env.FCM_PROJECT_ID?.trim() || "";
  const credential = runtimeCredential(stored);
  const adc = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
  const serviceAccount = parseFirebaseServiceAccountJson(credential);

  let serverKeyMasked = "";
  try {
    serverKeyMasked = stored?.serverKeyEncrypted
      ? maskSecret(decrypt(stored.serverKeyEncrypted))
      : credential
        ? maskSecret(credential)
        : "";
  } catch {
    serverKeyMasked = "Tersimpan";
  }

  const projectId = stored?.projectId?.trim() || envProject || serviceAccount?.projectId || "";
  const configured = Boolean(
    projectId && (adc || (serviceAccount && serviceAccount.projectId === projectId))
  );
  const web = {
    apiKey: stored?.webApiKey?.trim() || process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || "",
    authDomain:
      stored?.webAuthDomain?.trim() || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || "",
    projectId,
    messagingSenderId:
      stored?.webMessagingSenderId?.trim() ||
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
      "",
    appId: stored?.webAppId?.trim() || process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || "",
    vapidKey:
      stored?.webVapidKey?.trim() || process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() || "",
  };

  return {
    enabled: stored?.enabled ?? false,
    provider: "FCM",
    projectId,
    androidChannelId:
      stored?.androidChannelId?.trim() ||
      DEFAULT_PUSH_NOTIFICATION_CONFIG.androidChannelId,
    configured,
    credentialMode: serviceAccount ? "SERVICE_ACCOUNT" : adc ? "ADC" : "MISSING",
    serverKeyMasked,
    web: {
      ...web,
      configured: Boolean(
        web.apiKey &&
          web.authDomain &&
          web.projectId &&
          web.messagingSenderId &&
          web.appId &&
          web.vapidKey
      ),
    },
    updatedById: stored?.updatedById,
  };
}

export async function savePushNotificationConfig(
  input: PushNotificationConfigInput,
  userId: string
): Promise<PushNotificationPublicConfig> {
  const current = await readStoredConfig();
  const submittedCredential = input.serverKey?.trim() || runtimeCredential(current);
  const serviceAccount = parseFirebaseServiceAccountJson(submittedCredential);
  const requestedProjectId = (input.projectId ?? current?.projectId ?? "").trim();
  const projectId = requestedProjectId || serviceAccount?.projectId || "";
  const androidChannelId = (
    input.androidChannelId ??
    current?.androidChannelId ??
    DEFAULT_PUSH_NOTIFICATION_CONFIG.androidChannelId
  )
    .trim()
    .slice(0, 80);
  const serverKeyEncrypted = input.serverKey?.trim()
    ? encrypt(serviceAccount?.normalizedJson || unwrapCredentialText(input.serverKey))
    : current?.serverKeyEncrypted || "";

  const adc = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
  if (input.enabled && !projectId) {
    throw new Error("Project ID Firebase belum diisi.");
  }
  if (input.enabled && !serviceAccount && !adc) {
    throw new Error(
      "JSON service account tidak terbaca. Tempel seluruh isi file private key Firebase Admin SDK, bukan google-services.json."
    );
  }
  if (input.enabled && serviceAccount && serviceAccount.projectId !== projectId) {
    throw new Error(
      `Project ID tidak cocok. Form berisi “${projectId}”, sedangkan service account berasal dari “${serviceAccount.projectId}”.`
    );
  }

  const next: StoredPushConfig = {
    enabled: input.enabled,
    provider: "FCM",
    projectId,
    serverKeyEncrypted,
    androidChannelId: androidChannelId || "genpro_default",
    webApiKey: (input.webApiKey ?? current?.webApiKey ?? "").trim(),
    webAuthDomain: (input.webAuthDomain ?? current?.webAuthDomain ?? "").trim(),
    webMessagingSenderId: (
      input.webMessagingSenderId ??
      current?.webMessagingSenderId ??
      ""
    ).trim(),
    webAppId: (input.webAppId ?? current?.webAppId ?? "").trim(),
    webVapidKey: (input.webVapidKey ?? current?.webVapidKey ?? "").trim(),
    updatedById: userId,
  };

  await prisma.platformSetting.upsert({
    where: { key: PUSH_NOTIFICATION_SETTING_KEY },
    create: { key: PUSH_NOTIFICATION_SETTING_KEY, value: next },
    update: { value: next },
  });

  return getPushNotificationPublicConfig();
}

export async function getPushNotificationRuntimeConfig() {
  const stored = await readStoredConfig();
  const publicConfig = await getPushNotificationPublicConfig();
  return {
    ...publicConfig,
    credential: runtimeCredential(stored),
  };
}

export async function isPushNotificationEnabled(): Promise<boolean> {
  const config = await getPushNotificationPublicConfig();
  return config.enabled && config.configured;
}

export function isSafeNotificationImageUrl(value: string): boolean {
  // Lazy import avoided: keep light check aligned with object-storage rules.
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) return false;
  if (
    trimmed.startsWith("/uploads/notifications/") ||
    trimmed.startsWith("/api/media/notifications/")
  ) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (
      parsed.pathname.startsWith("/uploads/notifications/") ||
      parsed.pathname.startsWith("/api/media/notifications/")
    ) {
      return true;
    }
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
