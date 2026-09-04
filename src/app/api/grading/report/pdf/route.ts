import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { exportToPdf } from "@/lib/export";
import {
  buildClassGradeReport,
  buildSemesterReportMarkdown,
  buildStudentAttendanceSummary,
} from "@/lib/semester-report";
import { parseSemester, semesterLabel } from "@/lib/semester";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";

function safePdfName(value: string) {
  return value
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "rapor";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke export rapor guru.");
  }

  const { searchParams } = new URL(req.url);
  const classRoomId = searchParams.get("classRoomId");
  const studentId = searchParams.get("studentId");
  const semesterParam = searchParams.get("semester");
  const semester = parseSemester(semesterParam) || "Ganjil";
  const tahunAjaran = searchParams.get("tahunAjaran");

  if (!classRoomId || !tahunAjaran) {
    return NextResponse.json(
      { error: "classRoomId dan tahunAjaran wajib diisi" },
      { status: 400 }
    );
  }
  if (semesterParam && !parseSemester(semesterParam)) {
    return NextResponse.json({ error: "Semester tidak valid" }, { status: 400 });
  }

  const room = await getClassRoomForUser(classRoomId, session.user);
  if (!room) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }

  const data = await buildClassGradeReport({
    classRoomId,
    semester,
    tahunAjaran,
    studentId: studentId || undefined,
    finalOnly: true,
  });
  if (!data) {
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
  }

  if (studentId) {
    const studentReport = data.report[0];
    if (!studentReport) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }
    const attendance = await buildStudentAttendanceSummary(studentId, classRoomId);
    const markdown = buildSemesterReportMarkdown(
      studentReport.name,
      data.classRoom.name,
      tahunAjaran,
      semester,
      studentReport,
      attendance
    );
    const buffer = await exportToPdf(
      `Rapor ${studentReport.name}`,
      markdown
    );
    const safeName = `rapor-${safePdfName(studentReport.name)}`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  }

  const lines = [
    `# Rekap Rapor Semester — ${data.classRoom.name}`,
    ``,
    `**Semester:** ${semesterLabel(tahunAjaran, semester)}`,
    ``,
    `| Siswa | Rata-rata % | Dinilai |`,
    `| --- | --- | --- |`,
    ...data.report.map(
      (r) =>
        `| ${r.name} | ${r.average != null ? `${r.average}%` : "—"} | ${r.gradedCount}/${r.totalAssessments} |`
    ),
  ];
  const buffer = await exportToPdf(
    `Rapor Semester ${data.classRoom.name}`,
    lines.join("\n")
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapor-semester-${safePdfName(data.classRoom.name)}.pdf"`,
    },
  });
}
