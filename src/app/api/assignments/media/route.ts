import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  assignmentMediaFolder,
  deleteAssignmentMediaIfUnreferenced,
  isValidAssignmentImageUrl,
} from "@/lib/assignment-media";
import { storeObject } from "@/lib/object-storage";
import { bodyTooLargeResponse, requestBodyTooLarge } from "@/lib/request-body-limit";

export const runtime = "nodejs";

const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function validSignature(bytes: Buffer, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "TEACHER" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya guru yang dapat mengunggah gambar soal." }, { status: 403 });
  }
  if (requestBodyTooLarge(req, MAX_IMAGE_BYTES + 1024 * 1024)) {
    return bodyTooLargeResponse("Ukuran gambar maksimal 5 MB.");
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Pilih gambar terlebih dahulu." }, { status: 400 });
    const extension = IMAGE_TYPES.get(file.type);
    if (!extension || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Gambar harus JPG, PNG, atau WebP dengan ukuran maksimal 5 MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!validSignature(bytes, file.type)) return NextResponse.json({ error: "Isi file tidak sesuai format gambar." }, { status: 400 });
    const stored = await storeObject({
      folder: assignmentMediaFolder(session.user.id),
      extension,
      bytes,
      contentType: file.type,
      namePrefix: "question",
    });
    return NextResponse.json({ url: stored.url });
  } catch (error) {
    console.error("[assignment media POST]", error);
    return NextResponse.json({ error: "Gagal mengunggah gambar soal." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "TEACHER" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const value = new URL(req.url).searchParams.get("url");
  if (!value || !isValidAssignmentImageUrl(value, session.user.id)) {
    return NextResponse.json({ error: "URL gambar tidak valid." }, { status: 400 });
  }
  await deleteAssignmentMediaIfUnreferenced([value]);
  return NextResponse.json({ deleted: true });
}
