import { NextResponse } from "next/server";
import { OtpPurpose, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createOtpCode,
  purposeForOtp,
  sendWhatsAppMessage,
} from "@/lib/whatsapp";
import {
  clientAddress,
  consumeSecurityRateLimit,
  rateLimitHeaders,
} from "@/lib/security-rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
});

const genericMessage =
  "Jika email terdaftar dan memiliki nomor WhatsApp, kode OTP akan segera dikirim.";

export async function POST(req: Request) {
  try {
    const { email } = schema.parse(await req.json());
    const rate = await consumeSecurityRateLimit({
      bucket: "forgot-password-request",
      identity: `${clientAddress(req.headers)}:${email.toLowerCase()}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi beberapa menit kemudian." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, phone: true, role: true },
    });

    if (!user || user.role !== UserRole.STUDENT || !user.phone) {
      return NextResponse.json({ ok: true, message: genericMessage });
    }

    const { code } = await createOtpCode({
      phone: user.phone,
      purpose: OtpPurpose.PASSWORD_RESET,
      userId: user.id,
      ttlMinutes: 5,
    });

    await sendWhatsAppMessage({
      target: user.phone,
      userId: user.id,
      purpose: purposeForOtp(OtpPurpose.PASSWORD_RESET),
      variables: {
        name: user.name,
        otp: code,
        minutes: 5,
      },
    });

    return NextResponse.json({ ok: true, message: genericMessage });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Masukkan alamat email yang valid." },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "OTP_COOLDOWN") {
      return NextResponse.json(
        { error: "Tunggu sekitar 1 menit sebelum meminta OTP baru." },
        { status: 429 },
      );
    }
    if (message === "OTP_RATE_LIMIT") {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan OTP. Coba lagi nanti." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Kode OTP belum dapat dikirim. Silakan coba lagi." },
      { status: 500 },
    );
  }
}
