import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt, maskSecret } from "@/lib/encryption";

export const R2_SETTING_KEY = "integration.cloudflare_r2";

type StoredR2Config = {
  enabled: boolean;
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  accessKeyIdEncrypted: string;
  secretAccessKeyEncrypted: string;
  updatedById?: string;
  lastTestedAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
};

export type R2PublicConfig = {
  enabled: boolean;
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  configured: boolean;
  accessKeyIdMasked: string;
  secretAccessKeyMasked: string;
  updatedById?: string;
  lastTestedAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
};

export type R2ConfigInput = {
  enabled: boolean;
  accountId?: string;
  bucket?: string;
  publicBaseUrl?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
};

export type ResolvedR2Credentials = {
  enabled: boolean;
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

async function readStoredConfig(): Promise<StoredR2Config | null> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: R2_SETTING_KEY },
    select: { value: true },
  });
  if (!setting?.value || typeof setting.value !== "object") return null;
  return setting.value as StoredR2Config;
}

function envCredentials(): Partial<ResolvedR2Credentials> {
  return {
    accountId: process.env.R2_ACCOUNT_ID?.trim() || "",
    bucket: process.env.R2_BUCKET?.trim() || "",
    publicBaseUrl: normalizeBaseUrl(process.env.R2_PUBLIC_BASE_URL || ""),
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim() || "",
    enabled: process.env.R2_ENABLED === "true",
  };
}

export async function resolveR2Credentials(): Promise<ResolvedR2Credentials | null> {
  const stored = await readStoredConfig();
  const env = envCredentials();

  let accessKeyId = env.accessKeyId || "";
  let secretAccessKey = env.secretAccessKey || "";
  if (stored?.accessKeyIdEncrypted) {
    try {
      accessKeyId = decrypt(stored.accessKeyIdEncrypted);
    } catch {
      accessKeyId = "";
    }
  }
  if (stored?.secretAccessKeyEncrypted) {
    try {
      secretAccessKey = decrypt(stored.secretAccessKeyEncrypted);
    } catch {
      secretAccessKey = "";
    }
  }

  const accountId = stored?.accountId?.trim() || env.accountId || "";
  const bucket = stored?.bucket?.trim() || env.bucket || "";
  const publicBaseUrl = normalizeBaseUrl(
    stored?.publicBaseUrl || env.publicBaseUrl || ""
  );
  const enabled = stored?.enabled ?? env.enabled ?? false;

  if (!enabled || !accountId || !bucket || !publicBaseUrl || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    enabled: true,
    accountId,
    bucket,
    publicBaseUrl,
    accessKeyId,
    secretAccessKey,
  };
}

export async function getR2PublicConfig(): Promise<R2PublicConfig> {
  const stored = await readStoredConfig();
  const env = envCredentials();

  let accessKeyIdMasked = "";
  let secretAccessKeyMasked = "";
  try {
    accessKeyIdMasked = stored?.accessKeyIdEncrypted
      ? maskSecret(decrypt(stored.accessKeyIdEncrypted))
      : env.accessKeyId
        ? maskSecret(env.accessKeyId)
        : "";
    secretAccessKeyMasked = stored?.secretAccessKeyEncrypted
      ? maskSecret(decrypt(stored.secretAccessKeyEncrypted))
      : env.secretAccessKey
        ? maskSecret(env.secretAccessKey)
        : "";
  } catch {
    accessKeyIdMasked = "Tersimpan";
    secretAccessKeyMasked = "Tersimpan";
  }

  const accountId = stored?.accountId?.trim() || env.accountId || "";
  const bucket = stored?.bucket?.trim() || env.bucket || "";
  const publicBaseUrl = normalizeBaseUrl(
    stored?.publicBaseUrl || env.publicBaseUrl || ""
  );
  const hasKeys = Boolean(
    stored?.accessKeyIdEncrypted ||
      stored?.secretAccessKeyEncrypted ||
      (env.accessKeyId && env.secretAccessKey)
  );
  const configured = Boolean(accountId && bucket && publicBaseUrl && hasKeys);

  return {
    enabled: stored?.enabled ?? env.enabled ?? false,
    accountId,
    bucket,
    publicBaseUrl,
    configured,
    accessKeyIdMasked,
    secretAccessKeyMasked,
    updatedById: stored?.updatedById,
    lastTestedAt: stored?.lastTestedAt,
    lastTestOk: stored?.lastTestOk,
    lastTestMessage: stored?.lastTestMessage,
  };
}

export async function saveR2Config(
  input: R2ConfigInput,
  userId: string
): Promise<R2PublicConfig> {
  const current = await readStoredConfig();
  const accountId = (input.accountId ?? current?.accountId ?? "").trim();
  const bucket = (input.bucket ?? current?.bucket ?? "").trim();
  const publicBaseUrl = normalizeBaseUrl(
    input.publicBaseUrl ?? current?.publicBaseUrl ?? ""
  );
  const accessKeyIdEncrypted = input.accessKeyId?.trim()
    ? encrypt(input.accessKeyId.trim())
    : current?.accessKeyIdEncrypted || "";
  const secretAccessKeyEncrypted = input.secretAccessKey?.trim()
    ? encrypt(input.secretAccessKey.trim())
    : current?.secretAccessKeyEncrypted || "";

  if (input.enabled) {
    if (!accountId || !bucket || !publicBaseUrl) {
      throw new Error("Account ID, bucket, dan Public Base URL wajib diisi.");
    }
    if (!accessKeyIdEncrypted || !secretAccessKeyEncrypted) {
      throw new Error("Access Key ID dan Secret Access Key wajib diisi.");
    }
    if (!/^https:\/\//i.test(publicBaseUrl)) {
      throw new Error("Public Base URL harus diawali https://");
    }
  }

  const next: StoredR2Config = {
    enabled: input.enabled,
    accountId,
    bucket,
    publicBaseUrl,
    accessKeyIdEncrypted,
    secretAccessKeyEncrypted,
    updatedById: userId,
    lastTestedAt: current?.lastTestedAt,
    lastTestOk: current?.lastTestOk,
    lastTestMessage: current?.lastTestMessage,
  };

  await prisma.platformSetting.upsert({
    where: { key: R2_SETTING_KEY },
    create: { key: R2_SETTING_KEY, value: next },
    update: { value: next },
  });

  return getR2PublicConfig();
}

export async function markR2TestResult(ok: boolean, message: string) {
  const current = await readStoredConfig();
  if (!current) return;
  await prisma.platformSetting.update({
    where: { key: R2_SETTING_KEY },
    data: {
      value: {
        ...current,
        lastTestedAt: new Date().toISOString(),
        lastTestOk: ok,
        lastTestMessage: message.slice(0, 500),
      },
    },
  });
}

export async function getR2PublicBaseUrl(): Promise<string | null> {
  const creds = await resolveR2Credentials();
  return creds?.publicBaseUrl ?? null;
}
