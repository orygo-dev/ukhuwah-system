import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setPartnerSession } from "@/lib/partner-auth";
import {
  clearSecurityRateLimit,
  clientAddress,
  consumeSecurityRateLimit,
  rateLimitHeaders,
} from "@/lib/security-rate-limit";

const loginSchema = z.object({
  code: z.string().min(2),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const input = loginSchema.parse(await req.json());
    const code = input.code.trim().toUpperCase();
    const identity = `${clientAddress(req.headers)}:${code}`;
    const rate = await consumeSecurityRateLimit({
      bucket: "partner-login",
      identity,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi beberapa menit kemudian." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }
    const partner = await prisma.affiliatePartner.findFirst({
      where: { code, isActive: true },
    });

    if (!partner?.passwordHash) {
      return NextResponse.json(
        { error: "Akses portal mitra belum diaktifkan oleh super admin" },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(input.password, partner.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Kode atau password salah" }, { status: 401 });
    }

    await clearSecurityRateLimit("partner-login", identity);
    await setPartnerSession(partner.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Kode dan password wajib diisi" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal login" }, { status: 500 });
  }
}
