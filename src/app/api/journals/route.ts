import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseSubjectForClass, getClassRoomForUser, getSessionForUser } from "@/lib/attendance-access";
import { journalWhereForUser } from "@/lib/journal-access";
import { parseDateOnly } from "@/lib/daily-journal";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";
import { readRequestJson } from "@/lib/http-json";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  classRoomId: z.string().optional(),
  attendanceSessionId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mapel: z.string().trim().min(1, "Mata pelajaran wajib diisi").max(120),
  jamKe: z.number().int().min(0).max(12).optional(),
  materi: z.string().trim().min(1, "Materi wajib diisi").max(200),
  tujuanPembelajaran: z.string().trim().max(2000).optional(),
  kegiatan: z.string().trim().max(4000).optional(),
  evaluasi: z.string().trim().max(2000).optional(),
  refleksi: z.string().trim().max(2000).optional(),
  tindakLanjut: z.string().trim().max(2000).optional(),
  kendala: z.string().trim().max(2000).optional(),
  status: z.enum(["DRAFT", "FINAL"]).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke jurnal guru.");
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const classRoomId = searchParams.get("classRoomId");
  const scope = searchParams.get("scope");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const rawLimit = Number(searchParams.get("limit") || 50);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
    : 50;

  if (date && !DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
  }
  if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to))) {
    return NextResponse.json({ error: "Format rentang tanggal tidak valid" }, { status: 400 });
  }
  if ((from && !to) || (!from && to)) {
    return NextResponse.json(
      { error: "Tanggal mulai dan tanggal akhir harus diisi lengkap" },
      { status: 400 }
    );
  }
  const fromDate = from ? parseDateOnly(from) : null;
  const toDate = to ? parseDateOnly(to) : null;
  if (fromDate && toDate && fromDate > toDate) {
    return NextResponse.json(
      { error: "Tanggal mulai tidak boleh melewati tanggal akhir" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });

  const baseWhere =
    scope === "mine" && session.user.role === "TEACHER"
      ? { teacherId: session.user.id }
      : journalWhereForUser(session.user, user?.schoolId);

  const where = {
    ...baseWhere,
    ...(classRoomId ? { classRoomId } : {}),
    ...(date
      ? { date: parseDateOnly(date) }
      : fromDate && toDate
        ? {
            date: {
              gte: fromDate,
              lte: toDate,
            },
          }
        : {}),
  };

  const journals = await prisma.dailyJournal.findMany({
    where,
    orderBy: [{ date: "desc" }, { jamKe: "asc" }],
    take: limit,
    include: {
      classRoom: { select: { id: true, name: true } },
    },
  });

  const today = parseDateOnly(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`
  );
  const todayCount = await prisma.dailyJournal.count({
    where: {
      ...baseWhere,
      date: today,
    },
  });

  return NextResponse.json({ journals, todayCount });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat membuat jurnal harian.");
  }

  try {
    const raw = await readRequestJson(req);
    if (raw == null) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const body = createSchema.parse(raw);
    let classRoomId = body.classRoomId;

    const attendanceSessionId = body.attendanceSessionId;
    if (attendanceSessionId) {
      const attSession = await getSessionForUser(attendanceSessionId, session.user);
      if (!attSession || attSession.teacherId !== session.user.id) {
        return NextResponse.json({ error: "Sesi absensi tidak ditemukan" }, { status: 404 });
      }
      if (attSession.dailyJournal) {
        return NextResponse.json(
          { error: "Jurnal untuk sesi absensi ini sudah ada", journalId: attSession.dailyJournal.id },
          { status: 400 }
        );
      }
      if (!attSession.classRoom.isActive) {
        return NextResponse.json(
          { error: "Kelas pada sesi absensi ini sudah dinonaktifkan." },
          { status: 400 }
        );
      }
      if (classRoomId && classRoomId !== attSession.classRoomId) {
        return NextResponse.json(
          { error: "Kelas jurnal harus sama dengan kelas pada sesi absensi." },
          { status: 400 }
        );
      }
      classRoomId = attSession.classRoomId;
    }

    if (classRoomId) {
      const room = await getClassRoomForUser(classRoomId, session.user);
      if (!room) {
        return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
      }
      if (!room.isActive) {
        return NextResponse.json(
          { error: "Kelas sudah dinonaktifkan dan tidak bisa dipakai untuk jurnal baru." },
          { status: 400 }
        );
      }
      if (!(await canUseSubjectForClass(room, session.user, body.mapel))) {
        return NextResponse.json(
          { error: "Mata pelajaran tidak sesuai jenjang atau penugasan Anda pada kelas ini." },
          { status: 400 }
        );
      }
    }

    const journal = await prisma.dailyJournal.create({
      data: {
        teacherId: session.user.id,
        classRoomId,
        attendanceSessionId,
        date: parseDateOnly(body.date),
        mapel: body.mapel,
        jamKe: body.jamKe ?? 0,
        materi: body.materi,
        tujuanPembelajaran: body.tujuanPembelajaran || null,
        kegiatan: body.kegiatan || null,
        evaluasi: body.evaluasi || null,
        refleksi: body.refleksi || null,
        tindakLanjut: body.tindakLanjut || null,
        kendala: body.kendala || null,
        status: body.status ?? "DRAFT",
      },
      include: {
        classRoom: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ journal });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[journals POST]", err);
    return NextResponse.json({ error: "Gagal menyimpan jurnal" }, { status: 500 });
  }
}
