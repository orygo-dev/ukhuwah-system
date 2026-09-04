import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parentCookieName, verifyParentSessionToken } from "@/lib/parent-access";
import {
  buildClassGradeReport,
  buildStudentAttendanceSummary,
} from "@/lib/semester-report";
import { currentSemester, parseSemester } from "@/lib/semester";
import { parseTeacherProfile } from "@/lib/teacher-profile";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(parentCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = verifyParentSessionToken(token);
  if (!studentId) {
    return NextResponse.json({ error: "Sesi kedaluwarsa" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId, isActive: true, parentAccessEnabled: true },
    include: {
      classRoom: {
        include: {
          teacher: { select: { name: true, profileDefaults: true } },
          school: { select: { name: true } },
        },
      },
    },
  });

  if (!student || !student.classRoom.isActive) {
    return NextResponse.json({ error: "Akses tidak valid" }, { status: 404 });
  }

  const teacherProfile = parseTeacherProfile(student.classRoom.teacher);
  const tahunAjaran =
    teacherProfile.tahunAjaran || student.classRoom.tahunAjaran;
  const semester = parseSemester(teacherProfile.semester) || currentSemester();

  const grades = await buildClassGradeReport({
    classRoomId: student.classRoomId,
    semester,
    tahunAjaran,
    studentId: student.id,
    finalOnly: true,
  });

  const attendance = await buildStudentAttendanceSummary(
    student.id,
    student.classRoomId
  );

  const studentGrades = grades?.report[0] ?? null;

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      nis: student.nis,
      className: student.classRoom.name,
      schoolName: student.classRoom.school?.name || teacherProfile.sekolah,
      teacherName: student.classRoom.teacher.name,
    },
    semester: { label: semester, tahunAjaran },
    attendance,
    grades: studentGrades,
    assessments: grades?.assessments ?? [],
  });
}
