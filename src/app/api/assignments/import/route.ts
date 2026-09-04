import { NextResponse } from "next/server";
import type ExcelJS from "exceljs";
import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { assignmentMediaFolder } from "@/lib/assignment-media";
import { deleteStoredObject, storeObject } from "@/lib/object-storage";
import { assignmentQuestionInputSchema, type AssignmentQuestionTypeValue } from "@/lib/assignment-engine";
import { bodyTooLargeResponse, requestBodyTooLarge } from "@/lib/request-body-limit";
import { loadAssignmentWorkbook } from "@/lib/assignment-workbook";

export const runtime = "nodejs";

const MAX_IMPORT_BYTES = 15 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"]);
const IMAGE_EXTENSIONS = new Map([["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]);

function text(cell: ExcelJS.Cell) {
  return cell.text.trim();
}

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function safeImageName(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/") || /^[a-z]+:/i.test(normalized)) return null;
  return normalized.startsWith("images/") ? normalized : `images/${normalized}`;
}

function validSignature(bytes: Buffer, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Hanya guru yang dapat mengimpor soal." }, { status: 403 });
  if (requestBodyTooLarge(req, MAX_IMPORT_BYTES + 1024 * 1024)) return bodyTooLargeResponse("File impor maksimal 15 MB.");

  const storedUrls: string[] = [];
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: "Pilih file XLSX atau ZIP maksimal 15 MB." }, { status: 400 });
    }
    const input = Buffer.from(await file.arrayBuffer());
    let workbookBytes: Uint8Array = input;
    const imageFiles = new Map<string, Buffer>();

    if (file.name.toLowerCase().endsWith(".zip")) {
      const archive = await JSZip.loadAsync(input, { checkCRC32: true });
      const entries = Object.values(archive.files).filter((entry) => !entry.dir);
      if (entries.length > 110) return NextResponse.json({ error: "ZIP memiliki terlalu banyak file." }, { status: 400 });
      let total = 0;
      let xlsx: Uint8Array | null = null;
      for (const entry of entries) {
        const normalized = entry.name.replace(/\\/g, "/");
        if (normalized.includes("..") || normalized.startsWith("/")) return NextResponse.json({ error: "Struktur ZIP tidak aman." }, { status: 400 });
        const bytes = Buffer.from(await entry.async("uint8array"));
        total += bytes.length;
        if (total > MAX_UNCOMPRESSED_BYTES) return NextResponse.json({ error: "Isi ZIP melebihi batas 30 MB." }, { status: 400 });
        if (normalized.toLowerCase().endsWith(".xlsx") && !xlsx) xlsx = bytes;
        if (normalized.toLowerCase().startsWith("images/")) imageFiles.set(normalized.toLowerCase(), bytes);
      }
      if (!xlsx) return NextResponse.json({ error: "ZIP wajib berisi file XLSX." }, { status: 400 });
      workbookBytes = xlsx;
    } else if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Format file harus XLSX atau ZIP." }, { status: 400 });
    }

    const workbook = await loadAssignmentWorkbook(workbookBytes);
    const sheet = workbook.getWorksheet("Soal");
    if (!sheet) return NextResponse.json({ error: "Sheet Soal tidak ditemukan. Gunakan template resmi." }, { status: 400 });

    const drafts: Array<{
      row: number;
      type: AssignmentQuestionTypeValue;
      prompt: string;
      imageRef: string;
      points: number;
      required: boolean;
      explanation?: string;
      optionRefs: Array<{ text: string; imageRef: string }>;
      correctAnswer: number | number[] | string[] | null;
    }> = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let rowNumber = 2; rowNumber <= Math.min(sheet.rowCount, 101); rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const prompt = text(row.getCell(3));
      const typeText = text(row.getCell(2)).toUpperCase();
      if (!prompt && !typeText) continue;
      if (!TYPES.has(typeText)) {
        errors.push({ row: rowNumber, message: "Jenis soal tidak valid." });
        continue;
      }
      const type = typeText as AssignmentQuestionTypeValue;
      const points = Number(row.getCell(5).value);
      const requiredText = text(row.getCell(6)).toUpperCase();
      const optionRefs = Array.from({ length: 6 }, (_, index) => ({
        text: text(row.getCell(8 + index * 2)),
        imageRef: text(row.getCell(9 + index * 2)),
      })).filter((option) => option.text || option.imageRef);
      const key = text(row.getCell(20));
      let correctAnswer: number | number[] | string[] | null = null;
      if (type === "SINGLE_CHOICE" || type === "TRUE_FALSE") correctAnswer = key ? key.toUpperCase().charCodeAt(0) - 65 : null;
      if (type === "MULTIPLE_CHOICE") correctAnswer = key.split(",").map((value) => value.trim().toUpperCase().charCodeAt(0) - 65).filter(Number.isInteger);
      if (type === "SHORT_ANSWER") correctAnswer = key.split("|").map((value) => value.trim()).filter(Boolean);
      const candidate = {
        type,
        prompt,
        imageUrl: text(row.getCell(4)) || null,
        points,
        required: requiredText !== "TIDAK",
        explanation: text(row.getCell(7)) || undefined,
        options: optionRefs.map((option) => ({ text: option.text, imageUrl: option.imageRef || null })),
        correctAnswer,
      };
      const parsed = assignmentQuestionInputSchema.safeParse(candidate);
      if (!parsed.success) {
        errors.push({ row: rowNumber, message: parsed.error.errors[0]?.message || "Data soal tidak valid." });
        continue;
      }
      const imageRefs = [candidate.imageUrl, ...optionRefs.map((option) => option.imageRef)].filter(Boolean) as string[];
      for (const imageRef of imageRefs) {
        const name = safeImageName(imageRef);
        if (!name || !imageFiles.has(name.toLowerCase())) errors.push({ row: rowNumber, message: `File gambar ${imageRef} tidak ditemukan di folder images/.` });
      }
      drafts.push({ row: rowNumber, type, prompt, imageRef: candidate.imageUrl || "", points, required: candidate.required, explanation: candidate.explanation, optionRefs, correctAnswer });
    }
    if (sheet.rowCount > 101) errors.push({ row: 102, message: "Maksimal 100 soal per impor." });
    if (!drafts.length && !errors.length) errors.push({ row: 2, message: "Template belum berisi soal." });
    if (errors.length) return NextResponse.json({ questions: [], errors }, { status: 422 });

    const uploadedByRef = new Map<string, string>();
    const uploadImage = async (ref: string) => {
      if (!ref) return null;
      const safeName = safeImageName(ref)!;
      const cacheKey = safeName.toLowerCase();
      const existing = uploadedByRef.get(cacheKey);
      if (existing) return existing;
      const bytes = imageFiles.get(cacheKey)!;
      const ext = extension(safeName);
      const contentType = IMAGE_EXTENSIONS.get(ext);
      if (!contentType || bytes.length > MAX_IMAGE_BYTES || !validSignature(bytes, contentType)) throw new Error(`Gambar ${ref} tidak valid atau melebihi 5 MB.`);
      const stored = await storeObject({ folder: assignmentMediaFolder(session.user.id), extension: ext === "jpeg" ? "jpg" : ext, bytes, contentType, namePrefix: "import" });
      storedUrls.push(stored.url);
      uploadedByRef.set(cacheKey, stored.url);
      return stored.url;
    };

    const questions = [];
    for (const draft of drafts) {
      questions.push({
        type: draft.type,
        prompt: draft.prompt,
        imageUrl: await uploadImage(draft.imageRef),
        points: draft.points,
        required: draft.required,
        explanation: draft.explanation ?? "",
        options: await Promise.all(draft.optionRefs.map(async (option) => ({ text: option.text, imageUrl: await uploadImage(option.imageRef) }))),
        correctAnswer: draft.correctAnswer,
      });
    }
    return NextResponse.json({ questions, errors: [], uploadedUrls: storedUrls });
  } catch (error) {
    await Promise.all(storedUrls.map((url) => deleteStoredObject(url)));
    console.error("[assignment import]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membaca template soal." }, { status: 400 });
  }
}
