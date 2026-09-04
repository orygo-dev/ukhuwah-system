import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { strongAdminPasswordSchema } from "@/lib/password-policy";

export const runtime = "nodejs";

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nama wajib diisi").max(120),
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter").max(100),
  role: z
    .enum(["TEACHER", "SCHOOL_ADMIN", "PROVINCE_ADMIN", "SUPER_ADMIN"])
    .default("TEACHER"),
  schoolId: z.string().trim().nullable().optional(),
  provinceId: z.string().trim().nullable().optional(),
});

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const input = createUserSchema.parse(await req.json().catch(() => ({})));
    if (input.role === "SUPER_ADMIN") {
      strongAdminPasswordSchema.parse(input.password);
    }
    const schoolId =
      input.role === "PROVINCE_ADMIN" || input.role === "SUPER_ADMIN"
        ? null
        : input.schoolId?.trim() || null;
    const provinceId =
      input.role === "PROVINCE_ADMIN" ? input.provinceId?.trim() || null : null;

    if (input.role === "SCHOOL_ADMIN" && !schoolId) {
      return NextResponse.json(
        { error: "Admin sekolah wajib ditautkan ke sekolah." },
        { status: 400 }
      );
    }
    if (input.role === "PROVINCE_ADMIN" && !provinceId) {
      return NextResponse.json(
        { error: "Admin dinas wajib ditautkan ke provinsi." },
        { status: 400 }
      );
    }

    if (schoolId) {
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true },
      });
      if (!school) {
        return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 400 });
      }
    }
    if (provinceId) {
      const province = await prisma.province.findUnique({
        where: { id: provinceId },
        select: { id: true },
      });
      if (!province) {
        return NextResponse.json({ error: "Provinsi tidak ditemukan" }, { status: 400 });
      }
    }

    const freePlan = await prisma.subscriptionPlan.findUnique({
      where: { slug: "free" },
      select: { id: true },
    });

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: await bcrypt.hash(input.password, 12),
        role: input.role,
        schoolId,
        provinceId,
        creditsRemaining: input.role === "TEACHER" ? 10 : 0,
        planId: freePlan?.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        schoolId: true,
        provinceId: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[admin users POST]", err);
    return NextResponse.json({ error: "Gagal membuat pengguna" }, { status: 500 });
  }
}
