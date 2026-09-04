import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { loadAssignmentWorkbook } from "../src/lib/assignment-workbook";
import { parseTkaQuestionSheet } from "../src/lib/tka-question-import";

function workbookWithRows(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Soal");
  sheet.addRows([
    ["No", "Jenis", "Kesulitan", "Stimulus", "Pertanyaan", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E", "Opsi F", "Kunci", "Kompetensi", "Pembahasan"],
    ...rows,
  ]);
  return sheet;
}

test("official TKA template is readable, safe to import blank, and documents every column", async () => {
  const workbook = await loadAssignmentWorkbook(readFileSync(resolve("public/templates/template-soal-tka-genpro.xlsx")));
  const sheet = workbook.getWorksheet("Soal");
  const guide = workbook.getWorksheet("Petunjuk");
  assert.ok(sheet);
  assert.ok(guide);
  assert.equal(sheet.getCell("B1").text, "Jenis");
  assert.equal(sheet.getCell("N1").text, "Pembahasan");
  assert.equal(sheet.getCell("B2").text, "");
  assert.match(guide.getCell("B4").text, /SINGLE_CHOICE/);
});

test("TKA import parses single and complex keys without numeric-key ambiguity", () => {
  const sheet = workbookWithRows([
    [1, "SINGLE_CHOICE", "MEDIUM", "Koperasi membandingkan empat paket dengan isi dan harga berbeda.", "Paket mana yang mempunyai harga satuan paling rendah?", "Paket A", "Paket B", "Paket C", "Paket D", "", "", "B", "Penalaran kuantitatif", "Harga satuan dihitung dengan membagi harga paket dengan jumlah barang."],
    [2, "MULTIPLE_CHOICE", "HARD", "Data suhu empat kota dicatat pada pagi dan siang hari untuk dibandingkan.", "Pilih dua simpulan yang didukung secara langsung oleh data tersebut.", "Simpulan satu", "Simpulan dua", "Simpulan tiga", "Simpulan empat", "", "", "A,C", "Interpretasi data", "Selisih setiap pasangan data menunjukkan bahwa simpulan satu dan tiga benar."],
  ]);
  const parsed = parseTkaQuestionSheet(sheet);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.drafts.length, 2);
  assert.deepEqual(parsed.drafts[0].correctAnswers, [1]);
  assert.deepEqual(parsed.drafts[1].correctAnswers, [0, 2]);
});

test("TKA import reports exact rows and route persists only after all rows pass", () => {
  const sheet = workbookWithRows([
    [1, "SINGLE_CHOICE", "MEDIUM", "Konteks yang cukup panjang untuk sebuah pertanyaan.", "Pertanyaan ini memiliki opsi yang terputus di tengah urutan?", "A", "", "C", "D", "", "", "Z", "Kompetensi", "Pembahasan lengkap untuk jawaban yang benar."],
  ]);
  const parsed = parseTkaQuestionSheet(sheet);
  assert.equal(parsed.drafts.length, 0);
  assert.ok(parsed.errors.every((error) => error.row === 2));
  assert.match(parsed.errors.map((error) => error.message).join(" "), /sel kosong|huruf A–F/);

  const route = readFileSync(resolve("src/app/api/tka/questions/import/route.ts"), "utf8");
  assert.match(route, /if \(errors\.length\) return errorResponse\(errors\)/);
  assert.match(route, /prisma\.\$transaction/);
});

test("question and package management protect history and concurrent edits", () => {
  const question = readFileSync(resolve("src/app/api/tka/questions/[id]/route.ts"), "utf8");
  const packageRoute = readFileSync(resolve("src/app/api/tka/packages/[id]/route.ts"), "utf8");
  assert.match(question, /where: \{ id, version: body\.version/);
  assert.match(question, /TransactionIsolationLevel\.Serializable/);
  assert.match(question, /packageLinks: true, answers: true/);
  assert.match(packageRoute, /TKA_PACKAGE_LOCKED/);
  assert.match(packageRoute, /TransactionIsolationLevel\.Serializable/g);
  assert.match(packageRoute, /attempts > 0[\s\S]*status: "ARCHIVED"/);
});

test("student answers are serialized and solution keys remain conditional", () => {
  const attempt = readFileSync(resolve("src/app/api/student/tka/attempts/[id]/route.ts"), "utf8");
  const page = readFileSync(resolve("src/app/student/tka/[id]/page.tsx"), "utf8");
  assert.match(attempt, /TransactionIsolationLevel\.Serializable/g);
  assert.match(attempt, /status: "IN_PROGRESS"/);
  assert.match(attempt, /showDiscussion \?/);
  assert.match(page, /attempt\.status !== "IN_PROGRESS" && item\.showDiscussion/);
  const getBlock = attempt.slice(attempt.indexOf("export async function GET"), attempt.indexOf("export async function PATCH"));
  assert.doesNotMatch(getBlock, /correctAnswers/);
});

test("management UI exposes the complete teacher workflow without technical answer indexes", () => {
  const source = readFileSync(resolve("src/components/tka/tka-management-client.tsx"), "utf8");
  for (const label of ["1. Bank Soal", "2. Validasi", "3. Paket", "4. Hasil", "Unduh template", "Unggah XLSX", "Duplikasi", "Arsipkan", "Analisis butir"]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /type=\{draft\.type === "SINGLE_CHOICE" \? "radio" : "checkbox"\}/);
  assert.doesNotMatch(source, /placeholder=.*indeks|Kunci jawaban.*angka/i);
});
