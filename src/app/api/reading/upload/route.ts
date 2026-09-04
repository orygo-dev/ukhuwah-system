import { NextResponse } from "next/server";
import { z } from "zod";
import { storeObject } from "@/lib/object-storage";
import { publicStoredUploadUrl } from "@/lib/upload-url";
import {
  ReadingChunkUploadError,
  receiveReadingPdfChunk,
} from "@/lib/reading-chunk-upload";
import { getReadingActor } from "@/lib/reading";
import {
  READING_PDF_MAX_BYTES,
  READING_PDF_MAX_MB,
} from "@/lib/reading-upload-limits";

export const runtime = "nodejs";

const kindSchema = z.enum(["cover", "document"]);
const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function isValidImageSignature(bytes: Buffer, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (mime === "image/webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const actor = await getReadingActor();
    if (!actor || !["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const form = await req.formData();
    const file = form.get("file");
    const kind = kindSchema.parse(form.get("kind"));
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "File wajib dipilih" }, { status: 400 });
    }

    const uploadId = String(form.get("uploadId") || "");
    if (kind === "document" && uploadId) {
      const result = await receiveReadingPdfChunk({
        actorId: actor.id,
        uploadId,
        chunkIndex: z.coerce.number().int().parse(form.get("chunkIndex")),
        totalChunks: z.coerce.number().int().parse(form.get("totalChunks")),
        totalSize: z.coerce.number().int().parse(form.get("totalSize")),
        chunk: file,
      });
      return NextResponse.json(result);
    }

    let extension = "pdf";
    let maxBytes = READING_PDF_MAX_BYTES;
    let contentType = file.type || "application/pdf";
    if (kind === "cover") {
      extension = imageTypes.get(file.type) || "";
      maxBytes = 5 * 1024 * 1024;
      contentType = file.type;
      if (!extension) {
        return NextResponse.json({ error: "Sampul harus JPG, PNG, atau WebP" }, { status: 400 });
      }
    } else if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Dokumen bacaan harus PDF" }, { status: 400 });
    }
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: kind === "cover" ? "Sampul maksimal 5 MB" : `PDF maksimal ${READING_PDF_MAX_MB} MB` },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (kind === "cover" && !isValidImageSignature(bytes, file.type)) {
      return NextResponse.json({ error: "Isi file sampul tidak sesuai format gambar" }, { status: 400 });
    }
    if (kind === "document" && bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json({ error: "Isi file bukan dokumen PDF yang valid" }, { status: 400 });
    }

    const stored = await storeObject({
      folder: `reading/${kind}`,
      extension,
      bytes,
      contentType,
    });

    return NextResponse.json({
      url: publicStoredUploadUrl(stored),
      storage: stored.driver,
    });
  } catch (error) {
    if (error instanceof ReadingChunkUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Jenis upload tidak valid" }, { status: 400 });
    }
    console.error("[reading upload]", error);
    return NextResponse.json({ error: "Gagal mengunggah file" }, { status: 500 });
  }
}
