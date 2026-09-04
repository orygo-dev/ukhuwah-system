import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storeObject } from "@/lib/object-storage";
import { bodyTooLargeResponse, requestBodyTooLarge } from "@/lib/request-body-limit";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const videoTypes = new Map([
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
]);

function hasValidVideoSignature(bytes: Buffer, extension: string) {
  if (extension === "webm") {
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return NextResponse.json(
      { error: "Hanya akun guru yang dapat mengunggah Zona Kreasi." },
      { status: 403 }
    );
  }
  if (requestBodyTooLarge(req, MAX_VIDEO_BYTES + 1024 * 1024)) {
    return bodyTooLargeResponse("Ukuran video maksimal 100 MB.");
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Pilih file video terlebih dahulu." }, { status: 400 });
    }

    const extension = videoTypes.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: "Format video harus MP4, MOV, atau WebM." },
        { status: 400 }
      );
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Ukuran video maksimal 100 MB." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!hasValidVideoSignature(bytes, extension)) {
      return NextResponse.json(
        { error: "Isi file tidak sesuai dengan format video yang dipilih." },
        { status: 400 }
      );
    }

    const stored = await storeObject({
      folder: "spotlight",
      extension,
      bytes,
      contentType: file.type,
    });

    return NextResponse.json({
      url: stored.url,
      name: file.name,
      size: file.size,
      storage: stored.driver,
    });
  } catch (error) {
    console.error("[spotlight upload POST]", error);
    return NextResponse.json({ error: "Gagal mengunggah video Zona Kreasi." }, { status: 500 });
  }
}
