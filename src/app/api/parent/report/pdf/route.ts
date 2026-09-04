import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { exportToPdf } from "@/lib/export";
import { parentCookieName, verifyParentSessionToken } from "@/lib/parent-access";
import {
  buildClassGradeReport,
  buildSemesterReportMarkdown,
  buildStudentAttendanceSummary,
} from "@/lib/semester-report";
import { currentSemester, parseSemester } from "@/lib/semester";
import { parseTeacherProfile } from "@/lib/teacher-profile";

function safePdfName(value: string) {
  return value
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "rapor";
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(parentCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = verifyParentSessionToken(token);
  if (!studentId) {
    return NextResponse.json({ error: "Sesi kedaluwarsa" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const semesterParam = searchParams.get("semester");
  const tahunAjaranParam = searchParams.get("tahunAjaran");
  const semesterFromParam = parseSemester(semesterParam);

  if (semesterParam && !semesterFromParam) {
    return NextResponse.json({ error: "Semester tidak valid" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId, isActive: true, parentAccessEnabled: true },
    include: {
      classRoom: {
        include: {
          teacher: { select: { name: true, profileDefaults: true } },
        },
      },
    },
  });

  if (!student || !student.classRoom.isActive) {
    return NextResponse.json({ error: "Akses tidak valid" }, { status: 404 });
  }

  const teacherProfile = parseTeacherProfile(student.classRoom.teacher);
  const tahunAjaran =
    tahunAjaranParam || teacherProfile.tahunAjaran || student.classRoom.tahunAjaran;
  const semester =
    semesterFromParam || parseSemester(teacherProfile.semester) || currentSemester();

  const data = await buildClassGradeReport({
    classRoomId: student.classRoomId,
    semester,
    tahunAjaran,
    studentId: student.id,
    finalOnly: true,
  });

  const studentReport = data?.report[0];
  if (!studentReport) {
    return NextResponse.json({ error: "Data nilai tidak ditemukan" }, { status: 404 });
  }

  const attendance = await buildStudentAttendanceSummary(
    student.id,
    student.classRoomId
  );

  const markdown = buildSemesterReportMarkdown(
    studentReport.name,
    student.classRoom.name,
    tahunAjaran,
    semester,
    studentReport,
    attendance
  );

  const buffer = await exportToPdf(`Rapor ${student.name}`, markdown);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapor-${safePdfName(student.name)}.pdf"`,
    },
  });
}
