import { NextResponse } from "next/server";
import { z } from "zod";
import { OtpPurpose } from "@prisma/client";
import { auth } from "@/lib/auth";
import { readRequestJson } from "@/lib/http-json";
import { normalizeWhatsappNumber, verifyOtpCode } from "@/lib/whatsapp";
import {
  clearSecurityRateLimit,
  clientAddress,
  consumeSecurityRateLimit,
  rateLimitHeaders,
} from "@/lib/security-rate-limit";

const schema = z.object({
  phone: z.string().min(8),
  purpose: z.nativeEnum(OtpPurpose),
  code: z.string().min(4).max(8),
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
    const rateIdentity = `${clientAddress(req.headers)}:${body.purpose}:${normalizeWhatsappNumber(body.phone)}`;
    const rate = await consumeSecurityRateLimit({
      bucket: "otp-verify",
      identity: rateIdentity,
      limit: 12,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan kode OTP. Coba lagi nanti." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }
    const result = await verifyOtpCode({
      phone: body.phone,
      purpose: body.purpose,
      code: body.code,
      userId: session?.user?.id,
      // REGISTER preview must not consume — registration consumes the same code.
      consume: body.purpose !== OtpPurpose.REGISTER,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
    }

    await clearSecurityRateLimit("otp-verify", rateIdentity);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal verifikasi OTP" }, { status: 500 });
  }
}
