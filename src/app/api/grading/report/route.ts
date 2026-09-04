import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { parseDateOnly } from "@/lib/attendance";
import { buildClassGradeReport } from "@/lib/semester-report";
import { parseSemester } from "@/lib/semester";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke rekap nilai guru.");
  }

  const { searchParams } = new URL(req.url);
  const classRoomId = searchParams.get("classRoomId");
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const semesterParam = searchParams.get("semester");
  const semester = parseSemester(semesterParam) || undefined;
  const tahunAjaran = searchParams.get("tahunAjaran") || undefined;

  if (!classRoomId) {
    return NextResponse.json({ error: "classRoomId wajib diisi" }, { status: 400 });
  }
  if (semesterParam && !semester) {
    return NextResponse.json({ error: "Semester tidak valid" }, { status: 400 });
  }
  if ((from && !to) || (!from && to)) {
    return NextResponse.json(
      { error: "Tanggal mulai dan tanggal akhir harus diisi lengkap" },
      { status: 400 }
    );
  }
  if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to))) {
    return NextResponse.json({ error: "Format rentang tanggal tidak valid" }, { status: 400 });
  }

  const room = await getClassRoomForUser(classRoomId, session.user);
  if (!room) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }
  if (from && to && parseDateOnly(from) > parseDateOnly(to)) {
    return NextResponse.json(
      { error: "Tanggal mulai tidak boleh melewati tanggal akhir" },
      { status: 400 }
    );
  }

  const data = await buildClassGradeReport({
    classRoomId,
    from,
    to,
    semester,
    tahunAjaran,
  });

  return NextResponse.json(data);
}
