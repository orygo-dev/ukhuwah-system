import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { mobileUnauthorized } from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();

  try {
    const data = schema.parse(await req.json());
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    });
    const valid = user
      ? await bcrypt.compare(data.currentPassword, user.passwordHash)
      : false;
    if (!user || !valid) {
      return NextResponse.json(
        { error: "Password saat ini tidak sesuai." },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(data.newPassword, 12),
        authVersion: { increment: 1 },
      },
    });
    return NextResponse.json({
      ok: true,
      message: "Password berhasil diperbarui.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Password baru minimal 8 karakter." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Password belum dapat diperbarui." },
      { status: 500 },
    );
  }
}
