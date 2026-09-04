import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { OtpPurpose, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readRequestJson } from "@/lib/http-json";
import { uniqueStoreSlug } from "@/lib/marketplace";
import { normalizeWhatsappNumber, verifyOtpCode } from "@/lib/whatsapp";
import {
  clientAddress,
  consumeSecurityRateLimit,
  rateLimitHeaders,
} from "@/lib/security-rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(8, "Nomor WhatsApp wajib diisi"),
  storeName: z.string().min(2, "Nama toko wajib diisi"),
  otpCode: z.string().trim().regex(/^\d{4,8}$/, "Kode OTP wajib dan harus 4–8 digit"),
});

export async function POST(req: Request) {
  try {
    const raw = await readRequestJson(req);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Data pendaftaran tidak valid" }, { status: 400 });
    }
    const body = schema.parse(raw);
    const addressRate = await consumeSecurityRateLimit({
      bucket: "register-merchant-ip",
      identity: clientAddress(req.headers),
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!addressRate.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429, headers: rateLimitHeaders(addressRate) },
      );
    }

    const phone = normalizeWhatsappNumber(body.phone);
    const otp = await verifyOtpCode({
      phone,
      purpose: OtpPurpose.REGISTER,
      code: body.otpCode,
      consume: true,
    });
    if (!otp.ok) {
      return NextResponse.json({ error: "Kode OTP tidak valid atau kedaluwarsa." }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const slug = await uniqueStoreSlug(body.storeName);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: body.name.trim(),
          email,
          passwordHash,
          phone,
          role: UserRole.MERCHANT,
          creditsRemaining: 0,
        },
      });
      await tx.merchantStore.create({
        data: {
          userId: user.id,
          name: body.storeName.trim(),
          slug,
          status: "PENDING_REVIEW",
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    }
    console.error("[register merchant]", err);
    return NextResponse.json({ error: "Pendaftaran merchant gagal" }, { status: 500 });
  }
}
