import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createParentSessionToken,
  normalizeParentAccessCode,
  parentAccessCodeLookupKey,
  parentCookieName,
  parentCookieOptions,
  verifyParentAccessCode,
} from "@/lib/parent-access";
import {
  clientAddress,
  consumeSecurityRateLimit,
  rateLimitHeaders,
} from "@/lib/security-rate-limit";

const schema = z.object({
  code: z.string().min(6, "Kode akses wajib diisi").max(32, "Kode akses terlalu panjang"),
});

export async function POST(req: Request) {
  try {
    const rate = await consumeSecurityRateLimit({
      bucket: "parent-code-ip",
      identity: clientAddress(req.headers),
      limit: 12,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi beberapa menit kemudian." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }

    const body = schema.parse(await req.json());
    const normalized = normalizeParentAccessCode(body.code);
    if (normalized.length < 6 || normalized.length > 12) {
      return NextResponse.json({ error: "Format kode akses tidak valid" }, { status: 400 });
    }

    const lookup = parentAccessCodeLookupKey(normalized);
    const matched = await prisma.student.findFirst({
      where: {
        parentAccessEnabled: true,
        isActive: true,
        parentAccessCodeLookup: lookup,
        classRoom: { isActive: true },
      },
      include: {
        classRoom: {
          select: { name: true, tahunAjaran: true, isActive: true },
        },
      },
    });

    if (!matched || !(await verifyParentAccessCode(normalized, matched.parentAccessCodeHash))) {
      return NextResponse.json(
        {
          error:
            "Kode akses tidak valid atau sudah dinonaktifkan. Jika kode lama dibuat sebelum pembaruan sistem, minta guru menerbitkan ulang kode orang tua.",
        },
        { status: 401 }
      );
    }

    const token = createParentSessionToken(matched.id);
    const res = NextResponse.json({
      ok: true,
      student: {
        id: matched.id,
        name: matched.name,
        className: matched.classRoom.name,
      },
    });
    res.cookies.set(parentCookieName(), token, parentCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[parent verify]", err);
    return NextResponse.json({ error: "Gagal verifikasi" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(parentCookieName(), "", { ...parentCookieOptions(), maxAge: 0 });
  return res;
}
