/**
 * Audit portal orang tua + rapor semester.
 * Jalankan: npx tsx scripts/audit-parent-rapor.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  buildClassGradeReport,
  buildSemesterReportMarkdown,
  buildStudentAttendanceSummary,
} from "../src/lib/semester-report";
import { exportToPdf } from "../src/lib/export";
import {
  verifyParentAccessCode,
  createParentSessionToken,
  verifyParentSessionToken,
} from "../src/lib/parent-access";
import { semesterDateRange } from "../src/lib/semester";

const prisma = new PrismaClient();

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const demoTeacher = await prisma.user.findUnique({
    where: { email: "guru@demo.sch.id" },
  });
  const demoClass = await prisma.classRoom.findFirst({
    where: { teacherId: demoTeacher?.id, name: "8A" },
  });

  const parentStudent = await prisma.student.findFirst({
    where: {
      classRoomId: demoClass?.id,
      parentAccessEnabled: true,
      parentAccessCodeHash: { not: null },
    },
  });

  checks.push({
    name: "Siswa demo punya kode orang tua",
    ok: !!parentStudent,
    detail: parentStudent?.name ?? "missing",
  });

  if (parentStudent) {
    const valid = await verifyParentAccessCode(
      "DEMO8A01",
      parentStudent.parentAccessCodeHash
    );
    checks.push({
      name: "Kode DEMO8A01 valid",
      ok: valid,
      detail: valid ? "ok" : "hash mismatch",
    });
  }

  const token = parentStudent
    ? createParentSessionToken(parentStudent.id)
    : "";
  const verifiedId = token ? verifyParentSessionToken(token) : null;
  checks.push({
    name: "Token sesi orang tua valid",
    ok: verifiedId === parentStudent?.id,
    detail: verifiedId ?? "invalid",
  });

  if (demoClass) {
    const range = semesterDateRange("2025/2026", "Ganjil");
    const report = await buildClassGradeReport({
      classRoomId: demoClass.id,
      semester: "Ganjil",
      tahunAjaran: "2025/2026",
      finalOnly: true,
    });
    checks.push({
      name: "Rapor semester kelas terbentuk",
      ok: (report?.report.length ?? 0) >= 5,
      detail: `${report?.report.length ?? 0} siswa, ${report?.assessments.length ?? 0} penilaian`,
    });

    checks.push({
      name: "Range semester Ganjil benar",
      ok: range.from === "2025-07-01" && range.to === "2025-12-31",
      detail: `${range.from} — ${range.to}`,
    });

    const withSemester = await prisma.assessment.count({
      where: {
        classRoomId: demoClass.id,
        semester: { not: null },
        tahunAjaran: { not: null },
      },
    });
    checks.push({
      name: "Penilaian punya semester & tahun ajaran",
      ok: withSemester >= 1,
      detail: `count=${withSemester}`,
    });

    if (parentStudent && report?.report[0]) {
      const attendance = await buildStudentAttendanceSummary(
        parentStudent.id,
        demoClass.id
      );
      const studentReport =
        report.report.find((r) => r.studentId === parentStudent.id) ??
        report.report[0];
      const md = buildSemesterReportMarkdown(
        studentReport.name,
        demoClass.name,
        "2025/2026",
        "Ganjil",
        studentReport,
        attendance
      );
      const pdf = await exportToPdf(`Rapor ${studentReport.name}`, md);
      checks.push({
        name: "PDF rapor semester siswa",
        ok: pdf.length > 1000,
        detail: `${pdf.length} bytes`,
      });
    }
  }

  printReport(checks);
}

function printReport(checks: Check[]) {
  console.log("\n=== Audit Portal Orang Tua & Rapor Semester ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "✓" : "✗"} ${c.name}`);
    console.log(`  ${c.detail}\n`);
  }
  const passed = checks.filter((c) => c.ok).length;
  console.log(`Hasil: ${passed}/${checks.length} lulus`);
  if (passed < checks.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
