import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageClassRosterForUser,
  getStudentForUser,
} from "@/lib/attendance-access";
import {
  createStudentLoginUser,
  describeStudentAccountError,
  isUniqueConstraintError,
  StudentAccountConflictError,
} from "@/lib/student-accounts";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const accountSchema = z.object({
  email: z.string().trim().email("Email siswa tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  name: z.string().trim().min(2).max(120).optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await params;
    const student = await getStudentForUser(id, session.user);
    if (!student) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }

    if (!(await canManageClassRosterForUser(student.classRoom, session.user))) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses mengaktifkan akun siswa ini" },
        { status: 403 }
      );
    }

    if (student.userId) {
      return NextResponse.json(
        { error: "Akun login siswa sudah aktif" },
        { status: 409 }
      );
    }

    if (!student.isActive) {
      return NextResponse.json(
        { error: "Siswa tidak aktif. Aktifkan kembali siswa sebelum membuat akun login." },
        { status: 409 }
      );
    }

    const input = accountSchema.safeParse(await req.json().catch(() => ({})));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.errors[0]?.message || "Data akun siswa tidak valid" },
        { status: 400 }
      );
    }

    const user = await prisma.$transaction(async (tx) =>
      createStudentLoginUser(tx, {
        email: input.data.email,
        password: input.data.password,
        name: input.data.name || student.name,
        schoolId: student.classRoom.schoolId,
        studentId: student.id,
      })
    );

    return NextResponse.json({ success: true, user });
  } catch (error) {
    if (error instanceof StudentAccountConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "Email sudah digunakan atau akun siswa sudah aktif" },
        { status: 409 }
      );
    }
    const described = describeStudentAccountError(error);
    console.error("[student account POST]", error);
    return NextResponse.json(
      { error: described || "Gagal mengaktifkan akun siswa" },
      { status: described ? 400 : 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await params;
    const student = await getStudentForUser(id, session.user);
    if (!student) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }

    if (!(await canManageClassRosterForUser(student.classRoom, session.user))) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses mereset password siswa ini" },
        { status: 403 }
      );
    }

    if (!student.userId) {
      return NextResponse.json(
        { error: "Akun login siswa belum aktif" },
        { status: 409 }
      );
    }

    const input = resetPasswordSchema.safeParse(await req.json().catch(() => ({})));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.errors[0]?.message || "Password baru tidak valid" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: student.userId },
      data: {
        passwordHash: await bcrypt.hash(input.data.password, 12),
        authVersion: { increment: 1 },
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[student account PATCH]", error);
    return NextResponse.json(
      { error: "Gagal mereset password siswa" },
      { status: 500 }
    );
  }
}
