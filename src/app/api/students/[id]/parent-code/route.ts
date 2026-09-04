import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageClassRosterForUser,
  getStudentForUser,
} from "@/lib/attendance-access";
import {
  generateParentAccessCode,
  hashParentAccessCode,
  parentAccessCodeLookupKey,
} from "@/lib/parent-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getStudentForUser(id, session.user);
  if (!existing) {
    return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
  }
  if (!(await canManageClassRosterForUser(existing.classRoom, session.user))) {
    return NextResponse.json(
      { error: "Anda hanya bisa membuat kode orang tua untuk kelas yang Anda kelola atau kelas dalam sekolah Anda." },
      { status: 403 }
    );
  }
  if (!existing.isActive || !existing.classRoom.isActive) {
    return NextResponse.json(
      { error: "Siswa atau kelas sudah dinonaktifkan." },
      { status: 400 }
    );
  }

  const code = generateParentAccessCode();
  const hash = await hashParentAccessCode(code);
  const lookup = parentAccessCodeLookupKey(code);

  await prisma.student.update({
    where: { id },
    data: {
      parentAccessCodeHash: hash,
      parentAccessCodeLookup: lookup,
      parentAccessEnabled: true,
    },
  });

  return NextResponse.json({
    code,
    message: "Simpan kode ini — tidak ditampilkan lagi setelah halaman ditutup.",
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getStudentForUser(id, session.user);
  if (!existing) {
    return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
  }
  if (!(await canManageClassRosterForUser(existing.classRoom, session.user))) {
    return NextResponse.json(
      { error: "Anda hanya bisa mencabut kode orang tua untuk kelas yang Anda kelola atau kelas dalam sekolah Anda." },
      { status: 403 }
    );
  }
  if (!existing.isActive || !existing.classRoom.isActive) {
    return NextResponse.json(
      { error: "Siswa atau kelas sudah dinonaktifkan." },
      { status: 400 }
    );
  }

  await prisma.student.update({
    where: { id },
    data: {
      parentAccessCodeHash: null,
      parentAccessCodeLookup: null,
      parentAccessEnabled: false,
    },
  });

  return NextResponse.json({ ok: true });
}
