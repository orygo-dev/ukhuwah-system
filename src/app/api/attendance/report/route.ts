import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { parseDateOnly, todayDateString } from "@/lib/attendance";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke rekap absensi guru.");
  }

  const { searchParams } = new URL(req.url);
  const classRoomId = searchParams.get("classRoomId");
  if (!classRoomId) {
    return NextResponse.json({ error: "classRoomId wajib" }, { status: 400 });
  }

  const room = await getClassRoomForUser(classRoomId, session.user);
  if (!room) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }

  const from = searchParams.get("from") || todayDateString();
  const to = searchParams.get("to") || todayDateString();
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
  }

  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (fromDate > toDate) {
    return NextResponse.json(
      { error: "Tanggal mulai tidak boleh melewati tanggal akhir" },
      { status: 400 }
    );
  }

  const students = await prisma.student.findMany({
    where: { classRoomId, isActive: true },
    orderBy: { name: "asc" },
  });

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      classRoomId,
      date: {
        gte: fromDate,
        lte: toDate,
      },
    },
    include: { records: true },
    orderBy: { date: "asc" },
  });

  const byStudent: Record<
    string,
    { present: number; excused: number; sick: number; absent: number; total: number }
  > = {};

  for (const s of students) {
    byStudent[s.id] = { present: 0, excused: 0, sick: 0, absent: 0, total: 0 };
  }

  for (const sess of sessions) {
    for (const rec of sess.records) {
      const row = byStudent[rec.studentId];
      if (!row) continue;
      row.total++;
      if (rec.status === "PRESENT") row.present++;
      else if (rec.status === "EXCUSED") row.excused++;
      else if (rec.status === "SICK") row.sick++;
      else if (rec.status === "ABSENT") row.absent++;
    }
  }

  const report = students.map((s) => {
    const counts = byStudent[s.id];
    const pct =
      counts.total > 0
        ? Math.round((counts.present / counts.total) * 100)
        : 0;
    return {
      studentId: s.id,
      nis: s.nis,
      name: s.name,
      gender: s.gender,
      ...counts,
      attendancePercent: pct,
    };
  });

  const sessionDates = sessions.map((s) => s.date.toISOString().slice(0, 10));

  return NextResponse.json({
    classRoom: { id: room.id, name: room.name },
    from,
    to,
    sessionCount: sessions.length,
    sessionDates,
    report,
  });
}
