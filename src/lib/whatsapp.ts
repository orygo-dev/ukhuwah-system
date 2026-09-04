import crypto from "crypto";
import {
  OtpPurpose,
  type Prisma,
  WhatsAppGatewayProvider,
  WhatsAppMessagePurpose,
} from "@prisma/client";
import { APP_NAME } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type WhatsAppTemplate = {
  enabled: boolean;
  title: string;
  message: string;
};

export type WhatsAppTemplateMap = Record<WhatsAppMessagePurpose, WhatsAppTemplate>;

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplateMap = {
  OTP_REGISTER: {
    enabled: true,
    title: "OTP Registrasi Akun",
    message:
      "Halo {name}, kode OTP registrasi {appName} Anda adalah {otp}. Berlaku {minutes} menit. Jangan bagikan kode ini kepada siapa pun.",
  },
  OTP_PASSWORD_RESET: {
    enabled: true,
    title: "OTP Reset Password",
    message:
      "Halo {name}, kode OTP reset password {appName} Anda adalah {otp}. Berlaku {minutes} menit. Abaikan jika Anda tidak meminta reset password.",
  },
  OTP_AFFILIATE_PAYOUT: {
    enabled: true,
    title: "OTP Penarikan Komisi",
    message:
      "Halo {name}, kode OTP penarikan komisi {appName} Anda adalah {otp}. Berlaku {minutes} menit. Jangan bagikan kode ini kepada siapa pun.",
  },
  TOPUP_SUCCESS: {
    enabled: true,
    title: "Top Up Berhasil",
    message:
      "Halo {name}, top up {credits} kredit di {appName} berhasil. Total pembayaran: {amount}. Terima kasih.",
  },
  AFFILIATE_PAYOUT_SUCCESS: {
    enabled: true,
    title: "Penarikan Komisi Berhasil",
    message:
      "Halo {name}, penarikan komisi sebesar {amount} telah diproses ke rekening {bankName} {bankAccount}.",
  },
  SUBSCRIPTION_PURCHASE: {
    enabled: true,
    title: "Pembelian Paket Berhasil",
    message:
      "Halo {name}, paket {packageName} berhasil aktif sampai {expiredAt}. Selamat menggunakan {appName}.",
  },
  SUBSCRIPTION_EXPIRY_REMINDER: {
    enabled: true,
    title: "Reminder Paket Akan Expired",
    message:
      "Halo {name}, paket {packageName} Anda akan berakhir pada {expiredAt}. Perpanjang paket agar layanan tetap aktif.",
  },
  TEST: {
    enabled: true,
    title: "Test WhatsApp Gateway",
    message:
      "Halo {name}, ini pesan test dari {appName}. Jika pesan ini diterima, WhatsApp Gateway sudah terhubung.",
  },
};

const TEMPLATE_SETTING_KEY = "whatsapp_templates";
const OTP_RESEND_COOLDOWN_MS = 60_000;
const OTP_HOURLY_LIMIT = 5;

type SendOptions = {
  target: string;
  purpose: WhatsAppMessagePurpose;
  variables?: Record<string, string | number | null | undefined>;
  userId?: string | null;
  gatewayId?: string;
  messageOverride?: string;
};

export function normalizeWhatsappNumber(input: string) {
  const raw = input.replace(/[^\d+]/g, "");
  const digits = raw.startsWith("+") ? raw.slice(1) : raw;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function maskSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function renderWhatsAppTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined> = {}
) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = variables[key];
    return value === null || typeof value === "undefined" ? "" : String(value);
  });
}

export async function getWhatsAppTemplates(): Promise<WhatsAppTemplateMap> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: TEMPLATE_SETTING_KEY },
  });
  const saved =
    setting?.value && typeof setting.value === "object"
      ? (setting.value as Partial<WhatsAppTemplateMap>)
      : {};

  return Object.fromEntries(
    Object.entries(DEFAULT_WHATSAPP_TEMPLATES).map(([purpose, defaults]) => [
      purpose,
      {
        ...defaults,
        ...(saved[purpose as WhatsAppMessagePurpose] || {}),
      },
    ])
  ) as WhatsAppTemplateMap;
}

export async function saveWhatsAppTemplates(templates: Partial<WhatsAppTemplateMap>) {
  const next = {
    ...DEFAULT_WHATSAPP_TEMPLATES,
    ...templates,
  };
  await prisma.platformSetting.upsert({
    where: { key: TEMPLATE_SETTING_KEY },
    create: { key: TEMPLATE_SETTING_KEY, value: next },
    update: { value: next },
  });
  return next;
}

async function getGateway(gatewayId?: string) {
  if (gatewayId) {
    return prisma.whatsAppGateway.findUnique({ where: { id: gatewayId } });
  }
  return prisma.whatsAppGateway.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

async function sendViaFonnte(
  gateway: NonNullable<Awaited<ReturnType<typeof getGateway>>>,
  target: string,
  message: string
) {
  const form = new FormData();
  form.set("target", target);
  form.set("message", message);
  form.set("countryCode", "62");

  const res = await fetch(gateway.baseUrl || "https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: gateway.token || "",
    },
    body: form,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`Fonnte gagal: ${res.status} ${text.slice(0, 160)}`);
  return json;
}

