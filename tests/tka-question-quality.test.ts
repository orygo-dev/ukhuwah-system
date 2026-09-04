import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { assessTkaQuestionQuality } from "../src/lib/tka-question-quality";

const validQuestion = {
  type: "MULTIPLE_CHOICE" as const,
  difficulty: "HARD",
  stimulus: "Dua kelompok mengikuti asesmen yang sama dengan jumlah peserta dan nilai rata-rata yang berbeda.",
  prompt: "Pernyataan manakah yang dapat dipastikan benar berdasarkan data tersebut?",
  options: ["Pernyataan pertama", "Pernyataan kedua", "Pernyataan ketiga", "Pernyataan keempat"],
  correctAnswers: [0, 2],
  explanation: "Pernyataan pertama dan ketiga diperoleh langsung dari perhitungan data agregat yang diberikan.",
  competency: "Menafsirkan data agregat",
};

test("quality gate accepts a clear publication-ready TKA question", () => {
  assert.deepEqual(assessTkaQuestionQuality(validQuestion).errors, []);
});

test("quality gate rejects duplicate distractors and ambiguous answer structures", () => {
  const duplicate = assessTkaQuestionQuality({
    ...validQuestion,
    options: ["Nilai 20", "nilai 20!", "Nilai 30"],
    correctAnswers: [0],
  });
  assert.match(duplicate.errors.join(" "), /Opsi jawaban tidak boleh sama/);
  assert.match(duplicate.errors.join(" "), /minimal dua jawaban benar/);
});

test("draft can be saved without discussion but cannot enter publication workflow", () => {
  const incomplete = { ...validQuestion, explanation: "", competency: "" };
  assert.deepEqual(assessTkaQuestionQuality(incomplete, false).errors, []);
  assert.match(assessTkaQuestionQuality(incomplete).errors.join(" "), /Pembahasan wajib/);
  assert.match(assessTkaQuestionQuality(incomplete).errors.join(" "), /Kompetensi yang diukur wajib/);
});

test("curated seed replaces the three-question demo without resetting demo credentials", () => {
  const source = readFileSync(resolve("scripts/seed-tka.ts"), "utf8");
  assert.equal(source.match(/correctAnswers: \[/g)?.length, 12);
  assert.match(source, /Penerapan dan Penalaran 2026/);
  assert.match(source, /LEGACY_PACKAGE_TITLE[\s\S]*status: "ARCHIVED"/);
  assert.doesNotMatch(source, /bcrypt|siswa123456|passwordHash/);
});

test("review transitions apply the quality gate before approval or publication", () => {
  const source = readFileSync(resolve("src/app/api/tka/questions/[id]/route.ts"), "utf8");
  assert.match(source, /\["SUBMIT", "APPROVE", "PUBLISH"\]/);
  assert.match(source, /assessTkaQuestionQuality/);
  assert.match(source, /status: 422/);
  assert.match(source, /updateMany/);
  assert.match(source, /status: question\.status/);
});
