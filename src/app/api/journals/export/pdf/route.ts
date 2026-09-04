import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportToPdf } from "@/lib/export";
import { parseDateOnly } from "@/lib/daily-journal";
import { journalWhereForUser } from "@/lib/journal-access";
import { getClassRoomForUser } from "@/lib/attendance-access";
import {
  buildWeeklyJournalMarkdown,
  weekRange,
} from "@/lib/export-journal-weekly";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke export jurnal guru.");
  }

  const { searchParams } = new URL(req.url);
  const classRoomId = searchParams.get("classRoomId") || undefined;
  const defaultWeek = weekRange();
  const from = searchParams.get("from") || defaultWeek.from;
  const to = searchParams.get("to") || defaultWeek.to;
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

  if (classRoomId) {
    const room = await getClassRoomForUser(classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, schoolId: true },
  });

  const journals = await prisma.dailyJournal.findMany({
    where: {
      ...journalWhereForUser(session.user, user?.schoolId),
      ...(classRoomId ? { classRoomId } : {}),
      date: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: [{ date: "asc" }, { jamKe: "asc" }],
    include: {
      classRoom: { select: { name: true } },
      teacher: { select: { name: true } },
    },
  });

  const markdown = buildWeeklyJournalMarkdown(
    user?.name || session.user.name || "Guru",
    from,
    to,
    journals
  );

  const title = `Rekap Jurnal ${from} - ${to}`;
  const buffer = await exportToPdf(title, markdown);
  const safeName = `rekap-jurnal-${from}-${to}`.replace(/[^a-zA-Z0-9-_]/g, "");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
    },
  });
}