async function sendViaWablas(
  gateway: NonNullable<Awaited<ReturnType<typeof getGateway>>>,
  target: string,
  message: string
) {
  const baseUrl = (gateway.baseUrl || "https://wablas.com/api/send-message").replace(/\/$/, "");
  const url = baseUrl.endsWith("/send-message") ? baseUrl : `${baseUrl}/send-message`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: gateway.token || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: target, message }),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`Wablas gagal: ${res.status} ${text.slice(0, 160)}`);
  return json;
}

async function sendViaCustom(
  gateway: NonNullable<Awaited<ReturnType<typeof getGateway>>>,
  target: string,
  message: string
) {
  if (!gateway.baseUrl) throw new Error("Base URL custom gateway belum diisi");
  const res = await fetch(gateway.baseUrl, {
    method: "POST",
    headers: {
      Authorization: gateway.token || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target, phone: target, message, sender: gateway.sender }),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`Custom gateway gagal: ${res.status} ${text.slice(0, 160)}`);
  return json;
}

function providerRef(response: unknown) {
  if (!response || typeof response !== "object") return null;
  const record = response as Record<string, unknown>;
  const candidates = [record.id, record.messageId, record.requestid, record.detail];
  const value = candidates.find((item) => typeof item === "string" || typeof item === "number");
  return value ? String(value) : null;
}

export async function sendWhatsAppMessage(options: SendOptions) {
  const target = normalizeWhatsappNumber(options.target);
  const gateway = await getGateway(options.gatewayId);
  const templates = await getWhatsAppTemplates();
  const template = templates[options.purpose];
  const message =
    options.messageOverride ||
    renderWhatsAppTemplate(template?.message || "", {
      appName: APP_NAME,
      ...options.variables,
    });

  if (!target || target.length < 9) {
    throw new Error("Nomor WhatsApp tidak valid");
  }
  if (!gateway || !gateway.isActive) {
    throw new Error("WhatsApp gateway aktif belum tersedia");
  }
  if (!options.messageOverride && template && !template.enabled) {
    throw new Error("Template WhatsApp untuk keperluan ini nonaktif");
  }

  const log = await prisma.whatsAppMessageLog.create({
    data: {
      gatewayId: gateway.id,
      userId: options.userId || null,
      purpose: options.purpose,
      target,
      message,
      status: "PENDING",
    },
  });

  try {
    const response =
      gateway.provider === WhatsAppGatewayProvider.FONNTE
        ? await sendViaFonnte(gateway, target, message)
        : gateway.provider === WhatsAppGatewayProvider.WABLAS
          ? await sendViaWablas(gateway, target, message)
          : await sendViaCustom(gateway, target, message);

    const updated = await prisma.whatsAppMessageLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerRef: providerRef(response),
        response: response as Prisma.InputJsonValue,
      },
    });
    return { ok: true, log: updated, response };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Gagal mengirim WhatsApp";
    await prisma.whatsAppMessageLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error },
    });
    throw err;
  }
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function createOtpCode(input: {
  phone: string;
  purpose: OtpPurpose;
  userId?: string | null;
  ttlMinutes?: number;
}) {
  const phone = normalizeWhatsappNumber(input.phone);
  const now = new Date();
  const recentOtp = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose: input.purpose,
      userId: input.userId || null,
      createdAt: { gt: new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recentOtp) {
    throw new Error("OTP_COOLDOWN");
  }

  const hourlyCount = await prisma.otpCode.count({
    where: {
      phone,
      purpose: input.purpose,
      userId: input.userId || null,
      createdAt: { gt: new Date(now.getTime() - 60 * 60_000) },
    },
  });
  if (hourlyCount >= OTP_HOURLY_LIMIT) {
    throw new Error("OTP_RATE_LIMIT");
  }

  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + (input.ttlMinutes || 5) * 60_000);
  await prisma.otpCode.create({
    data: {
      phone,
      purpose: input.purpose,
      userId: input.userId || null,
      codeHash: hashOtp(code),
      expiresAt,
    },
  });
  return { code, expiresAt };
}

export async function verifyOtpCode(input: {
  phone: string;
  purpose: OtpPurpose;
  code: string;
  userId?: string | null;
  /** When false, validates without marking the OTP consumed (UI preview). Default true. */
  consume?: boolean;
}) {
  const phone = normalizeWhatsappNumber(input.phone);
  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose: input.purpose,
      userId: input.userId || null,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false, reason: "NOT_FOUND" as const };
  if (otp.attempts >= otp.maxAttempts) return { ok: false, reason: "MAX_ATTEMPTS" as const };

  const valid = otp.codeHash === hashOtp(input.code);
  if (!valid) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "INVALID" as const };
  }

  if (input.consume !== false) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }
  return { ok: true as const };
}

export function purposeForOtp(purpose: OtpPurpose): WhatsAppMessagePurpose {
  if (purpose === OtpPurpose.REGISTER) return WhatsAppMessagePurpose.OTP_REGISTER;
  if (purpose === OtpPurpose.PASSWORD_RESET) return WhatsAppMessagePurpose.OTP_PASSWORD_RESET;
  return WhatsAppMessagePurpose.OTP_AFFILIATE_PAYOUT;
}
