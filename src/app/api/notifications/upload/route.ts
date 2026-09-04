import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageNotifications } from "@/lib/notifications";
import { storeObject } from "@/lib/object-storage";
import { publicStoredUploadUrl } from "@/lib/upload-url";
import { bodyTooLargeResponse, requestBodyTooLarge } from "@/lib/request-body-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_TYPES = new Map([
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
  if (!canManageNotifications(session.user.role)) {
    return NextResponse.json(
      { error: "Anda tidak dapat mengunggah gambar pemberitahuan." },
      { status: 403 }
    );
  }
  if (requestBodyTooLarge(req, 6 * 1024 * 1024)) {
    return bodyTooLargeResponse("Ukuran gambar maksimal 5 MB.");
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Pilih gambar pemberitahuan terlebih dahulu." },
        { status: 400 }
      );
    }
    const extension = IMAGE_TYPES.get(file.type);
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
      folder: "notifications",
      extension,
      bytes,
      contentType: file.type,
      namePrefix: session.user.id,
    });

    return NextResponse.json({
      url: publicStoredUploadUrl(stored),
      storage: stored.driver,
    });
  } catch (error) {
    console.error("[notifications upload]", error);
    return NextResponse.json({ error: "Gagal mengunggah gambar" }, { status: 500 });
  }
}
