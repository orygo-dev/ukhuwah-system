import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputPath = path.resolve(process.argv[2] || "public/templates/template-soal-tka-genpro.xlsx");
const previewPath = path.resolve(process.argv[3] || ".runtime/tka-template-preview.png");
const guidePreviewPath = previewPath.replace(/\.png$/i, "-guide.png");
const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Soal");
const guide = workbook.worksheets.add("Petunjuk");

sheet.showGridLines = false;
sheet.getRange("A1:N4").values = [
  ["No", "Jenis", "Kesulitan", "Stimulus / konteks", "Pertanyaan", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E", "Opsi F", "Kunci", "Kompetensi", "Pembahasan"],
  [1, "", "", "", "", "", "", "", "", "", "", "", "", ""],
  [2, "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];
sheet.getRange("A1:N1").format = {
  fill: "#155EEF",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: "#0B3AA4" },
};
sheet.getRange("A2:N4").format = {
  fill: "#F8FAFC",
  verticalAlignment: "top",
  wrapText: true,
  borders: { insideHorizontal: { style: "thin", color: "#DCE4F0" }, bottom: { style: "thin", color: "#DCE4F0" } },
};
sheet.getRange("A1:N4").format.font = { name: "Aptos", size: 10 };
sheet.getRange("A1:N1").format.font = { name: "Aptos Display", size: 10, bold: true, color: "#FFFFFF" };
sheet.getRange("A1:N1").format.rowHeight = 34;
sheet.getRange("A2:N3").format.rowHeight = 62;
sheet.getRange("A:A").format.columnWidth = 6;
sheet.getRange("B:C").format.columnWidth = 18;
sheet.getRange("D:E").format.columnWidth = 38;
sheet.getRange("F:K").format.columnWidth = 20;
sheet.getRange("L:L").format.columnWidth = 14;
sheet.getRange("M:N").format.columnWidth = 34;
sheet.getRange("B2:B101").dataValidation = { rule: { type: "list", values: ["SINGLE_CHOICE", "MULTIPLE_CHOICE"] } };
sheet.getRange("C2:C101").dataValidation = { rule: { type: "list", values: ["EASY", "MEDIUM", "HARD"] } };
sheet.freezePanes.freezeRows(1);

guide.showGridLines = false;
guide.getRange("A1:F1").merge();
guide.getRange("A1").values = [["Panduan Template Soal TKA GenPro"]];
guide.getRange("A1:F1").format = { fill: "#155EEF", font: { name: "Aptos Display", size: 18, bold: true, color: "#FFFFFF" }, verticalAlignment: "center" };
guide.getRange("A1:F1").format.rowHeight = 42;
guide.getRange("A3:B11").values = [
  ["Kolom", "Cara mengisi"],
  ["Jenis", "Pilih SINGLE_CHOICE untuk satu jawaban benar atau MULTIPLE_CHOICE untuk lebih dari satu."],
  ["Kesulitan", "Pilih EASY, MEDIUM, atau HARD."],
  ["Stimulus", "Isi konteks, kasus, data, atau bacaan. Boleh kosong untuk soal sederhana."],
  ["Pertanyaan", "Wajib jelas dan minimal 12 karakter."],
  ["Opsi A–F", "Isi minimal tiga opsi. Jangan menyisakan celah di tengah urutan opsi."],
  ["Kunci", "Gunakan huruf. Contoh: B untuk tunggal; A,C untuk kompleks."],
  ["Kompetensi", "Tulis kemampuan spesifik yang diukur."],
  ["Pembahasan", "Jelaskan proses dan alasan jawaban; jangan hanya menulis huruf kunci."],
];
guide.getRange("A3:B3").format = { fill: "#DBEAFE", font: { bold: true, color: "#153E75" } };
guide.getRange("A3:B11").format.wrapText = true;
guide.getRange("A3:B11").format.verticalAlignment = "top";
guide.getRange("A3:B11").format.borders = { insideHorizontal: { style: "thin", color: "#DCE4F0" }, bottom: { style: "thin", color: "#DCE4F0" } };
guide.getRange("A:A").format.columnWidth = 22;
guide.getRange("B:B").format.columnWidth = 82;
guide.getRange("A13:F13").merge();
guide.getRange("A13").values = [["Impor bersifat atomik: jika satu baris salah, tidak ada soal yang disimpan. Perbaiki baris yang disebutkan lalu unggah kembali."]];
guide.getRange("A13:F13").format = { fill: "#FFF7D6", font: { color: "#854D0E", bold: true }, wrapText: true };
guide.getRange("A13:F13").format.rowHeight = 38;
guide.getRange("A15:F15").merge();
guide.getRange("A15").values = [["Contoh ringkas: SINGLE_CHOICE · MEDIUM · 4 opsi · kunci B. Untuk MULTIPLE_CHOICE gunakan minimal dua kunci, misalnya A,C."]];
guide.getRange("A15:F15").format = { fill: "#E0F2FE", font: { color: "#075985", bold: true }, wrapText: true };
guide.getRange("A15:F15").format.rowHeight = 34;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(path.dirname(previewPath), { recursive: true });
const preview = await workbook.render({ sheetName: "Soal", range: "A1:N4", scale: 1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
const guidePreview = await workbook.render({ sheetName: "Petunjuk", range: "A1:F15", scale: 1, format: "png" });
await fs.writeFile(guidePreviewPath, new Uint8Array(await guidePreview.arrayBuffer()));
const check = await workbook.inspect({ kind: "table", range: "Soal!A1:N4", include: "values,formulas", tableMaxRows: 4, tableMaxCols: 14 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: "formula error scan" });
console.log(errors.ndjson);
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
await fs.rm(`${outputPath}.inspect.ndjson`, { force: true });
console.log(JSON.stringify({ outputPath, previewPath, guidePreviewPath }));
