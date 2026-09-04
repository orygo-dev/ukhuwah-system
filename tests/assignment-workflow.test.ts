import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assignmentQuestionInputSchema,
  canRevealAssignmentSolutions,
  distributeAssignmentPoints,
  gradeStructuredAssignment,
  normalizeAssignmentOptions,
  publicAssignmentQuestion,
  type StoredAssignmentQuestion,
} from "../src/lib/assignment-engine";
import { assignmentDeadlineState, parseAssignmentDueAt } from "../src/lib/assignment-time";
import { loadAssignmentWorkbook } from "../src/lib/assignment-workbook";

const questions: StoredAssignmentQuestion[] = [
  { id: "single", type: "SINGLE_CHOICE", prompt: "Pilih", options: ["A", "B"], correctAnswer: 1, points: 20, required: true },
  { id: "multi", type: "MULTIPLE_CHOICE", prompt: "Pilih semua", options: ["A", "B", "C"], correctAnswer: [0, 2], points: 30, required: true },
  { id: "short", type: "SHORT_ANSWER", prompt: "Jawab", options: null, correctAnswer: ["Jakarta", "DKI Jakarta"], points: 20, required: true },
  { id: "essay", type: "ESSAY", prompt: "Jelaskan", options: null, correctAnswer: null, points: 30, required: true },
];

test("structured assignment grades objective items and leaves essay for teacher", () => {
  const result = gradeStructuredAssignment(questions, [
    { questionId: "single", response: 1 },
    { questionId: "multi", response: [2, 0] },
    { questionId: "short", response: "  DKI   JAKARTA " },
    { questionId: "essay", response: "Penjelasan siswa" },
  ]);
  assert.equal(result.autoScore, 70);
  assert.equal(result.fullyAutoGraded, false);
  assert.deepEqual(result.missingRequired, []);
  assert.equal(result.answers.find((answer) => answer.questionId === "essay")?.score, null);
});

test("required answers are validated by question type", () => {
  const result = gradeStructuredAssignment(questions, [
    { questionId: "single", response: null },
    { questionId: "multi", response: [] },
    { questionId: "short", response: "" },
  ]);
  assert.deepEqual(result.missingRequired.sort(), ["essay", "multi", "short", "single"]);
});

test("question schema rejects an invalid answer key", () => {
  const result = assignmentQuestionInputSchema.safeParse({
    type: "SINGLE_CHOICE",
    prompt: "Contoh",
    options: ["A", "B"],
    correctAnswer: 4,
    points: 10,
    required: true,
  });
  assert.equal(result.success, false);
});

test("text and image options remain backward compatible", () => {
  assert.deepEqual(normalizeAssignmentOptions(["Teks lama", { text: "", imageUrl: "/api/media/assignments/guru/a.png" }]), [
    { text: "Teks lama", imageUrl: null },
    { text: "", imageUrl: "/api/media/assignments/guru/a.png" },
  ]);
  const parsed = assignmentQuestionInputSchema.safeParse({
    type: "SINGLE_CHOICE",
    prompt: "Pilih gambar",
    imageUrl: "/api/media/assignments/guru/question.png",
    options: [{ text: "", imageUrl: "/api/media/assignments/guru/a.png" }, { text: "B", imageUrl: null }],
    correctAnswer: 0,
    points: 100,
    required: true,
  });
  assert.equal(parsed.success, true);
});

test("automatic weights always total exactly 100", () => {
  for (const count of [1, 3, 6, 7, 10, 100]) {
    const points = distributeAssignmentPoints(count);
    assert.equal(points.length, count);
    assert.ok(Math.abs(points.reduce((sum, value) => sum + value, 0) - 100) < 0.001);
  }
});

