import type ExcelJS from "exceljs";
import { assessTkaQuestionQuality } from "@/lib/tka-question-quality";

export const MAX_TKA_IMPORT_QUESTIONS = 100;

const TYPES = new Set(["SINGLE_CHOICE", "MULTIPLE_CHOICE"]);
const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"]);

export type TkaQuestionImportDraft = {
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  stimulus: string | null;
  prompt: string;
  options: string[];
  correctAnswers: number[];
  competency: string | null;
  explanation: string | null;
};

function cellText(cell: ExcelJS.Cell) {
  return cell.text.trim();
}

export function parseTkaQuestionSheet(sheet: ExcelJS.Worksheet) {
  const drafts: TkaQuestionImportDraft[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  const lastRow = Math.min(sheet.rowCount, MAX_TKA_IMPORT_QUESTIONS + 1);

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Array.from({ length: 13 }, (_, index) => cellText(row.getCell(index + 2)));
    if (!values.some(Boolean)) continue;
    const [typeRaw, difficultyRaw, stimulus, prompt, ...rest] = values;
    const optionValues = rest.slice(0, 6);
    const keyRaw = rest[6] ?? "";
    const competency = rest[7] ?? "";
    const explanation = cellText(row.getCell(14));
    const type = typeRaw.toUpperCase();
    const difficulty = difficultyRaw.toUpperCase();
    if (!TYPES.has(type)) errors.push({ row: rowNumber, message: "Jenis harus SINGLE_CHOICE atau MULTIPLE_CHOICE." });
    if (!DIFFICULTIES.has(difficulty)) errors.push({ row: rowNumber, message: "Kesulitan harus EASY, MEDIUM, atau HARD." });
    const lastOption = optionValues.reduce((last, option, index) => option ? index : last, -1);
    const options = optionValues.slice(0, lastOption + 1);
    if (options.some((option) => !option)) errors.push({ row: rowNumber, message: "Opsi tidak boleh memiliki sel kosong di tengah urutan." });
    const keyLetters = [...new Set(keyRaw.toUpperCase().split(",").map((value) => value.trim()).filter(Boolean))];
    const invalidKey = keyLetters.some((letter) => !/^[A-F]$/.test(letter));
    if (invalidKey) errors.push({ row: rowNumber, message: "Kunci harus berupa huruf A–F, dipisahkan koma untuk jawaban kompleks." });
    const correctAnswers = keyLetters.map((letter) => letter.charCodeAt(0) - 65);
    const candidate: TkaQuestionImportDraft = {
      type: type as TkaQuestionImportDraft["type"],
      difficulty: difficulty as TkaQuestionImportDraft["difficulty"],
      stimulus: stimulus || null,
      prompt,
      options,
      correctAnswers,
      competency: competency || null,
      explanation: explanation || null,
    };
    if (prompt.length > 5000 || stimulus.length > 10000 || options.some((option) => option.length > 1000) || competency.length > 200 || explanation.length > 5000) {
      errors.push({ row: rowNumber, message: "Salah satu isian melebihi batas panjang yang diizinkan." });
    }
    if (TYPES.has(type) && DIFFICULTIES.has(difficulty) && !invalidKey) {
      const quality = assessTkaQuestionQuality(candidate, false);
      for (const message of quality.errors) errors.push({ row: rowNumber, message });
      if (!quality.errors.length) drafts.push(candidate);
    }
  }
  if (sheet.rowCount > MAX_TKA_IMPORT_QUESTIONS + 1) errors.push({ row: MAX_TKA_IMPORT_QUESTIONS + 2, message: `Maksimal ${MAX_TKA_IMPORT_QUESTIONS} soal per impor.` });
  if (!drafts.length && !errors.length) errors.push({ row: 2, message: "Template belum berisi soal." });
  return { drafts, errors };
}
