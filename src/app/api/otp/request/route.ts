import { NextResponse } from "next/server";
import { z } from "zod";
import { OtpPurpose } from "@prisma/client";
import { auth } from "@/lib/auth";
import { readRequestJson } from "@/lib/http-json";
import {
  createOtpCode,
  normalizeWhatsappNumber,
  purposeForOtp,
  sendWhatsAppMessage,
} from "@/lib/whatsapp";
import {
  clientAddress,
  consumeSecurityRateLimit,
  rateLimitHeaders,
} from "@/lib/security-rate-limit";

const schema = z.object({
  phone: z.string().min(8),
  purpose: z.nativeEnum(OtpPurpose),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const raw = await readRequestJson(req);
    if (raw == null) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const body = schema.parse(raw);
    if (body.purpose === OtpPurpose.AFFILIATE_PAYOUT && !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const addressRate = await consumeSecurityRateLimit({
      bucket: "otp-request-ip",
      identity: clientAddress(req.headers),
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    const targetRate = await consumeSecurityRateLimit({
      bucket: "otp-request-target",
      identity: `${body.purpose}:${normalizeWhatsappNumber(body.phone)}`,
      limit: 6,
      windowMs: 60 * 60 * 1000,
    });
    const blockedRate = !addressRate.ok ? addressRate : !targetRate.ok ? targetRate : null;
    if (blockedRate) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan OTP. Coba lagi nanti." },
        { status: 429, headers: rateLimitHeaders(blockedRate) },
      );
    }
    const { code } = await createOtpCode({
      phone: body.phone,
      purpose: body.purpose,
      userId: session?.user?.id,
      ttlMinutes: 5,
    });

    await sendWhatsAppMessage({
      target: body.phone,
      userId: session?.user?.id,
      purpose: purposeForOtp(body.purpose),
      variables: {
        name: body.name || session?.user?.name || "Guru",
        otp: code,
        minutes: 5,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Gagal mengirim OTP";
    if (message === "OTP_COOLDOWN") {
      return NextResponse.json(
        { error: "Tunggu sekitar 1 menit sebelum meminta OTP baru." },
        { status: 429 }
      );
    }
    if (message === "OTP_RATE_LIMIT") {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan OTP. Coba lagi nanti." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
