import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storeObject } from "@/lib/object-storage";
import { bodyTooLargeResponse, requestBodyTooLarge } from "@/lib/request-body-limit";

export const runtime = "nodejs";

const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function validSignature(bytes: Buffer, type: string) {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  }
  return (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (requestBodyTooLarge(req, 6 * 1024 * 1024)) {
    return bodyTooLargeResponse("Ukuran gambar maksimal 5 MB.");
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Pilih gambar mading terlebih dahulu." },
        { status: 400 }
      );
    }
    const extension = imageTypes.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: "Gambar harus berformat JPG, PNG, atau WebP." },
        { status: 400 }
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Ukuran gambar maksimal 5 MB." },
        { status: 400 }
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!validSignature(bytes, file.type)) {
      return NextResponse.json(
        { error: "Isi file tidak sesuai format gambar." },
        { status: 400 }
      );
    }

    const stored = await storeObject({
      folder: "mading",
      extension,
      bytes,
      contentType: file.type,
      namePrefix: session.user.id,
    });

    return NextResponse.json({ url: stored.url, storage: stored.driver });
  } catch (error) {
    console.error("[board-posts upload]", error);
    return NextResponse.json({ error: "Gagal mengunggah gambar" }, { status: 500 });
  }
}
