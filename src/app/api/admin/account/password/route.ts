import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { readRequestJson } from "@/lib/http-json";
import { isLegacyDemoPassword, strongAdminPasswordSchema } from "@/lib/password-policy";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi").max(128),
    newPassword: strongAdminPasswordSchema,
    confirmation: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    path: ["confirmation"],
    message: "Konfirmasi password tidak sama",
  });

export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const raw = await readRequestJson(req);
    const input = passwordSchema.parse(raw);

    if (isLegacyDemoPassword(input.newPassword)) {
      return NextResponse.json(
        { error: "Password demo tidak boleh digunakan kembali." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true, role: true },
    });
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    }

    const currentValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!currentValid) {
      return NextResponse.json(
        { error: "Password saat ini tidak sesuai." },
        { status: 400 },
      );
    }
    if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
      return NextResponse.json(
        { error: "Password baru harus berbeda dari password saat ini." },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(input.newPassword, 12),
        authVersion: { increment: 1 },
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Password berhasil diperbarui. Silakan masuk kembali.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Data password tidak valid." },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[admin account password]", error);
    return NextResponse.json(
      { error: "Password belum dapat diperbarui." },
      { status: 500 },
    );
  }
}
