import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canArchiveClassForUser,
  canEditClassMetaForUser,
  getClassRoomForUser,
} from "@/lib/attendance-access";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";
import { revokeStudentLoginUser } from "@/lib/student-accounts";
import { isCanonicalJenjang } from "@/lib/curriculum";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  jenjang: z.string().trim().refine(isCanonicalJenjang, "Jenjang tidak valid").optional(),
  tahunAjaran: z.string().trim().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke data kelas guru.");
  }

  const { id } = await params;
  const room = await getClassRoomForUser(id, session.user);
  if (!room) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }

  const classRoom = await prisma.classRoom.findUnique({
    where: { id },
    include: {
      students: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          nis: true,
          name: true,
          gender: true,
          parentAccessEnabled: true,
          user: { select: { email: true } },
          _count: { select: { records: true, gradeRecords: true } },
        },
      },
      teacher: { select: { id: true, name: true, email: true } },
      sessions: {
        orderBy: { date: "desc" },
        take: 10,
        include: {
          _count: { select: { records: true } },
        },
      },
      _count: {
        select: {
          students: { where: { isActive: true } },
          sessions: true,
        },
      },
    },
  });

  return NextResponse.json({ classRoom });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak dapat mengubah kelas.");
  }

  const { id } = await params;
  const room = await getClassRoomForUser(id, session.user);
  if (!room) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }

  try {
    if (!(await canEditClassMetaForUser(room, session.user))) {
      return NextResponse.json(
        { error: "Anda hanya bisa mengubah kelas yang Anda kelola atau kelas dalam sekolah Anda." },
        { status: 403 }
      );
    }
    const body = patchSchema.parse(await req.json().catch(() => null));
    const classRoom = await prisma.classRoom.update({
      where: { id },
      data: {
        ...body,
        name: body.name?.trim(),
        jenjang: body.jenjang?.trim(),
        tahunAjaran: body.tahunAjaran?.trim(),
      },
      include: {
        _count: { select: { students: true, sessions: true } },
      },
    });
    return NextResponse.json({ classRoom });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Kelas dengan nama dan tahun ajaran yang sama sudah ada." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Gagal memperbarui kelas" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak dapat mengarsipkan kelas.");
  }

  const { id } = await params;
  const room = await getClassRoomForUser(id, session.user);
  if (!room || !(await canArchiveClassForUser(room, session.user))) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: { classRoomId: id },
    select: { id: true, userId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.classRoom.update({
      where: { id },
      data: { isActive: false },
    });
    for (const student of students) {
      await revokeStudentLoginUser(tx, student);
    }
  });

  return NextResponse.json({ ok: true });
}
