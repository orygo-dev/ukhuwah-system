import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/attendance";
import type { StudentGradeSummary } from "@/lib/grading";
import { scoreToPredikat } from "@/lib/grading";
import { semesterDateRange, type Semester } from "@/lib/semester";
import { formatDateId } from "@/lib/daily-journal";

type ReportOptions = {
  classRoomId: string;
  from?: string;
  to?: string;
  semester?: Semester;
  tahunAjaran?: string;
  studentId?: string;
  finalOnly?: boolean;
};

export async function buildClassGradeReport(options: ReportOptions) {
  const { classRoomId, studentId, finalOnly = false } = options;

  let from = options.from;
  let to = options.to;

  if (options.semester && options.tahunAjaran) {
    const range = semesterDateRange(options.tahunAjaran, options.semester);
    from = range.from;
    to = range.to;
  }

  const dateFilter =
    from && to
      ? { gte: parseDateOnly(from), lte: parseDateOnly(to) }
      : undefined;

  const room = await prisma.classRoom.findUnique({
    where: { id: classRoomId },
    select: { id: true, name: true, tahunAjaran: true, jenjang: true },
  });
  if (!room) return null;

  const assessments = await prisma.assessment.findMany({
    where: {
      classRoomId,
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(finalOnly ? { status: "FINAL" } : {}),
    },
    orderBy: { date: "asc" },
    include: {
      gradeRecords: {
        include: { student: { select: { id: true, nis: true, name: true } } },
      },
    },
  });

  const assignments = await prisma.assignment.findMany({
    where: {
      classRoomId,
      status: { in: ["PUBLISHED", "ARCHIVED"] },
      ...(dateFilter ? { OR: [{ dueDate: dateFilter }, { dueDate: null, createdAt: dateFilter }] } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: {
      submissions: {
        where: { status: "GRADED" },
        select: { studentId: true, score: true },
      },
    },
  });

  const students = await prisma.student.findMany({
    where: {
      classRoomId,
      isActive: true,
      ...(studentId ? { id: studentId } : {}),
    },
    orderBy: { name: "asc" },
  });

  const report: StudentGradeSummary[] = students.map((student) => {
    const scores = assessments.map((a) => {
      const rec = a.gradeRecords.find((r) => r.studentId === student.id);
      return {
        assessmentId: a.id,
        title: a.title,
        mapel: a.mapel,
        type: a.type,
        score: rec?.score ?? null,
        maxScore: a.maxScore,
      };
    }).concat(assignments.map((assignment) => {
      const submission = assignment.submissions.find((item) => item.studentId === student.id);
      return {
        assessmentId: `assignment:${assignment.id}`,
        title: assignment.title,
        mapel: assignment.mapel,
        type: "TUGAS" as const,
        score: submission?.score ?? null,
        maxScore: assignment.maxScore,
      };
    }));
    const graded = scores.filter((s) => s.score != null);
    const average =
      graded.length > 0
        ? graded.reduce((sum, s) => sum + (s.score! / s.maxScore) * 100, 0) /
          graded.length
        : null;

    return {
      studentId: student.id,
      nis: student.nis,
      name: student.name,
      scores,
      average: average != null ? Math.round(average * 10) / 10 : null,
      gradedCount: graded.length,
      totalAssessments: assessments.length + assignments.length,
    };
  });

  return {
    classRoom: room,
    from: from ?? null,
    to: to ?? null,
    semester: options.semester ?? null,
    tahunAjaran: options.tahunAjaran ?? null,
    assessments: assessments.map((a) => ({
      id: a.id,
      title: a.title,
      mapel: a.mapel,
      type: a.type,
      date: a.date,
      maxScore: a.maxScore,
      status: a.status,
    })).concat(assignments.map((assignment) => ({
      id: `assignment:${assignment.id}`,
      title: assignment.title,
      mapel: assignment.mapel,
      type: "TUGAS" as const,
      date: assignment.dueDate ?? assignment.createdAt,
      maxScore: assignment.maxScore,
      status: "FINAL" as const,
    }))),
    report,
  };
}

export async function buildStudentAttendanceSummary(studentId: string, classRoomId: string) {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      session: { classRoomId },
    },
    select: { status: true },
  });

  const summary = {
    present: 0,
    excused: 0,
    sick: 0,
    absent: 0,
    total: records.length,
  };
  for (const r of records) {
    if (r.status === "PRESENT") summary.present++;
    else if (r.status === "EXCUSED") summary.excused++;
    else if (r.status === "SICK") summary.sick++;
    else if (r.status === "ABSENT") summary.absent++;
  }
  const attendancePercent =
    summary.total > 0
      ? Math.round((summary.present / summary.total) * 1000) / 10
      : null;
  return { ...summary, attendancePercent };
}

export function buildSemesterReportMarkdown(
  studentName: string,
  className: string,
  tahunAjaran: string,
  semester: string,
  report: StudentGradeSummary,
  attendance: { attendancePercent: number | null; present: number; total: number }
): string {
  const lines: string[] = [
    `# Rapor Semester — ${studentName}`,
    ``,
    `**Kelas:** ${className}`,
    `**Semester:** ${semester} ${tahunAjaran}`,
    `**Kehadiran:** ${attendance.present}/${attendance.total} (${attendance.attendancePercent ?? 0}%)`,
    ``,
    `## Rekap Nilai`,
    ``,
    `| Mata Pelajaran / Penilaian | Nilai | Maks | Predikat |`,
    `| --- | --- | --- | --- |`,
  ];

  for (const s of report.scores) {
    const mapel = (s as { mapel?: string }).mapel || s.title;
    const predikat =
      s.score != null ? scoreToPredikat(s.score, s.maxScore) : "—";
    lines.push(
      `| ${mapel} — ${s.title} | ${s.score ?? "—"} | ${s.maxScore} | ${predikat} |`
    );
  }

  lines.push(
    ``,
    `**Rata-rata semester:** ${report.average != null ? `${report.average}%` : "—"}`,
    ``,
    `---`,
    ``,
    `_Dokumen ini dihasilkan otomatis dari Navalogi._`
  );

  return lines.join("\n");
}

export { formatDateId };