test("deadline uses explicit WIB time and late/closed policy", () => {
  const dueAt = parseAssignmentDueAt("2026-09-10T23:59");
  assert.equal(dueAt?.toISOString(), "2026-09-10T16:59:00.000Z");
  assert.equal(assignmentDeadlineState({ dueAt, allowLate: false, now: new Date("2026-09-10T16:58:59.000Z") }).acceptsSubmission, true);
  assert.equal(assignmentDeadlineState({ dueAt, allowLate: false, now: new Date("2026-09-10T16:59:01.000Z") }).acceptsSubmission, false);
  assert.equal(assignmentDeadlineState({ dueAt, allowLate: true, now: new Date("2026-09-10T17:00:00.000Z") }).isLate, true);
  assert.equal(assignmentDeadlineState({ dueAt, allowLate: true, submissionClosedAt: new Date(), now: new Date("2026-09-10T16:00:00.000Z") }).acceptsSubmission, false);
});

test("student payload never exposes the answer key", () => {
  const payload = publicAssignmentQuestion(questions[0]);
  assert.equal("correctAnswer" in payload, false);
});

test("solutions stay hidden while an auto-graded retry is allowed", () => {
  assert.equal(canRevealAssignmentSolutions({ status: "GRADED", allowResubmit: true, answers: [{ autoGraded: true }] }), false);
  assert.equal(canRevealAssignmentSolutions({ status: "GRADED", allowResubmit: false, answers: [{ autoGraded: true }] }), true);
  assert.equal(canRevealAssignmentSolutions({ status: "GRADED", allowResubmit: true, answers: [{ autoGraded: false }] }), true);
});

test("assignment migration is additive and MariaDB compatible", () => {
  const sql = readFileSync(resolve("prisma/migrations/202608310002_assignment_workflow/migration.sql"), "utf8");
  assert.match(sql, /ALTER TABLE `assignments`/);
  assert.match(sql, /CREATE TABLE `assignment_questions`/);
  assert.match(sql, /CREATE TABLE `assignment_submission_answers`/);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|"assignments"/i);
});

test("media and deadline migration is additive and migrates legacy deadlines to 23:59 WIB", () => {
  const sql = readFileSync(resolve("prisma/migrations/202608310003_assignment_media_deadline/migration.sql"), "utf8");
  assert.match(sql, /ADD COLUMN `due_at` DATETIME\(3\)/);
  assert.match(sql, /TIMESTAMP\(`due_date`, '16:59:59'\)/);
  assert.match(sql, /ADD COLUMN `image_url` VARCHAR\(1000\)/);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|"assignments"/i);
});

test("official XLSX template contains every supported question type", async () => {
  const workbook = await loadAssignmentWorkbook(readFileSync(resolve("public/templates/template-soal-tugas-genpro.xlsx")));
  const sheet = workbook.getWorksheet("Soal");
  assert.ok(sheet);
  assert.equal(sheet.getCell("B1").text, "Jenis");
  const types = new Set([2, 3, 4, 5, 6].map((row) => sheet.getCell(`B${row}`).text));
  for (const type of ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"]) assert.ok(types.has(type));
});

test("submit and grading routes use serializable version guards", () => {
  const submit = readFileSync(resolve("src/app/api/student/assignments/[id]/submission/route.ts"), "utf8");
  const grade = readFileSync(resolve("src/app/api/assignments/[id]/submissions/[submissionId]/route.ts"), "utf8");
  const transaction = readFileSync(resolve("src/lib/assignment-transaction.ts"), "utf8");
  assert.match(submit, /assignmentSerializableTransaction/);
  assert.match(transaction, /TransactionIsolationLevel\.Serializable/);
  assert.match(transaction, /P2034/);
  for (const source of [submit, grade]) {
    assert.match(source, /version:/);
    assert.match(source, /updateMany/);
  }
});

test("assignment structure edits and deletion recheck submissions inside serializable transactions", () => {
  const manage = readFileSync(resolve("src/app/api/assignments/[id]/route.ts"), "utf8");
  const media = readFileSync(resolve("src/app/api/assignments/media/route.ts"), "utf8");
  assert.match(manage, /assignmentSerializableTransaction/);
  assert.match(manage, /tx\.assignmentSubmission\.count/);
  assert.match(manage, /ASSIGNMENT_STRUCTURE_LOCKED/);
  assert.match(manage, /await tx\.assignment\.delete/);
  assert.match(media, /isValidAssignmentImageUrl/);
  assert.doesNotMatch(media, /value\.includes\(`/);
});
