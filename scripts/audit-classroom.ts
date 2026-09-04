/**
 * Audit Kelas, Jurnal, Penilaian, dan ekspor PDF.
 * Jalankan: npx tsx scripts/audit-classroom.ts
 */
import { PrismaClient } from "@prisma/client";
import { buildWeeklyJournalMarkdown, weekRange } from "../src/lib/export-journal-weekly";
import { exportToPdf } from "../src/lib/export";
import { scoreToPredikat } from "../src/lib/grading";

const prisma = new PrismaClient();

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const demoTeacher = await prisma.user.findUnique({
    where: { email: "guru@demo.sch.id" },
    include: {
      classRooms: {
        where: { isActive: true },
        include: {
          students: { where: { isActive: true } },
          journals: true,
          assessments: {
            include: {
              gradeRecords: true,
            },
          },
        },
      },
      dailyJournals: true,
      assessments: true,
    },
  });

  checks.push({
    name: "Demo guru ditemukan",
    ok: !!demoTeacher,
    detail: demoTeacher?.email ?? "missing",
  });

  const demoClass = demoTeacher?.classRooms.find((c) => c.name === "8A");
  checks.push({
    name: "Kelas demo 8A ada",
    ok: !!demoClass,
    detail: demoClass ? `${demoClass.students.length} siswa` : "missing",
  });

  checks.push({
    name: "Kelas punya siswa aktif",
    ok: (demoClass?.students.length ?? 0) >= 5,
    detail: `count=${demoClass?.students.length ?? 0}`,
  });

  checks.push({
    name: "Jurnal demo ter-seed",
    ok: (demoTeacher?.dailyJournals.length ?? 0) >= 2,
    detail: `count=${demoTeacher?.dailyJournals.length ?? 0}`,
  });

  checks.push({
    name: "Penilaian demo ter-seed",
    ok: (demoTeacher?.assessments.length ?? 0) >= 2,
    detail: `count=${demoTeacher?.assessments.length ?? 0}`,
  });

  const quiz = demoClass?.assessments.find((a) => a.title.includes("ULH"));
  const gradedQuiz = quiz?.gradeRecords.filter((r) => r.score != null).length ?? 0;
  checks.push({
    name: "ULH punya nilai lengkap",
    ok: gradedQuiz >= 5,
    detail: `${gradedQuiz} nilai tercatat`,
  });

  if (quiz && quiz.gradeRecords[0]?.score != null) {
    const predikat = scoreToPredikat(quiz.gradeRecords[0].score!, quiz.maxScore);
    checks.push({
      name: "Konversi predikat nilai",
      ok: ["A", "B", "C", "D", "E"].includes(predikat),
      detail: `score=${quiz.gradeRecords[0].score} → ${predikat}`,
    });
  }

  const { from, to } = weekRange();
  const weekJournals = await prisma.dailyJournal.findMany({
    where: {
      teacherId: demoTeacher?.id,
      date: {
        gte: new Date(from + "T00:00:00"),
        lte: new Date(to + "T00:00:00"),
      },
    },
    include: { classRoom: { select: { name: true } } },
  });

  const markdown = buildWeeklyJournalMarkdown(
    demoTeacher?.name || "Guru Demo",
    from,
    to,
    weekJournals
  );
  checks.push({
    name: "Markdown rekap jurnal terbentuk",
    ok: markdown.includes("Rekap Jurnal") && markdown.length > 50,
    detail: `${weekJournals.length} entri minggu ini`,
  });

  try {
    const pdf = await exportToPdf("Rekap Jurnal Test", markdown);
    checks.push({
      name: "PDF rekap jurnal dapat di-generate",
      ok: pdf.length > 1000,
      detail: `${pdf.length} bytes`,
    });
  } catch (e) {
    checks.push({
      name: "PDF rekap jurnal dapat di-generate",
      ok: false,
      detail: e instanceof Error ? e.message : "error",
    });
  }

  if (demoClass) {
    const assessments = await prisma.assessment.findMany({
      where: { classRoomId: demoClass.id },
      include: { gradeRecords: true },
    });
    const students = demoClass.students;
    const reportOk = students.every((s) => {
      const hasRecords = assessments.every((a) =>
        a.gradeRecords.some((r) => r.studentId === s.id)
      );
      return hasRecords;
    });
    checks.push({
      name: "Setiap siswa punya baris nilai per penilaian",
      ok: reportOk && assessments.length > 0,
      detail: `${students.length} siswa × ${assessments.length} penilaian`,
    });
  }

  const journalsWithClassId = await prisma.dailyJournal.findMany({
    where: { classRoomId: { not: null } },
    select: { id: true, classRoomId: true },
  });
  let brokenJournals = 0;
  for (const j of journalsWithClassId) {
    const room = await prisma.classRoom.findUnique({
      where: { id: j.classRoomId! },
    });
    if (!room) brokenJournals++;
  }
  checks.push({
    name: "Jurnal terhubung ke kelas yang valid",
    ok: brokenJournals === 0,
    detail: brokenJournals ? `${brokenJournals} rusak` : "ok",
  });

  const orphanGrade = await prisma.gradeRecord.findFirst({
    where: {
      student: { isActive: false },
      score: { not: null },
    },
  });
  checks.push({
    name: "Tidak ada nilai pada siswa nonaktif",
    ok: !orphanGrade,
    detail: orphanGrade ? orphanGrade.id : "ok",
  });

  const duplicateAssessment = await prisma.assessment.groupBy({
    by: ["classRoomId", "title", "date", "mapel"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  checks.push({
    name: "Tidak ada penilaian duplikat",
    ok: duplicateAssessment.length === 0,
    detail: duplicateAssessment.length ? `${duplicateAssessment.length} duplikat` : "ok",
  });

  printReport(checks);
}

function printReport(checks: Check[]) {
  console.log("\n=== Audit Kelas · Jurnal · Penilaian ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "✓" : "✗"} ${c.name}`);
    console.log(`  ${c.detail}\n`);
  }
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  console.log(`Hasil: ${passed}/${checks.length} lulus, ${failed} gagal`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
