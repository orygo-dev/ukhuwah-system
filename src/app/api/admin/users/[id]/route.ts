import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Nama wajib diisi").max(120).optional(),
  email: z.string().trim().email("Email tidak valid").optional(),
  role: z.enum(["TEACHER", "SCHOOL_ADMIN", "PROVINCE_ADMIN"]),
  schoolId: z.string().trim().nullable().optional(),
  provinceId: z.string().trim().nullable().optional(),
  password: z.string().min(8, "Password minimal 8 karakter").max(100).optional().or(z.literal("")),
});

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const input = updateUserSchema.parse(await req.json().catch(() => ({})));

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    }
    if (user.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Role Super Admin tidak dapat diubah dari halaman ini." },
        { status: 403 }
      );
    }
    if (user.role === "STUDENT") {
      return NextResponse.json(
        { error: "Akun siswa dikelola dari data siswa, bukan dari halaman ini." },
        { status: 403 }
      );
    }

    const schoolId =
      input.role === "PROVINCE_ADMIN" ? null : input.schoolId?.trim() || null;
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

    const updated = await prisma.user.update({
      where: { id },
      data: {
        authVersion: { increment: 1 },
        ...(input.name ? { name: input.name } : {}),
        ...(input.email ? { email: input.email.toLowerCase() } : {}),
        role: input.role,
        schoolId,
        provinceId,
        ...(input.password
          ? { passwordHash: await bcrypt.hash(input.password, 12) }
          : {}),
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

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ error: "Email sudah digunakan akun lain" }, { status: 409 });
    }
    console.error("[admin users PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui pengguna" }, { status: 500 });
  }
}
