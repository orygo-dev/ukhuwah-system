import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STUDENT_BOARD_VISIBILITY,
  studentBoardVisibilityClauses,
} from "../src/lib/student-board-visibility";
import {
  STUDENT_BOARD_DAILY_REPORT_LIMIT,
  STUDENT_BOARD_REPORT_REASONS,
} from "../src/lib/student-board-reports";

test("mading baru menggunakan Publik GenPro sebagai default authoritative", () => {
  assert.equal(DEFAULT_STUDENT_BOARD_VISIBILITY, "GLOBAL");
});

test("akses mading memisahkan publik, sekolah, dan kelas", () => {
  assert.deepEqual(
    studentBoardVisibilityClauses({
      classRoomId: "class-a",
      schoolId: "school-a",
    }),
    [
      { visibility: "GLOBAL" },
      { visibility: "CLASS", classRoomId: "class-a" },
      { visibility: "SCHOOL", classRoom: { schoolId: "school-a" } },
    ],
  );
});

test("kelas tanpa sekolah tidak berbagi konten SCHOOL dengan kelas lain", () => {
  const clauses = studentBoardVisibilityClauses({
    classRoomId: "class-unassigned",
    schoolId: null,
  });
  assert.deepEqual(clauses[2], {
    visibility: "SCHOOL",
    classRoomId: "class-unassigned",
  });
});

test("alasan laporan unik dan batas harian bersifat terbatas", () => {
  assert.equal(
    new Set(STUDENT_BOARD_REPORT_REASONS).size,
    STUDENT_BOARD_REPORT_REASONS.length,
  );
  assert.ok(STUDENT_BOARD_REPORT_REASONS.includes("PRIVACY"));
  assert.ok(STUDENT_BOARD_DAILY_REPORT_LIMIT > 0);
  assert.ok(STUDENT_BOARD_DAILY_REPORT_LIMIT <= 20);
});
