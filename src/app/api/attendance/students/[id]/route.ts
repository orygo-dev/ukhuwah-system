import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageClassRosterForUser,
  getStudentForUser,
} from "@/lib/attendance-access";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";
import { revokeStudentLoginUser } from "@/lib/student-accounts";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  nis: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  gender: z.enum(["L", "P"]).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak dapat mengubah data siswa kelas.");
  }

  const { id } = await params;
  const existing = await getStudentForUser(id, session.user);
  if (!existing) {
    return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
  }
  if (!(await canManageClassRosterForUser(existing.classRoom, session.user))) {
    return NextResponse.json(
      { error: "Anda hanya bisa mengubah siswa pada kelas yang Anda kelola atau kelas dalam sekolah Anda." },
      { status: 403 }
    );
  }

  try {
    const body = patchSchema.parse(await req.json().catch(() => null));
    const nextNis = body.nis !== undefined ? body.nis.trim() || null : undefined;
    const nextName = body.name?.trim();
    const duplicateConditions = [
      ...(nextNis ? [{ nis: nextNis }] : []),
      ...(nextName ? [{ name: { equals: nextName } }] : []),
    ];

    if (duplicateConditions.length > 0) {
      const duplicate = await prisma.student.findFirst({
        where: {
          id: { not: id },
          classRoomId: existing.classRoomId,
          isActive: true,
          OR: duplicateConditions,
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Siswa dengan NIS atau nama yang sama sudah ada di kelas ini." },
          { status: 409 }
        );
      }
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...body,
        nis: nextNis,
        name: nextName,
      },
    });
    return NextResponse.json({ student });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal memperbarui siswa" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak dapat menghapus data siswa kelas.");
  }

  const { id } = await params;
  const existing = await getStudentForUser(id, session.user);
  if (!existing) {
    return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
  }
  if (!(await canManageClassRosterForUser(existing.classRoom, session.user))) {
    return NextResponse.json(
      { error: "Anda hanya bisa menghapus siswa pada kelas yang Anda kelola atau kelas dalam sekolah Anda." },
      { status: 403 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await revokeStudentLoginUser(tx, existing);
  });

  return NextResponse.json({ ok: true });
}
