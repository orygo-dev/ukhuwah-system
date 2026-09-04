import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { getJournalForUser } from "@/lib/journal-access";
import { parseDateOnly } from "@/lib/daily-journal";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";
import { readRequestJson } from "@/lib/http-json";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  classRoomId: z.string().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mapel: z.string().trim().min(1).max(120).optional(),
  jamKe: z.number().int().min(0).max(12).optional(),
  materi: z.string().trim().min(1).max(200).optional(),
  tujuanPembelajaran: z.string().trim().max(2000).nullable().optional(),
  kegiatan: z.string().trim().max(4000).nullable().optional(),
  evaluasi: z.string().trim().max(2000).nullable().optional(),
  refleksi: z.string().trim().max(2000).nullable().optional(),
  tindakLanjut: z.string().trim().max(2000).nullable().optional(),
  kendala: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["DRAFT", "FINAL"]).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke jurnal guru.");
  }

  const { id } = await params;
  const journal = await getJournalForUser(id, session.user);
  if (!journal) {
    return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ journal });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat mengubah jurnal harian.");
  }

  const { id } = await params;
  const existing = await getJournalForUser(id, session.user);
  if (!existing || existing.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 });
  }

  try {
    const raw = await readRequestJson(req);
    if (raw == null) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const body = patchSchema.parse(raw);

    if (
      existing.attendanceSessionId &&
      body.classRoomId !== undefined &&
      body.classRoomId !== existing.classRoomId
    ) {
      return NextResponse.json(
        { error: "Jurnal yang terhubung ke sesi absensi tidak bisa dipindahkan ke kelas lain." },
        { status: 400 }
      );
    }

    if (body.classRoomId) {
      const room = await getClassRoomForUser(body.classRoomId, session.user);
      if (!room) {
        return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
      }
      if (!room.isActive) {
        return NextResponse.json(
          { error: "Kelas sudah dinonaktifkan dan tidak bisa dipakai untuk jurnal." },
          { status: 400 }
        );
      }
    }

    const journal = await prisma.dailyJournal.update({
      where: { id },
      data: {
        ...(body.classRoomId !== undefined ? { classRoomId: body.classRoomId } : {}),
        ...(body.date ? { date: parseDateOnly(body.date) } : {}),
        ...(body.mapel ? { mapel: body.mapel } : {}),
        ...(body.jamKe !== undefined ? { jamKe: body.jamKe } : {}),
        ...(body.materi ? { materi: body.materi } : {}),
        ...(body.tujuanPembelajaran !== undefined
          ? { tujuanPembelajaran: body.tujuanPembelajaran || null }
          : {}),
        ...(body.kegiatan !== undefined ? { kegiatan: body.kegiatan || null } : {}),
        ...(body.evaluasi !== undefined ? { evaluasi: body.evaluasi || null } : {}),
        ...(body.refleksi !== undefined ? { refleksi: body.refleksi || null } : {}),
        ...(body.tindakLanjut !== undefined
          ? { tindakLanjut: body.tindakLanjut || null }
          : {}),
        ...(body.kendala !== undefined ? { kendala: body.kendala || null } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
      include: {
        classRoom: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ journal });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    console.error("[journals PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui jurnal" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat menghapus jurnal harian.");
  }

  const { id } = await params;
  const existing = await getJournalForUser(id, session.user);
  if (!existing || existing.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 });
  }

  await prisma.dailyJournal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
