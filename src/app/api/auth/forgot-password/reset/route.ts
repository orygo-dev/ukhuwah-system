import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { OtpPurpose, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyOtpCode } from "@/lib/whatsapp";
import {
  clearSecurityRateLimit,
  clientAddress,
  consumeSecurityRateLimit,
  rateLimitHeaders,
} from "@/lib/security-rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{4,8}$/),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  try {
    const data = schema.parse(await req.json());
    const rateIdentity = `${clientAddress(req.headers)}:${data.email.toLowerCase()}`;
    const rate = await consumeSecurityRateLimit({
      bucket: "forgot-password-reset",
      identity: rateIdentity,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi beberapa menit kemudian." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true, phone: true, role: true },
    });

    if (!user || user.role !== UserRole.STUDENT || !user.phone) {
      return NextResponse.json(
        { error: "Kode OTP tidak valid atau sudah kedaluwarsa." },
        { status: 400 },
      );
    }

    const verification = await verifyOtpCode({
      phone: user.phone,
      purpose: OtpPurpose.PASSWORD_RESET,
      code: data.code,
      userId: user.id,
    });
    if (!verification.ok) {
      return NextResponse.json(
        { error: "Kode OTP tidak valid atau sudah kedaluwarsa." },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(data.password, 12),
        authVersion: { increment: 1 },
      },
    });
    await clearSecurityRateLimit("forgot-password-reset", rateIdentity);

    return NextResponse.json({
      ok: true,
      message: "Password berhasil diperbarui. Silakan masuk kembali.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Periksa kembali email, kode OTP, dan password baru." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Password belum dapat diperbarui. Silakan coba lagi." },
      { status: 500 },
    );
  }
}
